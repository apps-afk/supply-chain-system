import { NextResponse } from 'next/server';
import { UNAUTHORIZED_MESSAGE, FORBIDDEN_MESSAGE } from '../../../../lib/auth-messages';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { forceResetPassword } from '../../../../lib/users';
import { appendAudit } from '../../../../lib/workspace';

// Reset the logged-in user's password without requiring the old one.
// We rely on the session cookie as proof of identity — the user has
// already authenticated.
export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 });
  }
  try {
    const { newPassword } = await request.json();
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' },
        { status: 400 }
      );
    }
    await forceResetPassword(session.user.email, newPassword);
    await appendAudit({ actor: session.user.email, action: 'auth.password_reset_self', target: 'self' });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'เกิดข้อผิดพลาด' }, { status: 400 });
  }
}
