import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { supabase, isSupabaseConfigured } from './supabase';

// Legacy scheme: single-round SHA-256(salt+password) — fast to brute-force.
// New hashes use bcrypt (cost 10) and are recognizable by their $2 prefix.
// verifyPassword() accepts both and transparently upgrades legacy hashes to
// bcrypt on the next successful login.
function hash(salt, password) {
  return createHash('sha256').update(salt + password).digest('hex');
}
function makeHash(password) {
  return bcrypt.hashSync(password, 10);
}
function checkPassword(user, password) {
  if (typeof user?.hash === 'string' && user.hash.startsWith('$2')) {
    return bcrypt.compareSync(password, user.hash);
  }
  return hash(user.salt, password) === user.hash;
}
const NOW = () => new Date().toISOString();

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

/* ============================================================
   BUILTIN admin — exists as code, never stored in DB.
   Password derived from ADMIN_PASSWORD env var (default Admin1234!).
   ============================================================ */
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
    isBuiltin: true,
  },
];

/* ============================================================
   Storage adapter — Supabase if configured, else in-memory.
   In-memory state lives on globalThis so all API routes share it.
   ============================================================ */

if (!globalThis.__ieRegisteredUsers) globalThis.__ieRegisteredUsers = [];
if (!globalThis.__ieBuiltinMeta)     globalThis.__ieBuiltinMeta     = {};
const memRegistered = globalThis.__ieRegisteredUsers;
const memBuiltinMeta = globalThis.__ieBuiltinMeta;

const DB_COLS = 'id, email, name, phone, role, salt, hash, verified, created_at, last_login';

function fromRow(row) {
  if (!row) return null;
  return {
    id:         row.id,
    email:      row.email,
    name:       row.name,
    phone:      row.phone || '',
    role:       row.role,
    salt:       row.salt,
    hash:       row.hash,
    verified:   row.verified !== false,
    createdAt:  row.created_at,
    lastLogin:  row.last_login,
    isBuiltin:  false,
  };
}

async function findByEmail(emailLower) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('users')
      .select(DB_COLS)
      .ilike('email', emailLower)
      .maybeSingle();
    if (error) throw new Error(`DB error: ${error.message}`);
    return fromRow(data);
  }
  const u = memRegistered.find(r => r.email.toLowerCase() === emailLower);
  return u ? { ...u, isBuiltin: false } : null;
}

async function listRegistered() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('users').select(DB_COLS).order('created_at', { ascending: true });
    if (error) throw new Error(`DB error: ${error.message}`);
    return (data || []).map(fromRow);
  }
  return memRegistered.map(u => ({ ...u, isBuiltin: false }));
}

async function insertUser(u) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('users').insert({
      id: u.id, email: u.email, name: u.name, phone: u.phone || '',
      role: u.role, salt: u.salt, hash: u.hash, verified: u.verified !== false,
      created_at: u.createdAt, last_login: u.lastLogin,
    });
    if (error) throw new Error(error.message);
    return;
  }
  memRegistered.push({ ...u });
}

async function updateUser(emailLower, patch) {
  if (isSupabaseConfigured) {
    const dbPatch = {};
    if (patch.name      !== undefined) dbPatch.name      = patch.name;
    if (patch.phone     !== undefined) dbPatch.phone     = patch.phone;
    if (patch.email     !== undefined) dbPatch.email     = patch.email;
    if (patch.role      !== undefined) dbPatch.role      = patch.role;
    if (patch.salt      !== undefined) dbPatch.salt      = patch.salt;
    if (patch.hash      !== undefined) dbPatch.hash      = patch.hash;
    if (patch.lastLogin !== undefined) dbPatch.last_login = patch.lastLogin;
    const { error } = await supabase.from('users').update(dbPatch).ilike('email', emailLower);
    if (error) throw new Error(error.message);
    return;
  }
  const u = memRegistered.find(r => r.email.toLowerCase() === emailLower);
  if (!u) return;
  Object.assign(u, patch);
}

async function deleteByEmail(emailLower) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('users').delete().ilike('email', emailLower);
    if (error) throw new Error(error.message);
    return;
  }
  const idx = memRegistered.findIndex(r => r.email.toLowerCase() === emailLower);
  if (idx !== -1) memRegistered.splice(idx, 1);
}

