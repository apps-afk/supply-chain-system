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

// In-memory registered users (survives the Node process lifetime on Vercel)
const registered = [];

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
