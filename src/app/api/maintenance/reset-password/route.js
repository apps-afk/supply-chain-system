import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminResetPassword, adminCreateUser } from '../../../../lib/users';
import { appendAudit } from '../../../../lib/workspace';
import { rateLimit, clientKey } from '../../../../lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Break-glass password reset, callable ONLY while the MAINTENANCE_TOKEN env
 * var exists (the admin-reset GitHub workflow sets it, calls this once, then
 * REMOVES it and redeploys — so this endpoint is a 404 in normal operation).
 *
 * Guards: env-gated (404 when unset), 32+ char token, constant-time compare,
 * rate-limited, @initialestate.com targets only, fully audited.
 */
function tokenOk(supplied) {
  const expected = process.env.MAINTENANCE_TOKEN || '';
  if (expected.length < 32 || !supplied) return false;
  const a = Buffer.from(String(supplied));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request) {
  // Indistinguishable from a nonexistent route when maintenance mode is off.
  if (!process.env.MAINTENANCE_TOKEN) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!rateLimit(`maint:${clientKey(request)}`, { limit: 5, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ error: 'too many attempts' }, { status: 429 });
  }
  if (!tokenOk(request.headers.get('x-maintenance-token'))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const email = String(body.email || '').toLowerCase().trim();
  const password = String(body.password || '');
  if (!email.endsWith('@initialestate.com')) {
    return NextResponse.json({ error: 'email must be @initialestate.com' }, { status: 400 });
  }
  if (password.length < 10) {
    return NextResponse.json({ error: 'password must be >= 10 chars' }, { status: 400 });
  }

  try {
    await adminResetPassword(email, password);
    await appendAudit({ actor: 'maintenance-workflow', action: 'auth.password_reset', target: email });
    return NextResponse.json({ ok: true, action: 'reset', email });
  } catch (e) {
    if (/ไม่พบบัญชี/.test(e.message || '')) {
      // Account never registered — create it as admin (workspace owner's
      // address, human-triggered via the repo-gated workflow).
      try {
        await adminCreateUser(email.split('@')[0], email, password, 'admin');
        await appendAudit({ actor: 'maintenance-workflow', action: 'users.create', target: `${email} (admin, via maintenance)` });
        return NextResponse.json({ ok: true, action: 'created', email });
      } catch (e2) {
        return NextResponse.json({ error: e2.message }, { status: 400 });
      }
    }
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