/* ============================================================
   Public API
   ============================================================ */

function applyBuiltinMeta(u) {
  const meta = memBuiltinMeta[u.email.toLowerCase()] || {};
  return { ...u, ...meta };
}

export async function validateUser(email, password) {
  const key = email.toLowerCase();

  // BUILTIN first — never hits DB
  const b = BUILTIN.find(u => u.email.toLowerCase() === key);
  if (b) {
    if (hash(b.salt, password) !== b.hash) return null;
    memBuiltinMeta[key] = { ...(memBuiltinMeta[key] || {}), lastLogin: NOW() };
    return { id: b.id, email: b.email, name: b.name, role: (memBuiltinMeta[key]?.role || b.role) };
  }

  const u = await findByEmail(key);
  if (!u) return null;
  if (!checkPassword(u, password)) return null;
  // Transparent upgrade: legacy SHA-256 hashes get re-written as bcrypt on
  // a successful login, so the weak hashes age out without user action.
  const upgrade = (typeof u.hash === 'string' && !u.hash.startsWith('$2'))
    ? { hash: makeHash(password), salt: '' }
    : {};
  await updateUser(key, { lastLogin: NOW(), ...upgrade }).catch(() => {});
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

export async function registerUser(name, email, password) {
  const key = email.toLowerCase();
  if (BUILTIN.find(b => b.email.toLowerCase() === key)) {
    throw new Error('อีเมลนี้มีผู้ใช้งานแล้ว');
  }
  if (await findByEmail(key)) {
    throw new Error('อีเมลนี้มีผู้ใช้งานแล้ว');
  }
  const newUser = {
    id: `user_${Date.now()}`,
    name, email: key, role: 'user', phone: '',
    salt: '', hash: makeHash(password),
    createdAt: NOW(), lastLogin: null, verified: true,
  };
  await insertUser(newUser);
  return { id: newUser.id, email: newUser.email, name: newUser.name };
}

export async function updatePassword(email, oldPassword, newPassword) {
  const key = email.toLowerCase();
  if (BUILTIN.find(b => b.email.toLowerCase() === key)) {
    throw new Error('บัญชีระบบเปลี่ยนรหัสผ่านได้ผ่านตัวแปร ADMIN_PASSWORD ใน Vercel เท่านั้น');
  }
  const u = await findByEmail(key);
  if (!u) throw new Error('ไม่พบบัญชีผู้ใช้');
  if (!checkPassword(u, oldPassword)) {
    throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
  }
  await updateUser(key, { salt: '', hash: makeHash(newPassword) });
  return true;
}

const DOMAIN = 'initialestate.com';

export async function updateProfile(currentEmail, patch) {
  const key = currentEmail.toLowerCase();
  const builtin = BUILTIN.find(b => b.email.toLowerCase() === key);
  const u = builtin ? null : await findByEmail(key);
  if (!builtin && !u) throw new Error('ไม่พบบัญชีผู้ใช้');

  let emailChanged = false;
  if (patch.email != null && patch.email.toLowerCase() !== key) {
    if (builtin) throw new Error('ไม่สามารถเปลี่ยนอีเมลของบัญชีระบบได้');
    if (!patch.email.toLowerCase().endsWith(`@${DOMAIN}`)) {
      throw new Error(`อีเมลใหม่ต้องเป็น @${DOMAIN}`);
    }
    const conflict = await findByEmail(patch.email.toLowerCase());
    if (conflict || BUILTIN.find(b => b.email.toLowerCase() === patch.email.toLowerCase())) {
      throw new Error('อีเมลนี้มีผู้ใช้งานแล้ว');
    }
    emailChanged = true;
  }

  if (builtin) {
    memBuiltinMeta[key] = memBuiltinMeta[key] || {};
    if (patch.name  !== undefined) memBuiltinMeta[key].name  = patch.name;
    if (patch.phone !== undefined) memBuiltinMeta[key].phone = patch.phone;
  } else {
    const dbPatch = {};
    if (patch.name      !== undefined) dbPatch.name  = patch.name;
    if (patch.phone     !== undefined) dbPatch.phone = patch.phone;
    if (emailChanged)                  dbPatch.email = patch.email.toLowerCase();
    // PostgREST rejects an empty update({}) — skip when nothing changed.
    if (Object.keys(dbPatch).length > 0) await updateUser(key, dbPatch);
  }
  return { emailChanged };
}

export async function forceResetPassword(email, newPassword) {
  const key = email.toLowerCase();
  if (BUILTIN.find(b => b.email.toLowerCase() === key)) {
    throw new Error('บัญชีระบบเปลี่ยนรหัสผ่านได้ผ่านตัวแปร ADMIN_PASSWORD ใน Vercel เท่านั้น');
  }
  const u = await findByEmail(key);
  if (!u) throw new Error('ไม่พบบัญชีผู้ใช้');
  await updateUser(key, { salt: '', hash: makeHash(newPassword) });
  return true;
}

/* ===== Admin functions ===== */

export async function listUsers() {
  const reg = await listRegistered();
  // Strip credential material before this ever reaches a route handler —
  // password hashes/salts must never be serialized to the browser, even
  // for admins.
  return [...BUILTIN.map(applyBuiltinMeta), ...reg].map(
    ({ hash, salt, password, ...safe }) => safe
  );
}

export async function getProfile(email) {
  const key = email.toLowerCase();
  const b = BUILTIN.find(u => u.email.toLowerCase() === key);
  if (b) {
    const u = applyBuiltinMeta(b);
    return {
      id: u.id, name: u.name, email: u.email, phone: u.phone || '',
      role: u.role, createdAt: u.createdAt, isBuiltin: true,
    };
  }
  const u = await findByEmail(key);
  if (!u) return null;
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone || '',
    role: u.role, createdAt: u.createdAt, isBuiltin: false,
  };
}

