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
      // Persist role from the authorize() return value into the JWT
      if (user) {
        token.role = user.role;
        token.roleCheckedAt = Date.now();
        return token;
      }
      // Refresh the role from the user store every 5 minutes so an admin's
      // role change takes effect without forcing a re-login (JWTs otherwise
      // pin the role for their whole 30-day life).
      const STALE_MS = 5 * 60 * 1000;
      if (token.email && (!token.roleCheckedAt || Date.now() - token.roleCheckedAt > STALE_MS)) {
        try {
          const { getProfile } = await import('./users');
          const p = await getProfile(token.email);
          if (p?.role) token.role = p.role;
        } catch { /* keep the cached role on transient DB errors */ }
        token.roleCheckedAt = Date.now();
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
