// Shared by both server-side auth options AND the Edge middleware.
// Keep this file Edge-runtime-safe — no node:crypto, no fs, no DB imports,
// and NO throws at module-load (Edge middleware would fail every request).
//
// Production deploys MUST set NEXTAUTH_SECRET in Vercel env vars. If it's
// missing we log a loud warning at module load and fall back to a known
// string so the app still boots — but tokens signed with the fallback are
// trivially forgeable, treat that as a deployment misconfiguration.
const DEV_FALLBACK = 'ie-sc-dev-only-secret-do-not-use-in-prod';
const _envSecret = process.env.NEXTAUTH_SECRET;
if (!_envSecret && process.env.NODE_ENV === 'production') {
  // eslint-disable-next-line no-console
  console.error('[auth] NEXTAUTH_SECRET is not set — using insecure dev fallback. Set NEXTAUTH_SECRET in Vercel env vars.');
}
export const NEXTAUTH_SECRET = _envSecret || DEV_FALLBACK;
