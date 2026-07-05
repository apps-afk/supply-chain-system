import { supabase, isSupabaseConfigured } from './supabase';

const NOW = () => new Date().toISOString();

const DEFAULTS = {
  org: {
    name: 'Initial Estate',
    domain: 'initialestate.com',
    country: 'Thailand',
    currency: 'THB',
    language: 'th',
    timezone: 'Asia/Bangkok',
    logoUrl: null,
  },
  // AI assist (contract review + price-comparison analysis). Only settings
  // that are actually enforced live here — the model, whether contract AI
  // runs automatically on upload, and how verbose the answers are.
  ai: {
    defaultModel: 'claude-opus-4-8',
    autoEvaluateOnUpload: true,
    explanationLevel: 'medium',
  },
  security: {
    require2FA: false,
    maskPII: true,
    watermarkDownloads: true,
    sessionTimeoutHours: 8,
    maxBulkExport: 100,
    ipAllowlist: '',
    auditLogRetentionDays: 365,
    restrictedFieldsBlock: true,
  },
  aiUsage: {
    monthlyTokenBudget: 10000000,
    allowTrainingData: false,
    requireHumanReview: true,
    blockExternalProviders: true,
    dataResidency: 'สหรัฐฯ (Anthropic) / สิงคโปร์ (S3)',
  },
  privacy: {
    dsarResponseDays: 30,
    rtbfDays: 30,
    consentVersion: '2025-05-01',
  },
};

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

function ensureMem() {
  if (!globalThis.__ieWorkspace) globalThis.__ieWorkspace = deepClone(DEFAULTS);
  if (!globalThis.__ieDsar) globalThis.__ieDsar = [];
  if (!globalThis.__ieAuditLog) globalThis.__ieAuditLog = [];
}

/* ============================================================
   Settings
   ============================================================ */

export async function getSettings() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('workspace_settings').select('settings').eq('id', 'default').maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.settings) {
      // Merge with defaults so newly-added keys still appear
      return mergeDefaults(data.settings);
    }
    // Seed defaults on first run
    await supabase.from('workspace_settings')
      .upsert({ id: 'default', settings: DEFAULTS }, { onConflict: 'id' });
    return deepClone(DEFAULTS);
  }
  ensureMem();
  return globalThis.__ieWorkspace;
}

function mergeDefaults(s) {
  const merged = deepClone(DEFAULTS);
  for (const key of Object.keys(s || {})) {
    if (s[key] && typeof s[key] === 'object' && !Array.isArray(s[key])) {
      merged[key] = { ...(merged[key] || {}), ...s[key] };
    } else {
      merged[key] = s[key];
    }
  }
  return merged;
}

export async function updateSettings(patch) {
  const current = await getSettings();
  for (const key of Object.keys(patch || {})) {
    if (patch[key] && typeof patch[key] === 'object' && !Array.isArray(patch[key])) {
      current[key] = { ...(current[key] || {}), ...patch[key] };
    } else {
      current[key] = patch[key];
    }
  }
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('workspace_settings')
      .upsert({ id: 'default', settings: current }, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  } else {
    ensureMem();
    globalThis.__ieWorkspace = current;
  }
  return current;
}

// Server-private keys stored inside the settings blob that must NEVER leave
// the server (TOTP secrets) or be written by a client PATCH (usage counters).
export const PRIVATE_SETTINGS_KEYS = ['totp'];
export const SERVER_ONLY_SETTINGS_KEYS = ['totp', 'aiUsageMeter'];

export function stripPrivateSettings(settings) {
  const out = { ...(settings || {}) };
  for (const k of PRIVATE_SETTINGS_KEYS) delete out[k];
  return out;
}

/* ============================================================
   2FA (TOTP) enrollment store — lives under settings.totp:
     { [emailLower]: { secret, enabled, enabledAt, pendingSecret } }
   No users-table migration needed; the service-role-only settings row is
   as protected as the users table, and every API path strips this key.
   ============================================================ */

export async function getTotp(email) {
  const s = await getSettings();
  return (s.totp || {})[String(email || '').toLowerCase()] || null;
}

export async function setTotp(email, entry) {
  const key = String(email || '').toLowerCase();
  const s = await getSettings();
  const totp = { ...(s.totp || {}) };
  if (entry === null) delete totp[key];
  else totp[key] = { ...(totp[key] || {}), ...entry };
  return updateSettings({ totp });
}

/* ============================================================
   AI usage meter — monthly token counter under settings.aiUsageMeter:
     { month: 'YYYY-MM', tokens: N }
   Written only by the server after each model call; the admin page reads
   it to show spend vs the configured monthly budget.
   ============================================================ */

export async function recordAiUsage(tokens) {
  const n = Number(tokens) || 0;
  if (n <= 0) return;
  const month = new Date().toISOString().slice(0, 7);
  const s = await getSettings();
  const cur = s.aiUsageMeter && s.aiUsageMeter.month === month
    ? Number(s.aiUsageMeter.tokens) || 0 : 0;
  await updateSettings({ aiUsageMeter: { month, tokens: cur + n } });
}

export async function getAiUsage() {
  const month = new Date().toISOString().slice(0, 7);
  const s = await getSettings();
  const used = s.aiUsageMeter && s.aiUsageMeter.month === month
    ? Number(s.aiUsageMeter.tokens) || 0 : 0;
  return { month, tokens: used, budget: Number(s.aiUsage?.monthlyTokenBudget) || 0 };
}

