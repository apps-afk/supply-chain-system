'use client';

// Shared alert derivation — one source of truth for "งานที่ต้องทำ" so the
// dashboard todo list and the topbar notification bell never disagree.
//
// buildAlerts() is pure: give it raw API rows, get back plain alert objects
//   { id, icon, tone, text, screen, storeKey, storeVal }
// Callers turn them into nav closures:
//   localStorage.setItem(a.storeKey, a.storeVal); go(a.screen);

// Same decimal-aware parser as screen-contract.jsx parseWarrantyDays — keep
// the two in lockstep so dashboard/bell agree with the contract screen.
export function warrantyDays(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();
  let days = 0;
  const yr = t.match(/(\d+(?:\.\d+)?)\s*(?:ปี|year)/);
  const mo = t.match(/(\d+(?:\.\d+)?)\s*(?:เดือน|month)/);
  const dy = t.match(/(\d+(?:\.\d+)?)\s*(?:วัน|day)/);
  if (yr) days += parseFloat(yr[1]) * 365;
  if (mo) days += parseFloat(mo[1]) * 30;
  if (dy) days += parseFloat(dy[1]);
  days = Math.round(days);
  return days > 0 ? days : null;
}

export function retentionInfo(c) {
  if (c?.retention_released_at) return { released: true, daysLeft: Infinity };
  const wd = warrantyDays(c?.warranty);
  const baseStr = c?.end_date || c?.signed_at;
  if (!wd || !baseStr) return null;
  const base = new Date(baseStr);
  if (Number.isNaN(base.getTime())) return null;
  const release = new Date(base.getTime() + wd * 86400000);
  const daysLeft = Math.round((release - new Date()) / 86400000);
  return { release, daysLeft };
}

function fmtD(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return iso; }
}

export function buildAlerts({ rfqs = [], contracts = [], comparisons = [], signRoles = [], canApprove = false, forgotPending = 0 } = {}) {
  const out = [];
  const today = new Date().toLocaleDateString('sv-SE'); // local YYYY-MM-DD

  // Forgot-password requests waiting on an admin (there is no SMTP — a human
  // must reset and hand back the password, so surface it prominently).
  if (forgotPending > 0) {
    out.push({
      id: `forgot-pending-${forgotPending}`, icon: '🔑', tone: 'var(--clay)',
      text: `มีคำขอลืมรหัสผ่านค้างอยู่ ${forgotPending} รายการ — รีเซ็ตให้ที่หน้า ทีมงานและสิทธิ์`,
      screen: 'settings-workspace', storeKey: 'noop', storeVal: '1',
    });
  }

  for (const r of rfqs) {
    if (r.status === 'sent' && r.due_date && r.due_date < today) {
      out.push({
        id: `rfq-overdue-${r.id}`, icon: '⏰', tone: 'var(--clay)',
        text: `RFQ ${r.no} เกินกำหนดเสนอราคา (${fmtD(r.due_date)})`,
        screen: 'rfq-confirm', storeKey: 'rfq.currentId', storeVal: r.id,
      });
    } else if (r.status === 'received') {
      out.push({
        id: `rfq-received-${r.id}`, icon: '📥', tone: 'var(--moss)',
        text: `RFQ ${r.no} ได้รับ Quote แล้ว — รอตรวจสอบ/บันทึก Price DB`,
        screen: 'rfq-confirm', storeKey: 'rfq.currentId', storeVal: r.id,
      });
    }
  }

  for (const c of contracts) {
    if (c.status !== 'active') continue;
    const info = retentionInfo(c);
    if (!info || info.released) continue;
    if (info.daysLeft <= 0) {
      out.push({
        id: `ret-due-${c.id}`, icon: '💰', tone: 'var(--clay)',
        text: `${c.no || c.title} — ครบกำหนดคืนเงินประกันแล้ว (${fmtD(info.release.toISOString())})`,
        screen: 'contract', storeKey: 'contract.currentId', storeVal: c.id,
      });
    } else if (info.daysLeft <= 30) {
      out.push({
        id: `ret-soon-${c.id}`, icon: '🔔', tone: 'var(--ochre)',
        text: `${c.no || c.title} — เงินประกันครบกำหนดในอีก ${info.daysLeft} วัน`,
        screen: 'contract', storeKey: 'contract.currentId', storeVal: c.id,
      });
    }
  }

  // Comparisons waiting on my approval — only meaningful for approver roles.
  if (canApprove && signRoles.length > 0) {
    for (const cmp of comparisons) {
      if (cmp.status !== 'draft') continue;
      const approvals = Array.isArray(cmp.approvals_json) ? cmp.approvals_json : [];
      if (approvals.length >= signRoles.length) continue;
      const done = new Set(approvals.map(a => a.level));
      const next = signRoles.find(r => !done.has(r.level));
      out.push({
        id: `cmp-approve-${cmp.id}-${approvals.length}`, icon: '🖋️', tone: 'var(--teal-ink)',
        text: `${cmp.no} รออนุมัติ${next ? ` — ลำดับถัดไป: ${next.name}` : ''} (${approvals.length}/${signRoles.length})`,
        screen: 'compare-detail', storeKey: 'cmp.currentId', storeVal: cmp.id,
      });
    }
  }

  return out;
}
