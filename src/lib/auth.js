import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { validateUser } from './users';

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
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        return Boolean(user.email?.toLowerCase().endsWith(`@${DOMAIN}`));
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.sub;
      return session;
    },
  },
  pages: { signIn: '/login', error: '/login' },
  // Fallback so the app works before NEXTAUTH_SECRET is set in Vercel.
  // In production, set NEXTAUTH_SECRET to a random 32+ char string.
  secret: process.env.NEXTAUTH_SECRET || 'ie-sc-fallback-secret-set-NEXTAUTH_SECRET-in-vercel',
};
