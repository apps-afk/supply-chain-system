import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

const ALLOWED_DOMAIN = 'initialestate.com';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          hd: ALLOWED_DOMAIN,
          prompt: 'select_account',
        },
      },
    }),
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'อีเมล', type: 'email' },
        password: { label: 'รหัสผ่าน', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        if (!credentials.email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
          throw new Error('AccessDenied');
        }
        // TODO: replace with real user/password validation against your database
        // For now: any @initialestate.com email passes domain check
        return {
          id: credentials.email,
          email: credentials.email,
          name: credentials.email.split('@')[0].replace(/[._]/g, ' '),
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        return Boolean(user.email?.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`));
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.sub;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
