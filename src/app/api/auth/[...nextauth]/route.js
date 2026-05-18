import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { validateUser } from '../../../../lib/users';

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

// Google provider only loads when credentials are configured
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
  // Fallback secret lets the app work before NEXTAUTH_SECRET is configured in Vercel
  secret: process.env.NEXTAUTH_SECRET || 'ie-sc-fallback-secret-set-NEXTAUTH_SECRET-in-vercel',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
