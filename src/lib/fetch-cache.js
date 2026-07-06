'use client';
/**
 * Tiny module-scope fetch cache for MASTER data (units, suppliers, projects,
 * categories, types, …) — the tables every screen needs for dropdowns but
 * that change rarely. Screens are hash-routed and unmount on navigation, so
 * without this each navigation refires the same 5-11 full-table GETs.
 *
 *   const d = await fetchCachedJSON('/api/units');          // {items:[...]}
 *   invalidateCache('/api/units');                          // after mutation
 *   invalidateCache();                                      // nuke everything
 *
 * Design notes:
 *  - Caches the parsed JSON body per exact URL for TTL ms (default 90s).
 *  - In-flight de-dup: concurrent callers share one request (dashboard and
 *    the notification bell both hitting /api/contracts costs one fetch).
 *  - Non-OK responses and network errors are NEVER cached.
 *  - DOCUMENT tables (rfqs/comparisons/contracts/purchase-orders/prices)
 *    should generally keep using plain fetch() — freshness matters there.
 */

const store = new Map();   // url → { at, promise }

const DEFAULT_TTL = 90 * 1000;

export function fetchCachedJSON(url, { ttlMs = DEFAULT_TTL } = {}) {
  const now = Date.now();
  const hit = store.get(url);
  if (hit && now - hit.at < ttlMs) return hit.promise;

  const promise = fetch(url)
    .then(async r => {
      if (!r.ok) {
        store.delete(url);                     // don't cache failures
        // Mimic the shape screens expect from a failed .json() path
        const body = await r.json().catch(() => ({}));
        return Promise.reject(Object.assign(new Error(body.error || `HTTP ${r.status}`), { status: r.status }));
      }
      return r.json();
    })
    .catch(e => { store.delete(url); throw e; });

  store.set(url, { at: now, promise });
  return promise;
}

// Convenience wrapper matching the common `fetch(url).then(r=>r.json())`
// call sites: resolves to `{}` on any failure instead of rejecting.
export function fetchCachedSafe(url, opts) {
  return fetchCachedJSON(url, opts).catch(() => ({}));
}

// Drop-in replacement for `fetch(url)` call sites that then check `.ok` and
// call `.json()` — lets screens adopt the cache with a one-word change.
export function cachedFetch(url, opts) {
  return fetchCachedJSON(url, opts)
    .then(data => ({ ok: true, status: 200, json: async () => data }))
    .catch(e => ({ ok: false, status: e?.status || 0, json: async () => ({ error: e?.message || 'โหลดไม่สำเร็จ' }) }));
}

export function invalidateCache(prefix) {
  if (!prefix) { store.clear(); return; }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
