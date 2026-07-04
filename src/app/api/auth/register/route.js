import { NextResponse } from 'next/server';
import { registerUser } from '../../../../lib/users';
import { rateLimit, clientKey } from '../../../../lib/rate-limit';

const DOMAIN = 'initialestate.com';

export async function POST(request) {
  try {
    // Unauthenticated write endpoint — throttle per client to stop spam.
    if (!rateLimit(`register:${clientKey(request)}`, { limit: 5, windowMs: 10 * 60 * 1000 })) {
      return NextResponse.json({ error: 'สมัครบ่อยเกินไป — กรุณารอสักครู่' }, { status: 429 });
    }
    const { name, email, password } = await request.json();

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
    }
    // The domain suffix check alone accepts "evil@example.com@initialestate.com"
    // and other malformed strings — validate basic shape first.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }, { status: 400 });
    }
    if (!email.toLowerCase().endsWith(`@${DOMAIN}`)) {
      return NextResponse.json({ error: `อนุญาตเฉพาะบัญชี @${DOMAIN} เท่านั้น` }, { status: 403 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
    }

    const user = await registerUser(name.trim(), email.toLowerCase(), password);
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'เกิดข้อผิดพลาด' }, { status: 400 });
  }
}
