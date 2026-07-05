import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';
import { WRITER_ROLES } from '../../../../lib/permissions';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabase';
import { getSettings, appendAudit, recordAiUsage, getAiUsage } from '../../../../lib/workspace';
import { isGDriveConfigured, getFileBytes } from '../../../../lib/gdrive';
import { rateLimit, clientKey } from '../../../../lib/rate-limit';
import { hasApiKey, resolveModel, analyzeContract, analyzeComparison } from '../../../../lib/ai';

export const runtime = 'nodejs';       // googleapis + SDK aren't Edge-safe
export const dynamic = 'force-dynamic';
export const maxDuration = 60;         // model calls can take a while

const NO_KEY = () => NextResponse.json(
  { error: 'ยังไม่ได้ตั้งค่า AI — กรุณาใส่ ANTHROPIC_API_KEY (ติดต่อ admin) หรือดำเนินการต่อโดยไม่ใช้ AI ก็ได้', code: 'no_key' },
  { status: 503 }
);

// Persist the latest AI review into the contract's notes JSON (merged, not
// clobbered — the same blob carries the review-workflow state). The detail
// screen shows this stored result so a team member's run is visible to all.
async function persistContractAnalysis(contractId, analysis) {
  try {
    const { data: row } = await supabase
      .from('contracts').select('notes').eq('id', contractId).maybeSingle();
    let payload = {};
    try {
      const parsed = JSON.parse(row?.notes || '');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed;
      else if (row?.notes) payload = { memo: String(row.notes) };
    } catch { if (row?.notes) payload = { memo: String(row.notes) }; }
    payload.ai = analysis;
    await supabase.from('contracts').update({ notes: JSON.stringify(payload) }).eq('id', contractId);
  } catch (e) {
    console.error('[ai.analyze] persist failed:', e.message);
  }
}