/* ============================================================
   Audit log
   ============================================================ */

export async function appendAudit(entry) {
  const e = { ...entry, timestamp: NOW() };
  if (isSupabaseConfigured) {
    await supabase.from('audit_log').insert({
      actor: e.actor || 'system',
      action: e.action || 'unknown',
      target: e.target || null,
      metadata: { changes: e.changes },
      timestamp: e.timestamp,
    }).then(({ error }) => { if (error) console.error('audit insert:', error.message); });
    pruneAuditLog().catch(() => {});
    return;
  }
  ensureMem();
  globalThis.__ieAuditLog.push(e);
}

// Enforce security.auditLogRetentionDays: opportunistically delete entries
// older than the configured window, at most once per hour per instance so
// the hot path never pays for it twice.
async function pruneAuditLog() {
  if (!isSupabaseConfigured) return;
  const now = Date.now();
  if (globalThis.__ieAuditPrunedAt && now - globalThis.__ieAuditPrunedAt < 60 * 60 * 1000) return;
  globalThis.__ieAuditPrunedAt = now;
  try {
    const s = await getSettings();
    const days = Number(s.security?.auditLogRetentionDays) || 365;
    const cutoff = new Date(now - days * 86400000).toISOString();
    const { error } = await supabase.from('audit_log').delete().lt('timestamp', cutoff);
    if (error) console.error('audit prune:', error.message);
  } catch (e) {
    console.error('audit prune:', e.message);
  }
}

export async function getAuditLog(limit = 100) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('audit_log').select('*').order('timestamp', { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map(r => ({
      actor: r.actor, action: r.action, target: r.target,
      timestamp: r.timestamp, ...r.metadata,
    }));
  }
  ensureMem();
  return globalThis.__ieAuditLog.slice(-limit).reverse();
}

/* ============================================================
   DSAR queue
   ============================================================ */

function dsarFromRow(r) {
  return {
    id: r.id,
    applicantEmail: r.applicant_email,
    type: r.type,
    status: r.status,
    note: r.note || '',
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    resolvedBy: r.resolved_by,
  };
}

export async function getDsarQueue() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('dsar_requests').select('*').order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map(dsarFromRow);
  }
  ensureMem();
  return globalThis.__ieDsar;
}

export async function getDsarStats() {
  const list = await getDsarQueue();
  const pending = list.filter(d => d.status === 'pending').length;
  const resolved = list.filter(d => d.status === 'resolved' && d.resolvedAt);
  let avgDays = 4;
  if (resolved.length) {
    const totalMs = resolved.reduce((acc, d) =>
      acc + (new Date(d.resolvedAt) - new Date(d.createdAt)), 0);
    avgDays = Math.max(1, Math.round(totalMs / resolved.length / 86400000));
  }
  return { pending, resolved: resolved.length, avgDays };
}

export async function resolveDsar(id, resolvedBy) {
  const resolvedAt = NOW();
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('dsar_requests')
      .update({ status: 'resolved', resolved_at: resolvedAt, resolved_by: resolvedBy })
      .eq('id', id).select().maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('ไม่พบคำขอ');
    await appendAudit({ actor: resolvedBy, action: 'dsar.resolve', target: id });
    return dsarFromRow(data);
  }
  ensureMem();
  const r = globalThis.__ieDsar.find(d => d.id === id);
  if (!r) throw new Error('ไม่พบคำขอ');
  r.status = 'resolved'; r.resolvedAt = resolvedAt; r.resolvedBy = resolvedBy;
  await appendAudit({ actor: resolvedBy, action: 'dsar.resolve', target: id });
  return r;
}

export async function createDsar({ applicantEmail, type, note }) {
  if (!['access', 'export', 'correct', 'delete'].includes(type)) {
    throw new Error('ประเภทคำขอไม่ถูกต้อง');
  }
  const newReq = {
    id: `dsar_${Date.now()}`,
    applicantEmail, type, note: note || '',
    status: 'pending', createdAt: NOW(), resolvedAt: null,
  };
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('dsar_requests').insert({
      id: newReq.id, applicant_email: applicantEmail, type, status: 'pending',
      note: newReq.note, created_at: newReq.createdAt,
    });
    if (error) throw new Error(error.message);
  } else {
    ensureMem();
    globalThis.__ieDsar.push(newReq);
  }
  return newReq;
}

/* ============================================================
   Sub-processors registry (static — same in all modes)
   ============================================================ */
export const SUB_PROCESSORS = [
  { code: 'anthropic', name: 'Anthropic Claude API',         purpose: 'ให้คะแนน AI และเตรียมข้อมูลก่อนนำเสนอ', region: 'สหรัฐฯ',    note: 'ข้อมูลไม่ถูกใช้ฝึกโมเดล' },
  { code: 'aws-s3',    name: 'Amazon S3 (ap-southeast-1)',   purpose: 'เก็บไฟล์เอกสารและใบเสนอราคา',            region: 'สิงคโปร์',   note: '' },
  { code: 'postmark',  name: 'Postmark',                     purpose: 'อีเมลธุรกรรม (แจ้งเตือน, OTP, รีเซ็ต)',  region: 'สหรัฐฯ',    note: '' },
];
