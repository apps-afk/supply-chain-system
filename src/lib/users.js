import { createHash } from 'crypto';

function hash(salt, password) {
  return createHash('sha256').update(salt + password).digest('hex');
}

// Built-in accounts — always available, no database needed
// Change these passwords via ADMIN_PASSWORD env var in production
const BUILTIN = [
  {
    id: 'admin',
    name: 'Admin',
    email: 'admin@initialestate.com',
    role: 'admin',
    salt: 'ie_admin_salt_2025',
    hash: hash('ie_admin_salt_2025', process.env.ADMIN_PASSWORD || 'Admin1234!'),
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
const registered = globalThis.__ieRegisteredUsers;

export async function validateUser(email, password) {
  const all = [...BUILTIN, ...registered];
  const user = all.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return null;
  if (hash(user.salt, password) !== user.hash) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function registerUser(name, email, password) {
  const all = [...BUILTIN, ...registered];
  if (all.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('อีเมลนี้มีผู้ใช้งานแล้ว');
  }
  const salt = `ie_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const newUser = {
    id: `user_${Date.now()}`,
    name, email, role: 'user',
    salt, hash: hash(salt, password),
  };
  registered.push(newUser);
  return { id: newUser.id, email: newUser.email, name: newUser.name };
}

export async function updatePassword(email, oldPassword, newPassword) {
  // Registered users: update salt + hash in place
  const u = registered.find(r => r.email.toLowerCase() === email.toLowerCase());
  if (u) {
    if (hash(u.salt, oldPassword) !== u.hash) {
      throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }
    u.salt = `ie_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    u.hash = hash(u.salt, newPassword);
    return true;
  }
  // BUILTIN admin password is derived from ADMIN_PASSWORD env var, so we
  // can't persist a change here at runtime.
  const builtin = BUILTIN.find(b => b.email.toLowerCase() === email.toLowerCase());
  if (builtin) {
    throw new Error('บัญชีระบบเปลี่ยนรหัสผ่านได้ผ่านตัวแปร ADMIN_PASSWORD ใน Vercel เท่านั้น');
  }
  throw new Error('ไม่พบบัญชีผู้ใช้');
}
