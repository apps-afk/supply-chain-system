// Shared by both server-side auth options AND the Edge middleware.
// Keep this file Edge-runtime-safe — no node:crypto, no fs, no DB imports.
//
// CRITICAL: in production we refuse to authenticate without an explicit
// secret. A baked-in fallback would let anyone with the source forge
// sessions. The check fires lazily on first request rather than at module
// load because `next build` evaluates these files with NODE_ENV=production
// but no runtime env vars present.
const DEV_FALLBACK = 'ie-sc-dev-only-secret-do-not-use-in-prod';
const _envSecret = process.env.NEXTAUTH_SECRET;
// NEXT_PHASE is set during `next build`. At true runtime (no NEXT_PHASE) a
// missing secret in production is fatal — we refuse to sign sessions with
// the dev fallback, which anyone with source access could forge.
if (
  !_envSecret &&
  process.env.NODE_ENV === 'production' &&
  !process.env.NEXT_PHASE
) {
  throw new Error(
    'NEXTAUTH_SECRET is required in production. Set it in Vercel env vars.'
  );
}
export const NEXTAUTH_SECRET = _envSecret || DEV_FALLBACK;
