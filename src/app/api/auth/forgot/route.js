import { NextResponse } from 'next/server';

const DOMAIN = 'initialestate.com';

// Forgot password — for the LOGIN page (user is not authenticated).
// Real production: would send a reset link via email (Postmark).
// For now: enqueue the request and tell the user an admin will contact them.
// This keeps a record so admin can reset via the Team page (PATCH /api/users).
export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'กรุณาระบุอีเมล' }, { status: 400 });
    }
    if (!email.toLowerCase().endsWith(`@${DOMAIN}`)) {
      return NextResponse.json(
        { error: `อนุญาตเฉพาะบัญชี @${DOMAIN} เท่านั้น` },
        { status: 403 }
      );
    }
    if (!globalThis.__ieForgotQueue) globalThis.__ieForgotQueue = [];
    globalThis.__ieForgotQueue.push({
      email: email.toLowerCase(),
      requestedAt: new Date().toISOString(),
    });
    // Always return success to avoid leaking which emails exist (anti-enumeration)
    return NextResponse.json({
      ok: true,
      message: 'คำขอถูกบันทึก — ผู้ดูแลระบบจะติดต่อกลับเพื่อรีเซ็ตรหัสผ่านให้คุณ',
    });
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
