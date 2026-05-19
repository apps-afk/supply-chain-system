import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { getSettings, updateSettings, appendAudit, SUB_PROCESSORS } from '../../../lib/workspace';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }
  return NextResponse.json({
    settings: await getSettings(),
    subProcessors: SUB_PROCESSORS,
  });
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'ต้องเป็นผู้ดูแลระบบเท่านั้น' }, { status: 403 });
  }
  try {
    const patch = await request.json();

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
    }
    if (patch.aiUsage) {
      if (patch.aiUsage.monthlyTokenBudget !== undefined)
        patch.aiUsage.monthlyTokenBudget = checkInt(patch.aiUsage.monthlyTokenBudget, 0, 10000000000, 'งบ token รายเดือน');
    }

    const updated = await updateSettings(patch);
    await appendAudit({
      actor: session.user.email,
      action: 'workspace.update',
      target: 'settings',
      changes: Object.keys(patch || {}),
    });
    return NextResponse.json({ ok: true, settings: updated });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'เกิดข้อผิดพลาด' }, { status: 400 });
  }
}
