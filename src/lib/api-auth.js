import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
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
export async function requireAuth(allowedRoles) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.role) {
    return {
      ok: false,
      response: NextResponse.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 }),
    };
  }
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 &&
      !allowedRoles.includes(session.user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: FORBIDDEN_MESSAGE }, { status: 403 }),
    };
  }
  return { ok: true, user: session.user, session };
}
