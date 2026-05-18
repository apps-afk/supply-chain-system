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
    settings: getSettings(),
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
    const updated = updateSettings(patch);
    appendAudit({
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
