// Workspace-wide settings, kept on globalThis so all API routes share state.
// In production with multi-instance deploys, persist this to Vercel KV / DB.

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
  ai: {
    defaultModel: 'claude-haiku-4-5',
    autoEvaluateOnUpload: true,
    recomputeOnRequirementChange: true,
    explanationLevel: 'medium', // 'short' | 'medium' | 'detailed'
    showConfidence: false,
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

function ensureGlobals() {
  if (!globalThis.__ieWorkspace) {
    globalThis.__ieWorkspace = JSON.parse(JSON.stringify(DEFAULTS));
  }
  if (!globalThis.__ieDsar) {
    // Seed a small backlog so the UI looks lived-in
    globalThis.__ieDsar = [
      { id: 'dsar_001', applicantEmail: 'somchai@example.com', type: 'access',  status: 'pending', createdAt: NOW(), resolvedAt: null, note: 'ขอดูข้อมูลส่วนตัวทั้งหมด' },
      { id: 'dsar_002', applicantEmail: 'wichai@example.com', type: 'delete',  status: 'pending', createdAt: NOW(), resolvedAt: null, note: 'ขอลบข้อมูลทั้งหมด' },
      { id: 'dsar_003', applicantEmail: 'malee@example.com',  type: 'export',  status: 'pending', createdAt: NOW(), resolvedAt: null, note: 'ขอ export ข้อมูล' },
    ];
  }
  if (!globalThis.__ieAuditLog) {
    globalThis.__ieAuditLog = [];
  }
}

export function getSettings() {
  ensureGlobals();
  return globalThis.__ieWorkspace;
}

export function updateSettings(patch) {
  ensureGlobals();
  const cur = globalThis.__ieWorkspace;
  for (const key of Object.keys(patch || {})) {
    if (patch[key] && typeof patch[key] === 'object' && !Array.isArray(patch[key])) {
      cur[key] = { ...(cur[key] || {}), ...patch[key] };
    } else {
      cur[key] = patch[key];
    }
  }
  return cur;
}

export function appendAudit(entry) {
  ensureGlobals();
  globalThis.__ieAuditLog.push({ ...entry, timestamp: NOW() });
  // Trim by retention
  const days = globalThis.__ieWorkspace?.security?.auditLogRetentionDays || 365;
  const cutoff = Date.now() - days * 86400000;
  globalThis.__ieAuditLog = globalThis.__ieAuditLog.filter(e =>
    new Date(e.timestamp).getTime() >= cutoff
  );
}

export function getAuditLog(limit = 100) {
  ensureGlobals();
  return globalThis.__ieAuditLog.slice(-limit).reverse();
}

/* ====== DSAR (Data Subject Access Request) queue ====== */

export function getDsarQueue() {
  ensureGlobals();
  return globalThis.__ieDsar;
}

export function getDsarStats() {
  ensureGlobals();
  const list = globalThis.__ieDsar;
  const pending = list.filter(d => d.status === 'pending').length;
  const resolved = list.filter(d => d.status === 'resolved' && d.resolvedAt);
  let avgDays = 4; // sensible default for display
  if (resolved.length) {
    const totalMs = resolved.reduce((acc, d) =>
      acc + (new Date(d.resolvedAt) - new Date(d.createdAt)), 0);
    avgDays = Math.max(1, Math.round(totalMs / resolved.length / 86400000));
  }
  return { pending, resolved: resolved.length, avgDays };
}

export function resolveDsar(id, resolvedBy) {
  ensureGlobals();
  const r = globalThis.__ieDsar.find(d => d.id === id);
  if (!r) throw new Error('ไม่พบคำขอ');
  r.status = 'resolved';
  r.resolvedAt = NOW();
  r.resolvedBy = resolvedBy;
  appendAudit({ actor: resolvedBy, action: 'dsar.resolve', target: id });
  return r;
}

export function createDsar({ applicantEmail, type, note }) {
  ensureGlobals();
  if (!['access', 'export', 'correct', 'delete'].includes(type)) {
    throw new Error('ประเภทคำขอไม่ถูกต้อง');
  }
  const newReq = {
    id: `dsar_${Date.now()}`,
    applicantEmail, type, note: note || '',
    status: 'pending', createdAt: NOW(), resolvedAt: null,
  };
  globalThis.__ieDsar.push(newReq);
  return newReq;
}

/* ====== Sub-processors registry (read-only meta) ====== */

export const SUB_PROCESSORS = [
  {
    code: 'anthropic',
    name: 'Anthropic Claude API',
    purpose: 'ให้คะแนน AI และเตรียมข้อมูลก่อนนำเสนอ',
    region: 'สหรัฐฯ',
    note: 'ข้อมูลไม่ถูกใช้ฝึกโมเดล',
  },
  {
    code: 'aws-s3',
    name: 'Amazon S3 (ap-southeast-1)',
    purpose: 'เก็บไฟล์เอกสารและใบเสนอราคา',
    region: 'สิงคโปร์',
    note: '',
  },
  {
    code: 'postmark',
    name: 'Postmark',
    purpose: 'อีเมลธุรกรรม (แจ้งเตือน, OTP, รีเซ็ตรหัสผ่าน)',
    region: 'สหรัฐฯ',
    note: '',
  },
];
