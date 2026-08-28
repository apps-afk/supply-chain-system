// Transactional email via the Postmark HTTP API.
//
// Postmark is a plain REST call, so there's no SDK dependency — fetch is
// enough. Degrades gracefully like lib/ai.js: with POSTMARK_TOKEN unset the
// module reports `isMailerConfigured === false` and callers fall back to the
// admin-actioned queue instead of hard-crashing.
//
// Env:
//   POSTMARK_TOKEN      Server API Token (Servers → <server> → API Tokens)
//   MAIL_FROM_ADDRESS   sender, must be on a DKIM-verified domain
//   MAIL_FROM_NAME      display name (optional)

const POSTMARK_ENDPOINT = 'https://api.postmarkapp.com/email';
// The server's transactional stream. Password resets are transactional, never
// broadcast — a broadcast stream would add unsubscribe headers and is rate-
// shaped for bulk sending.
const MESSAGE_STREAM = 'outbound';
const SEND_TIMEOUT_MS = 10_000;

export const isMailerConfigured = !!(process.env.POSTMARK_TOKEN && process.env.MAIL_FROM_ADDRESS);

// Base URL for links inside emails. Order matters:
//   1. NEXTAUTH_URL — explicit, and already the canonical site URL when set.
//   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel sets this to the project's
//      production domain (supplychain.initialestate.com), so reset links stay
//      on the real site even if nobody sets NEXTAUTH_URL.
//   3. VERCEL_URL — deployment-specific host. Last resort only: it changes
//      every deploy and can sit behind Deployment Protection, which would
//      make a mailed link unopenable.
//   4. localhost for `next dev`.
export function appBaseUrl() {
  const explicit = process.env.NEXTAUTH_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (host) return `https://${host}`.replace(/\/$/, '');
  return 'http://localhost:3000';
}

function fromHeader() {
  const address = process.env.MAIL_FROM_ADDRESS;
  const name = process.env.MAIL_FROM_NAME;
  // Quote-escape the display name so a stray `"` can't break the header.
  return name ? `"${name.replace(/"/g, '')}" <${address}>` : address;
}

export async function sendMail({ to, subject, html }) {
  if (!isMailerConfigured) return { ok: false, error: 'mailer not configured' };

  // Serverless: never let a hung upstream hold the request open to the
  // platform timeout — the caller treats a failed send as "fall back to the
  // admin queue", which is far better than a 504.
  const abort = AbortController ? new AbortController() : null;
  const timer = abort ? setTimeout(() => abort.abort(), SEND_TIMEOUT_MS) : null;

  try {
    const res = await fetch(POSTMARK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': process.env.POSTMARK_TOKEN,
      },
      body: JSON.stringify({
        From: fromHeader(),
        To: to,
        Subject: subject,
        HtmlBody: html,
        MessageStream: MESSAGE_STREAM,
      }),
      signal: abort?.signal,
    });

    // Postmark answers 200 + ErrorCode 0 on success; every failure carries a
    // non-zero ErrorCode and a human Message.
    const data = await res.json().catch(() => null);
    if (!res.ok || (data && data.ErrorCode !== 0)) {
      const code = data?.ErrorCode ?? res.status;
      const detail = data?.Message || `HTTP ${res.status}`;
      // 406 = the address is on the server's suppression list (a previous
      // hard bounce or spam complaint). It stays suppressed until cleared in
      // Postmark → Suppressions, so call it out rather than burying it.
      if (code === 406) {
        console.error(`[mailer] recipient suppressed by Postmark — clear it under Suppressions: ${detail}`);
      } else {
        console.error(`[mailer] send failed (ErrorCode ${code}): ${detail}`);
      }
      return { ok: false, error: detail };
    }
    return { ok: true, messageId: data?.MessageID };
  } catch (e) {
    const reason = e.name === 'AbortError' ? `timed out after ${SEND_TIMEOUT_MS}ms` : e.message;
    console.error('[mailer] send failed:', reason);
    return { ok: false, error: reason };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function resetPasswordEmailHtml({ name, resetUrl }) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#322E36">
    <h2 style="color:#B07A3C;font-size:18px">INITIAL Supply Chain</h2>
    <p>สวัสดีคุณ ${name || ''},</p>
    <p>มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์นี้ใช้ได้ครั้งเดียวและหมดอายุใน 30 นาที)</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${resetUrl}" style="background:#1F4D40;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500">ตั้งรหัสผ่านใหม่</a>
    </p>
    <p style="font-size:12px;color:#8a8580">หากปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์: <br>${resetUrl}</p>
    <p style="font-size:12px;color:#8a8580">หากคุณไม่ได้ขอเปลี่ยนรหัสผ่าน สามารถเพิกเฉยต่ออีเมลนี้ได้ — รหัสผ่านเดิมของคุณจะไม่ถูกเปลี่ยน</p>
  </div>`;
}
