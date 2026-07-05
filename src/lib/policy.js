/**
 * Enforcement helpers for workspace security policy (settings.security).
 *
 * getPolicy() returns the full settings object through a 60s per-instance
 * cache so requireAuth() can consult policy on EVERY api call without a DB
 * round-trip each time. publicPolicy() is the whitelisted, non-secret subset
 * exposed to any logged-in client (export guards, watermark, AI auto-run).
 */
import { getSettings } from './workspace';

const TTL_MS = 60 * 1000;

export async function getPolicy() {
  const now = Date.now();
  const c = globalThis.__iePolicyCache;
  if (c && now - c.at < TTL_MS) return c.settings;
  const settings = await getSettings();
  globalThis.__iePolicyCache = { settings, at: now };
  return settings;
}

// Call after an admin saves settings so the new policy applies immediately
// on this instance instead of up to 60s later.
export function invalidatePolicyCache() {
  globalThis.__iePolicyCache = null;
}

// The subset of settings any logged-in user may read (no IP lists, no 2FA
// data, no budgets) — just what client-side enforcement needs.
export function publicPolicy(settings) {
  const sec = settings.security || {};
  const ai = settings.ai || {};
  const org = settings.org || {};
  return {
    maskPII: !!sec.maskPII,
    watermarkDownloads: !!sec.watermarkDownloads,
    restrictedFieldsBlock: !!sec.restrictedFieldsBlock,
    maxBulkExport: Number(sec.maxBulkExport) || 0,
    autoEvaluateOnUpload: !!ai.autoEvaluateOnUpload,
    org: { name: org.name || '', logoUrl: org.logoUrl || null },
  };
}

/* ============================================================
   IP allowlist matching — entries are comma-separated IPv4 addresses or
   IPv4 CIDR ranges ("203.0.113.45, 198.51.100.0/24"). Non-IPv4 entries
   (e.g. IPv6) match by exact string compare.
   ============================================================ */

function ipv4ToInt(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip || '').trim());
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some(p => p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function parseAllowlist(str) {
  return String(str || '').split(',').map(s => s.trim()).filter(Boolean);
}

// Validate one entry; returns true if it's an IPv4, IPv4/CIDR, or IPv6-ish
// literal we can match on. Used by the settings PATCH validator.
export function isValidAllowlistEntry(entry) {
  const e = String(entry || '').trim();
  if (!e) return false;
  const slash = e.indexOf('/');
  if (slash !== -1) {
    const bits = Number(e.slice(slash + 1));
    return ipv4ToInt(e.slice(0, slash)) !== null &&
           Number.isInteger(bits) && bits >= 0 && bits <= 32;
  }
  if (ipv4ToInt(e) !== null) return true;
  // Loose IPv6 literal (contains ':' and only hex/colon chars)
  return /^[0-9a-fA-F:]+$/.test(e) && e.includes(':');
}

export function ipMatchesEntry(ip, entry) {
  const e = String(entry || '').trim();
  if (!e) return false;
  const slash = e.indexOf('/');
  if (slash === -1) return e === String(ip || '').trim();
  const base = ipv4ToInt(e.slice(0, slash));
  const bits = Number(e.slice(slash + 1));
  const addr = ipv4ToInt(ip);
  if (base === null || addr === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (addr & mask) === (base & mask);
}

export function ipAllowed(ip, allowlistStr) {
  const entries = parseAllowlist(allowlistStr);
  if (entries.length === 0) return true;            // empty list = no restriction
  if (!ip || ip === 'unknown') {
    // No platform IP header (local dev / tests) — don't lock the door on a
    // signal we don't have. On Vercel x-real-ip is always present.
    return process.env.NODE_ENV !== 'production';
  }
  return entries.some(e => ipMatchesEntry(ip, e));
}
