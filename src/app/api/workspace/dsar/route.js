import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';
import { getDsarQueue, getDsarStats, resolveDsar, createDsar } from '../../../../lib/workspace';

async function adminGuard() {
  const gate = await requireAuth(['admin']);
  return gate.ok ? { session: gate.session } : { err: gate.response };
}

export async function GET() {
  const { err } = await adminGuard();
  if (err) return err;
  return NextResponse.json({ queue: await getDsarQueue(), stats: await getDsarStats() });
}

export async function POST(request) {
  const { err } = await adminGuard();
  if (err) return err;
  try {
    const { applicantEmail, type, note } = await request.json();
    if (!applicantEmail) {
      return NextResponse.json({ error: 'ต้องระบุอีเมลของเจ้าของข้อมูล' }, { status: 400 });
    }
    const r = await createDsar({ applicantEmail, type, note });
    return NextResponse.json({ ok: true, request: r });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'เกิดข้อผิดพลาด' }, { status: 400 });
  }
}

export async function PATCH(request) {
  const { err, session } = await adminGuard();
  if (err) return err;
  try {
    const { id } = await request.json();
    const r = await resolveDsar(id, session.user.email);
    return NextResponse.json({ ok: true, request: r });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'เกิดข้อผิดพลาด' }, { status: 400 });
  }
}
