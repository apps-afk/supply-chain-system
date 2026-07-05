import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';
import { getProfile, updateProfile } from '../../../../lib/users';

export async function GET() {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const session = gate.session;
  const profile = await getProfile(session.user.email);
  if (!profile) return NextResponse.json({ error: 'ไม่พบบัญชี' }, { status: 404 });
  return NextResponse.json({ profile });
}

export async function PATCH(request) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const session = gate.session;
  try {
    const body = await request.json();
    const safe = {};
    if (typeof body.name  === 'string') safe.name  = body.name.trim();
    if (typeof body.phone === 'string') safe.phone = body.phone.trim();
    if (typeof body.email === 'string') safe.email = body.email.trim();

    if (safe.name !== undefined && safe.name === '') {
      return NextResponse.json({ error: 'ชื่อไม่ควรว่าง' }, { status: 400 });
    }
    if (safe.phone !== undefined && safe.phone && !/^[+0-9 ()\-]{6,20}$/.test(safe.phone)) {
      return NextResponse.json({ error: 'เบอร์โทรไม่ถูกรูปแบบ' }, { status: 400 });
    }

    const result = await updateProfile(session.user.email, safe);
    return NextResponse.json({ ok: true, emailChanged: result.emailChanged });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'เกิดข้อผิดพลาด' }, { status: 400 });
  }
}
