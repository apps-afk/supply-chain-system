import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { authOptions } from './auth';
import { getPolicy, ipAllowed } from './policy';
import { UNAUTHORIZED_MESSAGE, FORBIDDEN_MESSAGE } from './auth-messages';

export { UNAUTHORIZED_MESSAGE, FORBIDDEN_MESSAGE };

// Central API gate (API_implement spec, Phase 2). Wraps the EXISTING
// NextAuth cookie-session — no parallel bearer-token system. Usage, as the
// first line of every handler (before any body parse):
//
//   const gate = await requireAuth();                 // any logged-in user
//   const gate = await requireAuth(WRITER_ROLES);     // writers only
//   const gate = await requireAuth(['admin']);        // admin only
//   if (!gate.ok) return gate.response;
//   ... gate.user = { id, email, name, role }
//
// Rules encoded here:
//   - no session (or a session whose account was deleted → role null)
//     → 401 UNAUTHORIZED_MESSAGE. This always wins over role checks so an
//     anonymous caller can never learn a route's role requirements via 403.
//   - session but role not in allowedRoles → 403 FORBIDDEN_MESSAGE.
//   - workspace policy (settings.security) is enforced here for the WHOLE
//     API surface: session max-age (sessionTimeoutHours, counted from
//     sign-in) and the IP allowlist.
export async function requireAuth(allowedRoles) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.role) {
    return {
      ok: false,
      response: NextResponse.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 }),
    };
  }

  // Workspace security policy — read through a 60s cache so this adds no
  // per-request DB round-trip. Policy failures never break auth open: if
  // the settings read fails we fall through to the plain role check.
  try {
    const policy = await getPolicy();
    const sec = policy.security || {};

    // Session age limit (counted from sign-in). Tokens minted before this
    // feature have no loginAt — they age out at NextAuth's own 7-day cap.
    const hours = Number(sec.sessionTimeoutHours) || 0;
    if (hours > 0 && session.loginAt) {
      const ageMs = Date.now() - Number(session.loginAt);
      if (Number.isFinite(ageMs) && ageMs > hours * 3600 * 1000) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: 'เซสชันหมดอายุตามนโยบายความปลอดภัย — กรุณาเข้าสู่ระบบใหม่', code: 'session_expired' },
            { status: 401 }
          ),
        };
      }
    }

    // IP allowlist — empty list means no restriction. Same spoof-resistant
    // header semantics as lib/rate-limit.js clientKey(); read via
    // next/headers since not every caller passes the Request object.
    if (String(sec.ipAllowlist || '').trim()) {
      const h = headers();
      const realIp = h.get('x-real-ip');
      const fwd = (h.get('x-forwarded-for') || '').split(',').map(s => s.trim()).filter(Boolean);
      const ip = (realIp || fwd[fwd.length - 1] || 'unknown').trim();
      if (!ipAllowed(ip, sec.ipAllowlist)) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: `IP ของคุณ (${ip}) ไม่อยู่ในรายการที่อนุญาต — ติดต่อผู้ดูแลระบบ`, code: 'ip_blocked' },
            { status: 403 }
          ),
        };
      }
    }
  } catch { /* policy unavailable → enforce role check only */ }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 &&
      !allowedRoles.includes(session.user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: FORBIDDEN_MESSAGE }, { status: 403 }),
    };
  }
  return { ok: true, user: session.user, session };
}
