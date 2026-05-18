import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';

const ALLOWED_DOMAIN = 'initialestate.com';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  return `${salt}:${hash}`;
}

export async function POST(request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
    }

    if (!email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
      return NextResponse.json({ error: 'อนุญาตเฉพาะบัญชี @initialestate.com เท่านั้น' }, { status: 403 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
    }

    const hashed = hashPassword(password);

    // In production: save to your database here
    // e.g. await db.users.create({ name, email, password: hashed })
    console.log(`New user registered: ${email} (${name}) — hash: ${hashed.slice(0, 20)}...`);

    return NextResponse.json({ ok: true, message: 'สมัครสำเร็จ' });
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}
