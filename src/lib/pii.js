/**
 * PII masking helpers — applied to API responses when workspace setting
 * `security.maskPII` is enabled. Admin role is exempt (admins need to see
 * real data to do their job).
 */

export function maskEmail(email) {
  if (!email || typeof email !== 'string') return email;
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const lvis = local.length > 2 ? local.slice(0, 2) : local[0] || '';
  const dvis = domain.split('.')[0];
  const tld  = domain.split('.').slice(1).join('.');
  const dlvis = dvis.length > 1 ? dvis[0] : dvis;
  return `${lvis}***@${dlvis}***${tld ? '.' + tld : ''}`;
}

export function maskName(name) {
  if (!name || typeof name !== 'string') return name;
  const parts = name.split(/\s+/);
  return parts.map(p => p.length <= 1 ? p : p[0] + '***').join(' ');
}

export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  const visible = digits.slice(-3);
  return '*'.repeat(digits.length - 3) + visible;
}

/**
 * Apply masking to a user-shaped object based on the actor's role and the
 * workspace setting. Returns a new object — does not mutate.
 */
export function maskUserFields(user, { maskPII, actorRole }) {
  if (!maskPII || actorRole === 'admin') return user;
  return {
    ...user,
    email: maskEmail(user.email),
    name:  maskName(user.name),
    phone: user.phone ? maskPhone(user.phone) : user.phone,
  };
}
