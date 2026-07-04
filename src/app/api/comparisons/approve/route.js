import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/crud';
import { canApprove } from '../../../../lib/permissions';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabase';
import { appendAudit } from '../../../../lib/workspace';

export const runtime = 'nodejs';

// In-app approval chain for comparisons (P2).
//
// POST { id, level, action: 'approve' | 'revoke' }
//
// The chain is defined by the approval_roles master (active roles, ordered
// by level). Rules enforced server-side so the trail is trustworthy:
//   - only admin/manager may approve (canApprove)
//   - approve must be sequential: every lower level already approved
//   - revoke only the highest approved level; only by that approver or admin
//   - identity + timestamp are taken from the session, never the client
//   - when the whole chain is approved the comparison flips to 'finalized';
//     revoking from finalized flips it back to 'draft'
//
// approvals_json is deliberately NOT in the generic PATCH whitelist —
// this endpoint is the only writer, so entries can't be forged.

export async function POST(request) {
  const { session, err } = await requireSession();
  if (err) return err;
  if (!canApprove(session.user.role)) {
    return NextResponse.json(
      { error: 'ต้องเป็นผู้จัดการหรือผู้ดูแลระบบจึงจะอนุมัติได้' },
      { status: 403 }
    );
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'ระบบยังไม่ได้เชื่อม Supabase' }, { status: 503 });
  }

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const { id, level, action } = body || {};
  if (!id || typeof level !== 'number' || !['approve', 'revoke'].includes(action)) {
    return NextResponse.json({ error: 'ต้องระบุ id, level และ action' }, { status: 400 });
  }

  const [{ data: cmp, error: cmpErr }, { data: roles, error: roleErr }] = await Promise.all([
    supabase.from('comparisons').select('*').eq('id', id).maybeSingle(),
    supabase.from('approval_roles').select('*').eq('active', true).order('level'),
  ]);
  if (cmpErr || roleErr) {
    return NextResponse.json({ error: (cmpErr || roleErr).message }, { status: 400 });
  }
  if (!cmp) return NextResponse.json({ error: 'ไม่พบใบเปรียบเทียบ' }, { status: 404 });

  const chain = roles || [];
  const target = chain.find(r => r.level === level);
  if (!target) {
    return NextResponse.json({ error: `ไม่มีตำแหน่งผู้อนุมัติลำดับ ${level}` }, { status: 400 });
  }

  const approvals = Array.isArray(cmp.approvals_json) ? [...cmp.approvals_json] : [];
  const approvedLevels = new Set(approvals.map(a => a.level));

  if (action === 'approve') {
    if (approvedLevels.has(level)) {
      return NextResponse.json({ error: 'ลำดับนี้อนุมัติไปแล้ว' }, { status: 409 });
    }
    // Sequential: every active level below this one must be approved first.
    const missing = chain.filter(r => r.level < level && !approvedLevels.has(r.level));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `ต้องรอ "${missing[0].name}" (ลำดับ ${missing[0].level}) อนุมัติก่อน` },
        { status: 409 }
      );
    }
    approvals.push({
      level,
      role_code: target.code || '',
      role_name: target.name || '',
      by_name:   session.user.name  || session.user.email,
      by_email:  session.user.email,
      at:        new Date().toISOString(),
    });
  } else {
    // revoke — only the highest approved level, by its approver or admin.
    const entry = approvals.find(a => a.level === level);
    if (!entry) return NextResponse.json({ error: 'ลำดับนี้ยังไม่ได้อนุมัติ' }, { status: 409 });
    const higher = approvals.some(a => a.level > level);
    if (higher) {
      return NextResponse.json(
        { error: 'ต้องยกเลิกลำดับที่สูงกว่าก่อน (ยกเลิกจากบนลงล่าง)' },
        { status: 409 }
      );
    }
    const isOwner = entry.by_email === session.user.email;
    if (!isOwner && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'ยกเลิกได้เฉพาะผู้ที่อนุมัติลำดับนี้เอง หรือผู้ดูแลระบบ' },
        { status: 403 }
      );
    }
    approvals.splice(approvals.indexOf(entry), 1);
  }

  // Chain complete → finalized; broken chain on a finalized doc → back to draft.
  const allApproved = chain.length > 0 &&
    chain.every(r => approvals.some(a => a.level === r.level));
  const patch = { approvals_json: approvals };
  if (action === 'approve' && allApproved && cmp.status === 'draft') {
    patch.status = 'finalized';
  } else if (action === 'revoke' && cmp.status === 'finalized' && !allApproved) {
    patch.status = 'draft';
  }

  const { data: updated, error: upErr } = await supabase
    .from('comparisons').update(patch).eq('id', id).select().single();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  await appendAudit({
    actor: session.user.email,
    action: action === 'approve' ? 'comparisons.approve' : 'comparisons.revoke_approval',
    target: `${id} (level ${level})`,
  });
  return NextResponse.json({ ok: true, item: updated });
}
