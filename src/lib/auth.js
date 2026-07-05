import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { validateUser } from './users';
import { NEXTAUTH_SECRET } from './auth-config';
import { rateLimit } from './rate-limit';
import { appendAudit } from './workspace';

// SECURITY: if NEXTAUTH_SECRET isn't set in production, auth-config.js falls
// back to a guessable dev string — sessions become forgeable. We WARN loudly
// (and surface it on the config-status endpoint) but do NOT crash the whole
// app: a hard throw here takes down every page including /login, and the
// fallback is the same behaviour the app already had. Set NEXTAUTH_SECRET in
// Vercel to make sessions secure; this is verified in scripts/check-env.
export const SECRET_INSECURE =
  process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_SECRET;
if (SECRET_INSECURE) {
  // eslint-disable-next-line no-console
  console.error(
    '[auth] SECURITY: NEXTAUTH_SECRET is not set — sessions are signed with a ' +
    'guessable fallback and can be forged. Set NEXTAUTH_SECRET in Vercel env vars.'
  );
}

const DOMAIN = 'initialestate.com';

const providers = [
  CredentialsProvider({
    name: 'Email',
    credentials: {
      email:    { label: 'อีเมล',    type: 'email'    },
      password: { label: 'รหัสผ่าน', type: 'password' },
    },
    async authorize(credentials, req) {
      if (!credentials?.email || !credentials?.password) return null;
      // Defense in depth: strict shape + explicit domain check. The shape
      // regex rejects wildcard/whitespace tricks (e.g. "%@initialestate.com")
      // before the email ever reaches the DB lookup.
      const email = credentials.email.toLowerCase();
      if (!/^[^\s@%_]+@[^\s@%_]+\.[^\s@%_]+$/.test(email) || !email.endsWith(`@${DOMAIN}`)) {
        throw new Error(`อนุญาตเฉพาะบัญชี @${DOMAIN} เท่านั้น`);
      }
      const key = email;
      // Platform-set client IP (spoof-resistant on Vercel) for the limiters.
      const h = req?.headers || {};
      const realIp = h['x-real-ip'];
      const fwd = (h['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
      const ip = (realIp || fwd[fwd.length - 1] || 'unknown').trim();
      // Two brakes so neither axis alone enables abuse:
      //   - per IP+email (8/5min): normal brute-force brake on one account
      //   - per IP overall (40/5min): stops spraying many emails from one host
      //     AND prevents a victim-lockout DoS (an attacker can't lock someone
      //     else's account without also burning their own IP budget).
      const tooMany =
        !rateLimit(`login:${ip}:${key}`, { limit: 8, windowMs: 5 * 60 * 1000 }) ||
        !rateLimit(`loginip:${ip}`,      { limit: 40, windowMs: 5 * 60 * 1000 });
      if (tooMany) {
        throw new Error('พยายามเข้าสู่ระบบบ่อยเกินไป — กรุณารอ 5 นาทีแล้วลองใหม่');
      }
      const user = await validateUser(credentials.email, credentials.password);
      if (!user) {
        await appendAudit({ actor: key, action: 'auth.login_failed', target: 'credentials' }).catch(() => {});
        throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      }
      await appendAudit({ actor: key, action: 'auth.login', target: 'credentials' }).catch(() => {});
      return user;
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.unshift(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: { params: { hd: DOMAIN, prompt: 'select_account' } },
    })
  );
}

// Server-side role cache (email → { role, at }). getServerSession() runs the
// jwt callback on every API request but can't persist a mutated token back to
// the cookie, so a `roleCheckedAt` stored on the token would stay stale and
// trigger a DB lookup on EVERY request once the cookie ages past the window.
// Caching here bounds it to at most one lookup per email per window per
// serverless instance. Lives on globalThis so all route modules share it.
const ROLE_TTL_MS = 5 * 60 * 1000;
if (!globalThis.__ieRoleCache) globalThis.__ieRoleCache = new Map();
const roleCache = globalThis.__ieRoleCache;

export const authOptions = {
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        // Require both: domain match AND Google-verified email.
        // A Workspace admin could otherwise mint an unverified alias.
        const okDomain = user.email?.toLowerCase().endsWith(`@${DOMAIN}`);
        const okVerified = profile?.email_verified === true;
        return Boolean(okDomain && okVerified);
      }
      return true;
    },
    async jwt({ token, user }) {
      // Fresh sign-in — trust authorize()'s role and prime the cache.
      // Google sign-ins carry no role on the user object; resolve it from
      // the store right away (fall back to read-only 'user') so the first
      // requests aren't rejected by the role check in the API guards.
      if (user) {
        let role = user.role;
        if (!role && token.email) {
          try {
            const { getProfile } = await import('./users');
            role = (await getProfile(token.email))?.role;
          } catch { /* transient */ }
        }
        token.role = role || 'user';
        if (token.email) roleCache.set(token.email.toLowerCase(), { role: token.role, at: Date.now() });
        return token;
      }
      // Subsequent requests: refresh the role from the store at most once per
      // TTL per email (so an admin's role change applies without re-login,
      // but we don't hammer the DB on every API call).
      if (token.email) {
        const key = token.email.toLowerCase();
        const cached = roleCache.get(key);
        if (cached && Date.now() - cached.at < ROLE_TTL_MS) {
          token.role = cached.role;               // cache hit — no DB
        } else {
          let role = token.role;
          try {
            const { getProfile } = await import('./users');
            const p = await getProfile(token.email);
            // p === null means the account was DELETED — revoke the session's
            // capabilities (role null fails every API guard) instead of
            // coasting on the last-known role until the JWT expires.
            role = p === null ? null : (p?.role || role);
          } catch { /* keep the last known role on transient DB errors */ }
          token.role = role;
          roleCache.set(key, { role, at: Date.now() });
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: { signIn: '/login', error: '/login' },
  // Cap how long a stolen/forgotten session stays valid.
  session: { maxAge: 7 * 24 * 60 * 60 },
  // Use the SAME secret as the middleware — see lib/auth-config.js
  secret: NEXTAUTH_SECRET,
};