export async function POST(request) {
  // Writers only (admin/procurement/manager) — same gate as document writes.
  const gate = await requireAuth(WRITER_ROLES);
  if (!gate.ok) return gate.response;

  // AI is optional and never blocks the user — but when the key IS present we
  // still cap calls so a loop / cost blow-up can't run away (Claude calls cost
  // money). 20 analyses / 5 min per user is plenty for real review work.
  const ipKey = clientKey(request);
  if (!rateLimit(`ai:${gate.user.email}:${ipKey}`, { limit: 20, windowMs: 5 * 60 * 1000 })) {
    return NextResponse.json({ error: 'ใช้ AI บ่อยเกินไป — กรุณารอสักครู่แล้วลองใหม่' }, { status: 429 });
  }

  if (!hasApiKey()) return NO_KEY();
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'ระบบยังไม่ได้เชื่อม Supabase' }, { status: 503 });
  }

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const kind = body?.kind;
  // Automatic runs (e.g. auto-evaluate on upload) respect the monthly token
  // budget: when spent, autos stop but MANUAL review keeps working — exactly
  // what the settings page promises ("ยังทำมือได้").
  const isAuto = body?.auto === true;

  let model = 'claude-opus-4-8';
  let level = 'medium';
  try {
    const s = await getSettings();
    model = resolveModel(s?.ai?.defaultModel);
    level = s?.ai?.explanationLevel || 'medium';
  } catch { /* defaults */ }

  if (isAuto) {
    try {
      const u = await getAiUsage();
      if (u.budget > 0 && u.tokens >= u.budget) {
        return NextResponse.json(
          { error: 'งบ token AI รายเดือนหมดแล้ว — การวิเคราะห์อัตโนมัติหยุดชั่วคราว (กดวิเคราะห์เองได้)', code: 'budget' },
          { status: 429 }
        );
      }
    } catch { /* budget unreadable → allow */ }
  }

  try {
    if (kind === 'contract') {
      const id = String(body.contract_id || '');
      if (!id) return NextResponse.json({ error: 'ต้องระบุ contract_id' }, { status: 400 });

      const { data: contract } = await supabase
        .from('contracts').select('*').eq('id', id).maybeSingle();
      if (!contract) return NextResponse.json({ error: 'ไม่พบสัญญา' }, { status: 404 });

      // Prefer the attached PDF; fall back to the contract's structured fields
      // so AI review still works with no file / no Drive.
      let pdf = null;
      if (isGDriveConfigured) {
        const { data: atts } = await supabase
          .from('file_attachments')
          .select('drive_file_id, mime_type, size')
          .eq('entity_type', 'contract').eq('entity_id', id)
          .order('uploaded_at', { ascending: false });
        const pdfAtt = (atts || []).find(a => a.mime_type === 'application/pdf' && (a.size || 0) <= 25 * 1024 * 1024);
        if (pdfAtt) {
          try { pdf = await getFileBytes(pdfAtt.drive_file_id); }
          catch { pdf = null; /* fall back to metadata-only review */ }
        }
      }

      const meta = {
        'ชื่อสัญญา': contract.title,
        'ประเภท': contract.type_id,
        'มูลค่า': contract.amount,
        'สกุลเงิน': contract.currency,
        'วันเริ่ม': contract.start_date,
        'วันสิ้นสุด': contract.end_date,
        'การรับประกัน': contract.warranty,
        'สถานะ': contract.status,
      };
      const result = await analyzeContract({ model, pdf, meta, level });
      await recordAiUsage(result.tokensUsed).catch(() => {});
      const stored = {
        summary: result.summary, issues: result.issues, recommendation: result.recommendation,
        model: result.model, source: pdf ? 'pdf' : 'fields',
        at: new Date().toISOString(), by: gate.user.email, auto: isAuto,
      };
      await persistContractAnalysis(id, stored);
      await appendAudit({ actor: gate.user.email, action: 'ai.analyze', target: `contract/${id}`,
                          changes: { model, withPdf: !!pdf, auto: isAuto, tokens: result.tokensUsed } });
      return NextResponse.json({ ok: true, kind, ...stored });
    }

    if (kind === 'comparison') {
      const id = String(body.comparison_id || '');
      if (!id) return NextResponse.json({ error: 'ต้องระบุ comparison_id' }, { status: 400 });

      const { data: cmp } = await supabase
        .from('comparisons').select('*').eq('id', id).maybeSingle();
      if (!cmp) return NextResponse.json({ error: 'ไม่พบการเปรียบเทียบ' }, { status: 404 });

      const result = await analyzeComparison({ model, cmp, level });
      await recordAiUsage(result.tokensUsed).catch(() => {});
      await appendAudit({ actor: gate.user.email, action: 'ai.analyze', target: `comparison/${id}`,
                          changes: { model, tokens: result.tokensUsed } });
      return NextResponse.json({
        ok: true, kind,
        summary: result.summary, issues: result.issues, recommendation: result.recommendation,
        model: result.model, at: new Date().toISOString(), by: gate.user.email,
      });
    }

    return NextResponse.json({ error: 'kind ไม่ถูกต้อง (contract|comparison)' }, { status: 400 });
  } catch (e) {
    if (e?.code === 'no_key') return NO_KEY();
    // Surface the model/SDK reason server-side; give the user a safe message.
    console.error('[ai.analyze] error:', e?.status || '', e?.message || e);
    const status = Number(e?.status);
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: 'API key ของ AI ไม่ถูกต้องหรือหมดสิทธิ์ — ติดต่อ admin' }, { status: 502 });
    }
    if (status === 429) {
      return NextResponse.json({ error: 'AI ให้บริการไม่ทัน (rate limit) — รอสักครู่แล้วลองใหม่' }, { status: 429 });
    }
    return NextResponse.json({ error: 'วิเคราะห์ด้วย AI ไม่สำเร็จ — ดำเนินการต่อโดยไม่ใช้ AI ได้' }, { status: 502 });
  }
}
