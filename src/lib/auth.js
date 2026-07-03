import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { validateUser } from './users';
import { NEXTAUTH_SECRET } from './auth-config';

const DOMAIN = 'initialestate.com';

const providers = [
  CredentialsProvider({
    name: 'Email',
    credentials: {
      email:    { label: 'อีเมล',    type: 'email'    },
      password: { label: 'รหัสผ่าน', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;
      // Defense in depth: explicit domain check, even though validateUser
      // only returns users from BUILTIN/registered (both go through the
      // domain check at write-time) — guards against future provider changes.
      if (!credentials.email.toLowerCase().endsWith(`@${DOMAIN}`)) {
        throw new Error(`อนุญาตเฉพาะบัญชี @${DOMAIN} เท่านั้น`);
      }
      const user = await validateUser(credentials.email, credentials.password);
      if (!user) throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
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
      if (user) {
        token.role = user.role;
        if (token.email) roleCache.set(token.email.toLowerCase(), { role: user.role, at: Date.now() });
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
            if (p?.role) role = p.role;
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
  // Use the SAME secret as the middleware — see lib/auth-config.js
  secret: NEXTAUTH_SECRET,
};
