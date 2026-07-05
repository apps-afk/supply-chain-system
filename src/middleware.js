import { NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';
import { NEXTAUTH_SECRET } from './lib/auth-config';
import { UNAUTHORIZED_MESSAGE } from './lib/auth-messages';

// We MUST pass the same secret used to sign the JWT in lib/auth.js.
// next-auth/middleware's default behaviour reads only process.env.NEXTAUTH_SECRET
// — if that env var isn't set in Vercel, our fallback gets ignored and the
// middleware bounces every request back to /login → infinite redirect loop.
const pageAuth = withAuth({
  secret: NEXTAUTH_SECRET,
  pages: { signIn: '/login' },
});

// API navigation block (API_implement spec, Phase 4): typing an /api URL into
// the address bar (or opening it in a new tab) must return 401 JSON — even
// for a logged-in user. Browsers mark real navigations with the forgery-proof
// `sec-fetch-dest: document` header; the app's own fetch() calls carry
// `sec-fetch-dest: empty` and <img> carries `image`, so normal usage is
// untouched. curl/scripts send no sec-fetch headers → fall through to the
// handlers' own session checks.
function isBrowserNavigation(req) {
  const dest = req.headers.get('sec-fetch-dest');
  if (dest) return dest === 'document';
  // legacy browsers without sec-fetch-*: a navigation asks for text/html
  return (req.headers.get('accept') ?? '').includes('text/html');
}

export default function middleware(req, event) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/')) {
    // NextAuth must stay navigable (OAuth callbacks, signin/signout redirects).
    if (pathname.startsWith('/api/auth/')) return NextResponse.next();
    if (isBrowserNavigation(req)) {
      return NextResponse.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 });
    }
    return NextResponse.next(); // handlers enforce their own session checks
  }

  // Pages keep the existing signed-in requirement.
  return pageAuth(req, event);
}

export const config = {
  // /api/* now passes THROUGH the middleware (for the navigation block above);
  // static assets, favicon, and /login stay excluded.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|login).*)'],
};
