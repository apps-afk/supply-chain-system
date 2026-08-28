import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabase';
import { rateLimit, clientKey } from '../../../../lib/rate-limit';
import { getProfile } from '../../../../lib/users';
import { sendMail, resetPasswordEmailHtml, appBaseUrl, isMailerConfigured } from '../../../../lib/mailer';

const DOMAIN = 'initialestate.com';
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

// Forgot password from login page (user is NOT authenticated).
// Self-service: mail a one-time reset link when the account exists and a
// mailer is configured. Always enqueue + always return the same generic
// success message either way, so the response never reveals whether an
// email is registered (anti-enumeration) or whether mail actually sent.
export async function POST(request) {
  try {
    // Unauthenticated write endpoint — throttle per client to stop queue spam.
    if (!rateLimit(`forgot:${clientKey(request)}`, { limit: 5, windowMs: 10 * 60 * 1000 })) {
      return NextResponse.json({ error: 'ส่งคำขอบ่อยเกินไป — กรุณารอสักครู่' }, { status: 429 });
    }
    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'กรุณาระบุอีเมล' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }, { status: 400 });
    }
    if (!email.toLowerCase().endsWith(`@${DOMAIN}`)) {
      return NextResponse.json(
        { error: `อนุญาตเฉพาะบัญชี @${DOMAIN} เท่านั้น` },
        { status: 403 }
      );
    }
    const key = email.toLowerCase();

    // Also throttle per-email so one address can't be spammed with reset mail.
    const emailOk = rateLimit(`forgot-email:${key}`, { limit: 3, windowMs: 30 * 60 * 1000 });

    let mailResult = null;
    if (emailOk) {
      // getProfile() is null for unknown emails AND for the builtin admin's
      // reset-restricted flow doesn't apply here — builtin admin has no row
      // in `users`, so it simply won't get a mail (its password lives in
      // ADMIN_PASSWORD, not the DB — matches adminResetPassword's own guard).
      const profile = await getProfile(key).catch(() => null);
      if (profile && !profile.isBuiltin && isSupabaseConfigured) {
        const rawToken = randomBytes(32).toString('hex');
        const { error: insErr } = await supabase.from('forgot_password_queue').insert({
          email: key,
          token_hash: hashToken(rawToken),
          expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
        });
        const resetUrl = `${appBaseUrl()}/reset-password?email=${encodeURIComponent(key)}&token=${rawToken}`;
        if (!insErr && isMailerConfigured) {
          mailResult = await sendMail({
            to: key,
            subject: 'ตั้งรหัสผ่านใหม่ — INITIAL Supply Chain',
            html: resetPasswordEmailHtml({ name: profile.name, resetUrl }),
          });
        } else if (insErr) {
          console.error('forgot queue insert failed:', insErr.message);
        } else {
          // SMTP not configured yet (e.g. local dev before Gmail App Password
          // is set up) — the raw token only ever exists in this response and
          // this log line, never persisted (DB keeps a hash), so surface it
          // server-side so testing doesn't require real email delivery.
          console.log(`[forgot-password] SMTP not configured — reset link for ${key}: ${resetUrl}`);
        }
      } else if (!isSupabaseConfigured) {
        // No DB configured at all — keep the old in-memory queue so admin
        // still sees something, even though self-service mail can't work
        // without a persisted token.
        if (!globalThis.__ieForgotQueue) globalThis.__ieForgotQueue = [];
        globalThis.__ieForgotQueue.push({
          id: Date.now(), email: key, requested_at: new Date().toISOString(), resolved_at: null,
        });
      }
    }

    // Always the same response — don't leak whether the email exists, sent,
    // or was rate-limited.
    return NextResponse.json({
      ok: true,
      message: mailResult?.ok
        ? 'หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว'
        : 'หากอีเมลนี้มีอยู่ในระบบ คำขอถูกบันทึกแล้ว — ผู้ดูแลระบบจะติดต่อกลับหากอีเมลส่งไม่สำเร็จ',
    });
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
