import { createHash } from 'crypto';

function hash(salt, password) {
  return createHash('sha256').update(salt + password).digest('hex');
}

export const ROLES = [
  { value: 'admin',       label: 'ผู้ดูแลระบบ' },
  { value: 'hr_manager',  label: 'ผู้จัดการ HR' },
  { value: 'procurement', label: 'ฝ่ายจัดซื้อ' },
  { value: 'accountant',  label: 'ฝ่ายบัญชี' },
  { value: 'manager',     label: 'ผู้จัดการ' },
  { value: 'user',        label: 'ผู้ใช้งานทั่วไป' },
];

export function roleLabel(value) {
  return ROLES.find(r => r.value === value)?.label || value || '—';
}

const NOW = () => new Date().toISOString();

// Built-in accounts — always available, no database needed
// Change these passwords via ADMIN_PASSWORD env var in production
const BUILTIN = [
  {
    id: 'admin',
    name: 'Admin',
    email: 'admin@initialestate.com',
    phone: '',
    role: 'admin',
    salt: 'ie_admin_salt_2025',
    hash: hash('ie_admin_salt_2025', process.env.ADMIN_PASSWORD || 'Admin1234!'),
    createdAt: '2025-01-01T00:00:00.000Z',
    verified: true,
    lastLogin: null,
  },
];

// In-memory registered users — attached to globalThis so all API routes share
// the same array. Without this, Next.js dev mode (and production with multiple
// route bundles) gives each route its own users.js instance and registered
// users disappear when you call a different endpoint.
//
// PRODUCTION NOTE: this still resets when the Vercel serverless function goes
// cold (~5 min idle). For real persistence, wire this up to Vercel KV / Postgres.
if (!globalThis.__ieRegisteredUsers) {
  globalThis.__ieRegisteredUsers = [];
}
if (!globalThis.__ieBuiltinMeta) {
  // Mutable overlay on BUILTIN users: lastLogin, role overrides, etc.
  globalThis.__ieBuiltinMeta = {};
}
const registered  = globalThis.__ieRegisteredUsers;
const builtinMeta = globalThis.__ieBuiltinMeta;

function allUsers() {
  return [
    ...BUILTIN.map(u => {
      const meta = builtinMeta[u.email.toLowerCase()] || {};
      return { ...u, ...meta };
    }),
    ...registered,
  ];
}

function recordLogin(email) {
  const key = email.toLowerCase();
  const r = registered.find(u => u.email.toLowerCase() === key);
  if (r) { r.lastLogin = NOW(); return; }
  builtinMeta[key] = { ...(builtinMeta[key] || {}), lastLogin: NOW() };
}

