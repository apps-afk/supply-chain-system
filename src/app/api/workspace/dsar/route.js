import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { getDsarQueue, getDsarStats, resolveDsar, createDsar } from '../../../../lib/workspace';

async function adminGuard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { err: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 }) };
  if (session.user.role !== 'admin') return { err: NextResponse.json({ error: 'ต้องเป็นผู้ดูแลระบบเท่านั้น' }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const { err } = await adminGuard();
  if (err) return err;
  return NextResponse.json({ queue: getDsarQueue(), stats: getDsarStats() });
}

export async function POST(request) {
  const { err } = await adminGuard();
  if (err) return err;
  try {
    const { applicantEmail, type, note } = await request.json();
    if (!applicantEmail) {
      return NextResponse.json({ error: 'ต้องระบุอีเมลของเจ้าของข้อมูล' }, { status: 400 });
    }
    const r = createDsar({ applicantEmail, type, note });
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
    const r = resolveDsar(id, session.user.email);
    return NextResponse.json({ ok: true, request: r });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'เกิดข้อผิดพลาด' }, { status: 400 });
  }
}