// Drop the auth role cache for one email so a role change is reflected on
// the next request served by THIS instance (other instances refresh within
// the TTL). Shares the globalThis key set in lib/auth.js.
function bustRoleCache(emailLower) {
  try { globalThis.__ieRoleCache?.delete(emailLower); } catch {}
}

export async function updateUserRole(email, newRole) {
  if (!ROLES.find(r => r.value === newRole)) throw new Error('บทบาทไม่ถูกต้อง');
  const key = email.toLowerCase();
  const builtin = BUILTIN.find(b => b.email.toLowerCase() === key);
  if (builtin) {
    memBuiltinMeta[key] = { ...(memBuiltinMeta[key] || {}), role: newRole };
    bustRoleCache(key);
    return true;
  }
  const u = await findByEmail(key);
  if (!u) throw new Error('ไม่พบบัญชีผู้ใช้');
  await updateUser(key, { role: newRole });
  bustRoleCache(key);
  return true;
}

export async function deleteUser(email) {
  const key = email.toLowerCase();
  if (BUILTIN.find(b => b.email.toLowerCase() === key)) {
    throw new Error('ไม่สามารถลบบัญชีระบบได้');
  }
  const u = await findByEmail(key);
  if (!u) throw new Error('ไม่พบบัญชีผู้ใช้');
  await deleteByEmail(key);
  bustRoleCache(key);
  return true;
}

export async function adminCreateUser(name, email, password, role = 'user') {
  if (!ROLES.find(r => r.value === role)) throw new Error('บทบาทไม่ถูกต้อง');
  const key = email.toLowerCase();
  if (BUILTIN.find(b => b.email.toLowerCase() === key) || await findByEmail(key)) {
    throw new Error('อีเมลนี้มีผู้ใช้งานแล้ว');
  }
  const u = {
    id: `user_${Date.now()}`,
    name, email: key, role, phone: '',
    salt: '', hash: makeHash(password),
    createdAt: NOW(), lastLogin: null, verified: true,
  };
  await insertUser(u);
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

export async function adminResetPassword(email, newPassword) {
  const key = email.toLowerCase();
  if (BUILTIN.find(b => b.email.toLowerCase() === key)) {
    throw new Error('ไม่สามารถรีเซ็ตรหัสผ่านของบัญชีระบบได้ — ตั้งผ่าน ADMIN_PASSWORD');
  }
  const u = await findByEmail(key);
  if (!u) throw new Error('ไม่พบบัญชีผู้ใช้');
  await updateUser(key, { salt: '', hash: makeHash(newPassword) });
  return true;
}