export async function validateUser(email, password) {
  const user = allUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return null;
  if (hash(user.salt, password) !== user.hash) return null;
  recordLogin(user.email);
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function registerUser(name, email, password) {
  if (allUsers().find(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('อีเมลนี้มีผู้ใช้งานแล้ว');
  }
  const salt = `ie_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const newUser = {
    id: `user_${Date.now()}`,
    name, email, role: 'user',
    phone: '',
    salt, hash: hash(salt, password),
    createdAt: NOW(),
    lastLogin: null,
    verified: true,
  };
  registered.push(newUser);
  return { id: newUser.id, email: newUser.email, name: newUser.name };
}

/* ===== Profile updates by the user themselves ===== */

const DOMAIN = 'initialestate.com';

export async function updateProfile(currentEmail, patch) {
  const key = currentEmail.toLowerCase();
  const r = registered.find(u => u.email.toLowerCase() === key);
  const builtin = BUILTIN.find(b => b.email.toLowerCase() === key);
  const target = r || builtin;
  if (!target) throw new Error('ไม่พบบัญชีผู้ใช้');

  let emailChanged = false;
  if (patch.email != null && patch.email.toLowerCase() !== key) {
    if (builtin) throw new Error('ไม่สามารถเปลี่ยนอีเมลของบัญชีระบบได้');
    if (!patch.email.toLowerCase().endsWith(`@${DOMAIN}`)) {
      throw new Error(`อีเมลใหม่ต้องเป็น @${DOMAIN}`);
    }
    if (allUsers().find(u => u.email.toLowerCase() === patch.email.toLowerCase())) {
      throw new Error('อีเมลนี้มีผู้ใช้งานแล้ว');
    }
    emailChanged = true;
  }

  if (r) {
    if (patch.name  !== undefined) r.name  = patch.name;
    if (patch.phone !== undefined) r.phone = patch.phone;
    if (emailChanged) r.email = patch.email.toLowerCase();
  } else if (builtin) {
    builtinMeta[key] = builtinMeta[key] || {};
    if (patch.name  !== undefined) builtinMeta[key].name  = patch.name;
    if (patch.phone !== undefined) builtinMeta[key].phone = patch.phone;
  }

  return { emailChanged };
}

/* ===== Forced reset (no old-password check) ===== */
// Used when the logged-in user clicks "forgot current password" — since we
// already authenticated them via session cookie, we trust them to set a new one.

export async function forceResetPassword(email, newPassword) {
  const u = registered.find(r => r.email.toLowerCase() === email.toLowerCase());
  if (u) {
    u.salt = `ie_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    u.hash = hash(u.salt, newPassword);
    return true;
  }
  const builtin = BUILTIN.find(b => b.email.toLowerCase() === email.toLowerCase());
  if (builtin) {
    throw new Error('บัญชีระบบเปลี่ยนรหัสผ่านได้ผ่านตัวแปร ADMIN_PASSWORD ใน Vercel เท่านั้น');
  }
  throw new Error('ไม่พบบัญชีผู้ใช้');
}

export async function updatePassword(email, oldPassword, newPassword) {
  const u = registered.find(r => r.email.toLowerCase() === email.toLowerCase());
  if (u) {
    if (hash(u.salt, oldPassword) !== u.hash) {
      throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }
    u.salt = `ie_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    u.hash = hash(u.salt, newPassword);
    return true;
  }
  const builtin = BUILTIN.find(b => b.email.toLowerCase() === email.toLowerCase());
  if (builtin) {
    throw new Error('บัญชีระบบเปลี่ยนรหัสผ่านได้ผ่านตัวแปร ADMIN_PASSWORD ใน Vercel เท่านั้น');
  }
  throw new Error('ไม่พบบัญชีผู้ใช้');
}

/* ===== Admin functions ===== */

export async function listUsers() {
  return allUsers().map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone || '',
    role: u.role,
    createdAt: u.createdAt || null,
    lastLogin: u.lastLogin || null,
    verified: u.verified !== false,
    isBuiltin: !!BUILTIN.find(b => b.email.toLowerCase() === u.email.toLowerCase()),
  }));
}

/* Get one user's profile for the My-Account page */
export async function getProfile(email) {
  const key = email.toLowerCase();
  const u = allUsers().find(x => x.email.toLowerCase() === key);
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone || '',
    role: u.role,
    createdAt: u.createdAt || null,
    isBuiltin: !!BUILTIN.find(b => b.email.toLowerCase() === key),
  };
}

export async function updateUserRole(email, newRole) {
  if (!ROLES.find(r => r.value === newRole)) {
    throw new Error('บทบาทไม่ถูกต้อง');
  }
  const r = registered.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (r) { r.role = newRole; return true; }
  const builtin = BUILTIN.find(b => b.email.toLowerCase() === email.toLowerCase());
  if (builtin) {
    const key = email.toLowerCase();
    builtinMeta[key] = { ...(builtinMeta[key] || {}), role: newRole };
    return true;
  }
  throw new Error('ไม่พบบัญชีผู้ใช้');
}

export async function deleteUser(email) {
  const builtin = BUILTIN.find(b => b.email.toLowerCase() === email.toLowerCase());
  if (builtin) {
    throw new Error('ไม่สามารถลบบัญชีระบบได้');
  }
  const idx = registered.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) throw new Error('ไม่พบบัญชีผู้ใช้');
  registered.splice(idx, 1);
  return true;
}

export async function adminCreateUser(name, email, password, role = 'user') {
  if (allUsers().find(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('อีเมลนี้มีผู้ใช้งานแล้ว');
  }
  if (!ROLES.find(r => r.value === role)) {
    throw new Error('บทบาทไม่ถูกต้อง');
  }
  const salt = `ie_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const newUser = {
    id: `user_${Date.now()}`,
    name, email, role,
    salt, hash: hash(salt, password),
    createdAt: NOW(),
    lastLogin: null,
    verified: true,
  };
  registered.push(newUser);
  return { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role };
}

export async function adminResetPassword(email, newPassword) {
  const r = registered.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (r) {
    r.salt = `ie_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    r.hash = hash(r.salt, newPassword);
    return true;
  }
  throw new Error('ไม่สามารถรีเซ็ตรหัสผ่านของบัญชีระบบได้ — ตั้งผ่าน ADMIN_PASSWORD');
}
