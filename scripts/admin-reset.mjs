/**
 * One-shot account password reset, run from the GitHub Actions workflow
 * "Admin password reset (manual)". Reads production credentials from the
 * env file `vercel pull` writes, bcrypt-hashes the temp password supplied
 * as a workflow input, and updates the user's row via the Supabase REST API.
 *
 * The password itself is NEVER printed to the log.
 */
import fs from 'node:fs';
import bcrypt from 'bcryptjs';

function parseEnvFile(path) {
  const out = {};
  for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const ENV_FILE = '.vercel/.env.production.local';
if (!fs.existsSync(ENV_FILE)) {
  console.error(`missing ${ENV_FILE} — did "vercel pull --environment=production" run?`);
  process.exit(1);
}
const env = parseEnvFile(ENV_FILE);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_KEY not found in pulled env');
  process.exit(1);
}

const email = String(process.env.TARGET_EMAIL || 'pasit@initialestate.com').toLowerCase().trim();
const password = process.env.TEMP_PASSWORD || '';
if (!email.endsWith('@initialestate.com')) {
  console.error('target email must be @initialestate.com');
  process.exit(1);
}
if (password.length < 10) {
  console.error('TEMP_PASSWORD must be at least 10 characters');
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

const hash = bcrypt.hashSync(password, 10);

// Does the account exist?
const q = `${URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,email,role`;
const rGet = await fetch(q, { headers });
if (!rGet.ok) { console.error('lookup failed:', rGet.status, await rGet.text()); process.exit(1); }
const rows = await rGet.json();

if (rows.length > 0) {
  const r = await fetch(`${URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ hash, salt: '', verified: true }),
  });
  if (!r.ok) { console.error('update failed:', r.status, await r.text()); process.exit(1); }
  console.log(`✓ password reset for ${email} (role: ${rows[0].role}) — log in with the temp password and CHANGE IT immediately (ตั้งค่า → บัญชีของฉัน)`);
} else {
  // Account never registered — create it as admin (this is the workspace
  // owner's declared address; the workflow is manual + repo-gated).
  const r = await fetch(`${URL}/rest/v1/users`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      id: `u_${Date.now()}`,
      email, name: email.split('@')[0], phone: '',
      role: 'admin', verified: true, hash, salt: '',
    }),
  });
  if (!r.ok) { console.error('create failed:', r.status, await r.text()); process.exit(1); }
  console.log(`✓ account created for ${email} with role admin — log in with the temp password and CHANGE IT immediately`);
}
