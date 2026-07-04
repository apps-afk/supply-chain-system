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

// Best-effort client key for unauthenticated endpoints.
export function clientKey(request) {
  const fwd = request.headers.get('x-forwarded-for') || '';
  return fwd.split(',')[0].trim() || 'unknown';
}
