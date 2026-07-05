/**
 * TOTP (RFC 6238) with plain Node crypto — no external auth service needed.
 * Compatible with Google Authenticator / Microsoft Authenticator / Authy /
 * 1Password (SHA-1, 6 digits, 30-second step — the de-facto standard).
 */
import crypto from 'crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateSecret(bytes = 20) {
  const buf = crypto.randomBytes(bytes);
  let bits = 0, value = 0, out = '';
  for (const b of buf) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

function hotp(secretB32, counter) {
  const key = base32Decode(secretB32);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = h[h.length - 1] & 0x0f;
  const code = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

/**
 * Verify a 6-digit code, accepting the previous/next 30s window to absorb
 * clock drift. Constant-time compare so timing can't leak digits.
 */
export function verifyTOTP(secretB32, code, { stepSeconds = 30, window = 1 } = {}) {
  const c = String(code || '').replace(/\D/g, '');
  if (c.length !== 6 || !secretB32) return false;
  const counter = Math.floor(Date.now() / 1000 / stepSeconds);
  for (let i = -window; i <= window; i++) {
    const expect = hotp(secretB32, counter + i);
    if (crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(c))) return true;
  }
  return false;
}

export function otpauthURL({ secret, email, issuer = 'Initial Estate Supply Chain' }) {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret, issuer, algorithm: 'SHA1', digits: '6', period: '30',
  });
  return `otpauth://totp/${label}?${params}`;
}
