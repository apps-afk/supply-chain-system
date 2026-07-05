import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { requireAuth } from '../../../../lib/api-auth';
import { getTotp, setTotp, appendAudit } from '../../../../lib/workspace';
import { getPolicy } from '../../../../lib/policy';
import { generateSecret, verifyTOTP, otpauthURL } from '../../../../lib/totp';
import { rateLimit, clientKey } from '../../../../lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 2FA status for the CURRENT user: enrolled or not, and whether workspace
// policy requires it for their role (drives the enroll-now banner).
export async function GET() {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const t = await getTotp(gate.user.email);
  let required = false;
  try {
    const sec = (await getPolicy()).security || {};
    required = !!sec.require2FA && gate.user.role === 'admin';
  } catch { /* policy unavailable */ }
  return NextResponse.json({ enabled: !!t?.enabled, required });
}

// Enrollment lifecycle. All actions operate on the CALLER's own account —
// there is deliberately no "disable someone else's 2FA" surface here.
//   {action:'start'}                → new pending secret + otpauth + QR
//   {action:'verify', code}        → confirm pending secret, enable 2FA
//   {action:'disable', code}       → turn off (needs a valid current code)
export async function POST(request) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const email = gate.user.email.toLowerCase();

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const ip = clientKey(request);
  if (!rateLimit(`2fa:${ip}:${email}`, { limit: 15, windowMs: 5 * 60 * 1000 })) {
    return NextResponse.json({ error: 'ลองบ่อยเกินไป — กรุณารอ 5 นาที' }, { status: 429 });
  }

  const action = body?.action;

  if (action === 'start') {
    const secret = generateSecret();
    await setTotp(email, { pendingSecret: secret });
    const url = otpauthURL({ secret, email });
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 });
    // The secret is returned ONCE here for manual entry; it is never
    // readable again through any API.
    return NextResponse.json({ ok: true, otpauth: url, qr, secret });
  }

  if (action === 'verify') {
    const t = await getTotp(email);
    if (!t?.pendingSecret) {
      return NextResponse.json({ error: 'ยังไม่ได้เริ่มตั้งค่า — กด "เปิดใช้ 2FA" ก่อน' }, { status: 400 });
    }
    if (!verifyTOTP(t.pendingSecret, body.code)) {
      return NextResponse.json({ error: 'รหัสไม่ถูกต้อง — ลองสแกน QR ใหม่แล้วกรอกรหัสล่าสุด' }, { status: 400 });
    }
    await setTotp(email, { secret: t.pendingSecret, pendingSecret: null, enabled: true, enabledAt: new Date().toISOString() });
    await appendAudit({ actor: email, action: 'auth.2fa_enabled', target: 'self' });
    return NextResponse.json({ ok: true, enabled: true });
  }

  if (action === 'disable') {
    const t = await getTotp(email);
    if (!t?.enabled) return NextResponse.json({ error: 'ยังไม่ได้เปิดใช้ 2FA' }, { status: 400 });
    if (!verifyTOTP(t.secret, body.code)) {
      return NextResponse.json({ error: 'รหัสไม่ถูกต้อง — ต้องยืนยันด้วยรหัสจากแอปก่อนปิด' }, { status: 400 });
    }
    await setTotp(email, null);
    await appendAudit({ actor: email, action: 'auth.2fa_disabled', target: 'self' });
    return NextResponse.json({ ok: true, enabled: false });
  }

  return NextResponse.json({ error: 'action ไม่ถูกต้อง (start|verify|disable)' }, { status: 400 });
}
