import { withAuth } from 'next-auth/middleware';
import { NEXTAUTH_SECRET } from './lib/auth-config';

// We MUST pass the same secret used to sign the JWT in lib/auth.js.
// next-auth/middleware's default behaviour reads only process.env.NEXTAUTH_SECRET
// — if that env var isn't set in Vercel, our fallback gets ignored and the
// middleware bounces every request back to /login → infinite redirect loop.
export default withAuth({
  secret: NEXTAUTH_SECRET,
  pages: { signIn: '/login' },
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon\\.ico|login).*)'],
};
