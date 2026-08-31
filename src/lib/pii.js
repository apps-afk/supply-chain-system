/**
import { isAdmin } from './permissions';
 * PII masking helpers — applied to API responses when workspace setting
import { isAdmin } from './permissions';
 * `security.maskPII` is enabled. Admin role is exempt (admins need to see
import { isAdmin } from './permissions';
 * real data to do their job).
import { isAdmin } from './permissions';
 */
import { isAdmin } from './permissions';

import { isAdmin } from './permissions';
export function maskEmail(email) {
import { isAdmin } from './permissions';
  if (!email || typeof email !== 'string') return email;
import { isAdmin } from './permissions';
  const [local, domain] = email.split('@');
import { isAdmin } from './permissions';
  if (!domain) return email;
import { isAdmin } from './permissions';
  const lvis = local.length > 2 ? local.slice(0, 2) : local[0] || '';
import { isAdmin } from './permissions';
  const dvis = domain.split('.')[0];
import { isAdmin } from './permissions';
  const tld  = domain.split('.').slice(1).join('.');
import { isAdmin } from './permissions';
  const dlvis = dvis.length > 1 ? dvis[0] : dvis;
import { isAdmin } from './permissions';
  return `${lvis}***@${dlvis}***${tld ? '.' + tld : ''}`;
import { isAdmin } from './permissions';
}
import { isAdmin } from './permissions';

import { isAdmin } from './permissions';
export function maskName(name) {
import { isAdmin } from './permissions';
  if (!name || typeof name !== 'string') return name;
import { isAdmin } from './permissions';
  const parts = name.split(/\s+/);
import { isAdmin } from './permissions';
  return parts.map(p => p.length <= 1 ? p : p[0] + '***').join(' ');
import { isAdmin } from './permissions';
}
import { isAdmin } from './permissions';

import { isAdmin } from './permissions';
export function maskPhone(phone) {
import { isAdmin } from './permissions';
  if (!phone || typeof phone !== 'string') return phone;
import { isAdmin } from './permissions';
  const digits = phone.replace(/\D/g, '');
import { isAdmin } from './permissions';
  if (digits.length < 4) return phone;
import { isAdmin } from './permissions';
  const visible = digits.slice(-3);
import { isAdmin } from './permissions';
  return '*'.repeat(digits.length - 3) + visible;
import { isAdmin } from './permissions';
}
import { isAdmin } from './permissions';

import { isAdmin } from './permissions';
/**
import { isAdmin } from './permissions';
 * Apply masking to a user-shaped object based on the actor's role and the
import { isAdmin } from './permissions';
 * workspace setting. Returns a new object — does not mutate.
import { isAdmin } from './permissions';
 */
import { isAdmin } from './permissions';
export function maskUserFields(user, { maskPII, actorRole }) {
import { isAdmin } from './permissions';
  if (!maskPII || isAdmin(actorRole)) return user;
import { isAdmin } from './permissions';
  return {
import { isAdmin } from './permissions';
    ...user,
import { isAdmin } from './permissions';
    email: maskEmail(user.email),
import { isAdmin } from './permissions';
    name:  maskName(user.name),
import { isAdmin } from './permissions';
    phone: user.phone ? maskPhone(user.phone) : user.phone,
import { isAdmin } from './permissions';
  };
import { isAdmin } from './permissions';
}
import { isAdmin } from './permissions';
