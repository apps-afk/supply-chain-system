// Sliding-window in-memory rate limiter for auth endpoints.
//
// Serverless caveat: state is per-instance (globalThis), so the effective
// ceiling is limit × instances — still enough to blunt brute force and
// registration spam, with zero infra. Swap for Upstash/Redis if the app
// ever needs a hard global limit.
const store = globalThis.__ieRateLimit ?? (globalThis.__ieRateLimit = new Map());

export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  const hits = (store.get(key) || []).filter(t => now - t < windowMs);
  if (hits.length >= limit) { store.set(key, hits); return false; }
  hits.push(now);
  store.set(key, hits);
  if (store.size > 5000) {
    for (const [k, v] of store) {
      if (!v.some(t => now - t < windowMs)) store.delete(k);
    }
  }
  return true;
}

// Client IP for rate-limit keys. On Vercel, `x-real-ip` and the LAST hop of
// `x-forwarded-for` are set by the platform edge and can't be spoofed by the
// client; a client-supplied `x-forwarded-for` only prepends hops. We prefer
// x-real-ip, then the last XFF hop, so header spoofing can't rotate the key.
export function clientKey(request) {
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const fwd = request.headers.get('x-forwarded-for') || '';
  const hops = fwd.split(',').map(s => s.trim()).filter(Boolean);
  return hops.length ? hops[hops.length - 1] : 'unknown';
}
