import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/api-auth';
import { getSettings, updateSettings, appendAudit, getAiUsage,
         stripPrivateSettings, SERVER_ONLY_SETTINGS_KEYS, SUB_PROCESSORS } from '../../../lib/workspace';
import { invalidatePolicyCache, parseAllowlist, isValidAllowlistEntry, ipAllowed } from '../../../lib/policy';
import { clientKey } from '../../../lib/rate-limit';
import { AI_MODELS } from '../../../lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Full settings are ADMIN-only — they contain the IP allowlist and security
// posture. Non-admin screens that need enforcement values use ./policy.
export async function GET() {
  const gate = await requireAuth(['admin']);
  if (!gate.ok) return gate.response;
  return NextResponse.json({
    settings: stripPrivateSettings(await getSettings()),
    aiUsage: await getAiUsage(),
    subProcessors: SUB_PROCESSORS,
  });
}

export async function PATCH(request) {
  const gate = await requireAuth(['admin']);
  if (!gate.ok) return gate.response;
  try {
    const patch = await request.json();

    // Server-authoritative keys can never be written from the client —
    // TOTP enrollments and the AI usage meter are maintained by the server.
    for (const k of SERVER_ONLY_SETTINGS_KEYS) delete patch[k];

    // Validate numeric fields so admins can't accidentally (or maliciously)
    // poison the config with negative / null / absurd values.
    const checkInt = (val, min, max, name) => {
      const n = Number(val);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
        throw new Error(`${name} ต้องเป็นจำนวนเต็มระหว่าง ${min} ถึง ${max}`);
      }
      return n;
    };
    if (patch.security) {
      if (patch.security.maxBulkExport !== undefined)
        patch.security.maxBulkExport = checkInt(patch.security.maxBulkExport, 1, 100000, 'จำนวนสูงสุดของ bulk export');
      if (patch.security.auditLogRetentionDays !== undefined)
        patch.security.auditLogRetentionDays = checkInt(patch.security.auditLogRetentionDays, 1, 3650, 'ระยะเวลาเก็บ audit log (วัน)');
      if (patch.security.sessionTimeoutHours !== undefined) {
        const n = Number(patch.security.sessionTimeoutHours);
        if (!Number.isFinite(n) || n <= 0 || n > 720)
          throw new Error('Session timeout ต้องอยู่ระหว่าง 0–720 ชม.');
        patch.security.sessionTimeoutHours = n;
      }
      if (patch.security.ipAllowlist !== undefined) {
        const raw = String(patch.security.ipAllowlist || '');
        const entries = parseAllowlist(raw);
        const bad = entries.filter(e => !isValidAllowlistEntry(e));
        if (bad.length) {
          throw new Error(`IP allowlist มีรายการที่ไม่ถูกต้อง: ${bad.join(', ')} — ใช้ IPv4 หรือ CIDR เช่น 203.0.113.45, 198.51.100.0/24`);
        }
        // Self-lockout guard: a non-empty allowlist must include the IP the
        // admin is saving from, otherwise the very next request locks them
        // (and possibly everyone) out of the API.
        const myIp = clientKey(request);
        if (entries.length > 0 && !ipAllowed(myIp, raw)) {
          throw new Error(`รายการนี้จะบล็อกตัวคุณเอง (IP ปัจจุบัน: ${myIp}) — เพิ่ม IP ของคุณก่อนบันทึก`);
        }
        patch.security.ipAllowlist = entries.join(', ');
      }
    }
    if (patch.aiUsage) {
      if (patch.aiUsage.monthlyTokenBudget !== undefined)
        patch.aiUsage.monthlyTokenBudget = checkInt(patch.aiUsage.monthlyTokenBudget, 0, 10000000000, 'งบ token รายเดือน');
    }
    if (patch.ai) {
      if (patch.ai.defaultModel !== undefined &&
          !AI_MODELS.some(m => m.id === patch.ai.defaultModel)) {
        throw new Error('โมเดล AI ไม่ถูกต้อง');
      }
      if (patch.ai.explanationLevel !== undefined &&
          !['short', 'medium', 'detailed'].includes(patch.ai.explanationLevel)) {
        throw new Error('ระดับคำอธิบายไม่ถูกต้อง');
      }
    }
    if (patch.org && patch.org.logoUrl !== undefined && patch.org.logoUrl !== null) {
      const v = String(patch.org.logoUrl);
      if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) {
        throw new Error('โลโก้ต้องเป็นรูป PNG/JPEG/WebP');
      }
      if (v.length > 200 * 1024) {
        throw new Error('ไฟล์โลโก้ใหญ่เกินไป — กรุณาใช้รูปเล็กลง');
      }
    }

    const updated = await updateSettings(patch);
    invalidatePolicyCache();
    await appendAudit({
      actor: gate.user.email,
      action: 'workspace.update',
      target: 'settings',
      changes: Object.keys(patch || {}),
    });
    return NextResponse.json({
      ok: true,
      settings: stripPrivateSettings(updated),
      aiUsage: await getAiUsage(),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'เกิดข้อผิดพลาด' }, { status: 400 });
  }
}
