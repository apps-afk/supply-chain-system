// Shared by both server-side auth options AND the Edge middleware.
// Keep this file Edge-runtime-safe — no node:crypto, no fs, no DB imports.
export const NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ||
  'ie-sc-fallback-secret-set-NEXTAUTH_SECRET-in-vercel';
