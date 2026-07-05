'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Icons, Av, money } from '../lib/shell';
import { SettingsSearchBox } from '../lib/settings-shared';
import { usePermissions } from '../lib/use-permissions';
import { useTableView, Th, Pager, exportCSV } from '../lib/table-utils';
import { PO_STATUS } from './screen-po';
/*
  Contract module — upload-driven manual review workflow.

  Wired to /api/contracts, /api/upload (Google Drive), /api/attachments.

  DB statuses: draft | active | expired | terminated
  UI workflow phases (visual prototype):
    Uploaded → Reviewing → Reviewed → Legal → Final
  Mapping for the 5-stat pipeline at the top of the list:
    draft     → Uploaded  (just uploaded, awaiting manual review)
    active    → Final     (signed & in use)
    expired   → Final     (still considered "done")
    terminated→ (no bucket — shown in raw status filter)
  Reviewing/Reviewed/Legal are intermediate workflow states we don't yet
  persist in the DB schema; counts will show 0 until we add a meta column.

  Routes:
    #contract        → list
    #contract-detail → detail (workflow prototype + real header data)
*/

/* =================== Constants =================== */

// UI buckets for the 5-card pipeline at the top of the list page.
const CT_STATUS = {
  Uploaded:  { bg:'#F0E4C5',             fg:'#6B5121',             dot:'var(--ochre)', label:'รอตรวจสอบ' },
  Reviewing: { bg:'var(--teal-soft)',    fg:'var(--teal-ink)',     dot:'var(--teal)',  label:'กำลังตรวจสอบ' },
  Reviewed:  { bg:'#DEE7E3',             fg:'#1F4D40',             dot:'var(--teal)',  label:'ตรวจสอบแล้ว' },
  Legal:     { bg:'var(--chip-recv-bg)', fg:'var(--chip-recv-fg)', dot:'var(--ochre)', label:'รอกฎหมาย' },
  Final:     { bg:'var(--moss-soft)',    fg:'#2F4A1A',             dot:'var(--moss)',  label:'Final · ใช้งานได้' },
};

// DB status → UI bucket
const DB_TO_BUCKET = {
  draft:      'Uploaded',
  active:     'Final',
  expired:    'Final',
  terminated: null,
};

// Pretty label for DB status filter pills
const DB_STATUS_LABEL = {
  draft:      'ร่าง · รอตรวจ',
  active:     'ใช้งานอยู่',
  expired:    'หมดอายุ',
  terminated: 'ยกเลิก',
};

// Lifecycle chips for statuses past the review pipeline — muted gray for
// expired, clay for terminated (same danger accent as delete actions).
const DB_STATUS_CHIP = {
  expired:    { bg:'var(--paper-2)', fg:'var(--ink-3)', dot:'var(--ink-4)', label: DB_STATUS_LABEL.expired },
  terminated: { bg:'#FDE8E4',        fg:'#8B2A1A',      dot:'var(--clay)',  label: DB_STATUS_LABEL.terminated },
};

// Chip style for a raw DB status — lifecycle chip first, then the workflow
// bucket chip, then a neutral fallback.
function statusChip(status) {
  if (DB_STATUS_CHIP[status]) return DB_STATUS_CHIP[status];
  const bucket = DB_TO_BUCKET[status];
  if (bucket && CT_STATUS[bucket]) return CT_STATUS[bucket];
  return { bg:'var(--paper-2)', fg:'var(--ink-3)', dot:'var(--ink-4)', label: DB_STATUS_LABEL[status] || status || '—' };
}

// Manual review checklist — สิ่งที่ฝ่ายจัดซื้อต้องตรวจก่อนส่งต่อ
const REVIEW_CHECKLIST = [
  { key:'party',     label:'คู่สัญญาถูกต้อง (ชื่อ Supplier ตรงกับเอกสาร)' },
  { key:'amount',    label:'วงเงินตรงตามที่ตกลง' },
  { key:'guarantee', label:'มีเงื่อนไขค้ำประกัน / เงินประกันผลงาน' },
  { key:'dates',     label:'วันที่เริ่มต้น–สิ้นสุดครบถ้วน' },
];

// =================== Helpers ===================

// Generate a contract number like CT-2026-4731
function generateContractNo() {
  const year = new Date().getFullYear();
  const rnd  = Math.floor(1000 + Math.random() * 9000);
  return `CT-${year}-${rnd}`;
}

// Generate an RFQ-style number (used in upload modal preview)
/**
 * Parse a free-text warranty string into approximate days.
 * Handles common Thai + English patterns like "1 ปี", "6 เดือน", "365 วัน",
 * "2 years", or combined "1 ปี 6 เดือน". Returns null if nothing parseable.
 */
function parseWarrantyDays(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();
  let days = 0;
  // Decimal-aware: "1.5 ปี" must read 1.5, not pick up the "5" next to ปี.
  const yr = t.match(/(\d+(?:\.\d+)?)\s*(?:ปี|year)/);
  const mo = t.match(/(\d+(?:\.\d+)?)\s*(?:เดือน|month)/);
  const dy = t.match(/(\d+(?:\.\d+)?)\s*(?:วัน|day)/);
  if (yr) days += parseFloat(yr[1]) * 365;
  if (mo) days += parseFloat(mo[1]) * 30;
  if (dy) days += parseFloat(dy[1]);
  days = Math.round(days);
  return days > 0 ? days : null;
}

/**
 * Compute retention release status for a contract: when can the supplier
 * come back and reclaim their retention money?
 * Base date = end_date (work handover) — falling back to signed_at only when
 * no end date is recorded. Counting from signing would mark retention "due"
 * while the work is still ongoing.
 * Returns { state: 'due' | 'soon' | 'pending' | 'unknown', releaseDate, daysLeft }
 */
function retentionStatus(contract) {
  // Already closed out — released beats every other state.
  if (contract?.retention_released_at) {
    return { state: 'released', releasedAt: contract.retention_released_at };
  }
  const warrantyDays = parseWarrantyDays(contract?.warranty);
  const baseStr = contract?.end_date || contract?.signed_at;
  if (!warrantyDays || !baseStr) return { state: 'unknown' };
  const base = new Date(baseStr);
  if (Number.isNaN(base.getTime())) return { state: 'unknown' };
  const release = new Date(base.getTime() + warrantyDays * 86400000);
  const now = new Date();
  const daysLeft = Math.round((release - now) / 86400000);
  let state = 'pending';
  if (daysLeft <= 0) state = 'due';
  else if (daysLeft <= 30) state = 'soon';
  return { state, releaseDate: release, daysLeft };
}

/**
 * Parse contracts.notes — the column holds either legacy free text (memo)
 * or an RFQ-style JSON payload:
 *   { workflow: { phase, checks, legal:{to,note,sentAt,by} }, memo:'<free text>' }
 * Plain-text / unparseable notes are treated as memo and never overwritten
 * with raw JSON on screen.
 * Returns { workflow: object|null, memo: string, payload: object|null }.
 */
function parseContractNotes(notes) {
  if (!notes) return { workflow: null, memo: '', payload: null };
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        workflow: parsed.workflow || null,
        memo: typeof parsed.memo === 'string' ? parsed.memo : '',
        payload: parsed,
      };
    }
    // JSON scalar (e.g. a bare quoted string) — keep the raw text as memo
    return { workflow: null, memo: String(notes), payload: null };
  } catch {
    // Legacy plain-text notes → memo
    return { workflow: null, memo: String(notes), payload: null };
  }
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' });
  } catch { return iso; }
}

/* =================== List =================== */

export function ScreenContractList({ go }) {
  const [contracts, setContracts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [attachmentsByContract, setAttachmentsByContract] = useState({});  // id → [attachment, ...]
  const [contractTypes, setContractTypes] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState('');
  const [q, setQ] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { canWrite, isAdmin } = usePermissions();

  // Close out the retention: stamp released date + who recorded it. The
  // list refreshes so the row flips to "คืนแล้ว" and the dashboard todo
  // for this contract disappears.
  async function releaseRetention(c) {
    if (!confirm(`บันทึกว่าคืนเงินประกันของ "${c.title || c.no}" แล้ว?`)) return;
    try {
      const me = await fetch('/api/account/profile').then(r => r.ok ? r.json() : null).catch(() => null);
      const r = await fetch('/api/contracts', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: c.id,
          retention_released_at: new Date().toLocaleDateString('sv-SE'),
          retention_released_by: me?.profile?.email || me?.email || '',
        }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'บันทึกไม่สำเร็จ'); return; }
      setContracts(cs => cs.map(x => x.id === c.id
        ? { ...x, retention_released_at: new Date().toLocaleDateString('sv-SE') } : x));
    } catch { alert('เครือข่ายขัดข้อง'); }
  }

  async function deleteContract(c, fileCount) {
    const msg = `ลบเอกสาร "${c.title || c.no}"?` +
      (fileCount > 0
        ? `\n\nไฟล์ ${fileCount} ไฟล์ใน Google Drive จะถูกลบไปด้วย (ไม่สามารถกู้คืนได้)`
        : '\n\n(ไม่มีไฟล์แนบ)');
    if (!confirm(msg)) return;
    setDeleting(true);
    try {
      const r = await fetch('/api/contracts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id }),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(`ลบไม่สำเร็จ: ${d.error || 'ไม่ทราบสาเหตุ'}`);
      } else if (d.deleted?.drive_errors?.length) {
        alert(
          `ลบเอกสารสำเร็จ — แต่มี ${d.deleted.drive_errors.length} ไฟล์ใน Drive ที่ลบไม่ออก:\n` +
          d.deleted.drive_errors.join('\n')
        );
      }
      await load();
    } catch (e) {
      alert(`เครือข่ายขัดข้อง: ${e.message}`);
    }
    setDeleting(false);
  }

  async function load() {
    setLoading(true); setErr('');
    try {
      const [rContracts, rSuppliers, rProjects, rTypes, rAtt] = await Promise.all([
        fetch('/api/contracts'),
        fetch('/api/suppliers'),
        fetch('/api/projects'),
        fetch('/api/contract-types'),
        fetch('/api/attachments?entity_type=contract&limit=500'),
      ]);
      const dContracts = await rContracts.json();
      const dSuppliers = await rSuppliers.json();
      const dProjects  = await rProjects.json();
      const dTypes     = await rTypes.json();
      const dAtt       = await rAtt.ok ? await rAtt.json() : { items: [] };

      // Group attachments by contract id, keep most recent first
      const grouped = {};
      for (const a of (dAtt.items || [])) {
        if (!a.entity_id) continue;
        (grouped[a.entity_id] = grouped[a.entity_id] || []).push(a);
      }
      setAttachmentsByContract(grouped);
      if (!rContracts.ok) { setErr(dContracts.error || 'โหลดข้อมูลไม่สำเร็จ'); }
      setContracts(dContracts.items || []);
      setSuppliers(dSuppliers.items || []);
      setProjects(dProjects.items   || []);
      setContractTypes(dTypes.items || []);
    } catch {
      setErr('เครือข่ายขัดข้อง');
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // O(1) name lookups (replaces .find() in every render)
  const supById = useMemo(() => {
    const m = new Map();
    for (const s of suppliers) m.set(s.id, s);
    return m;
  }, [suppliers]);
  const projById = useMemo(() => {
    const m = new Map();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);
  const supName = (id) => supById.get(id)?.name || '—';
  const projName = (id) => projById.get(id)?.name || '—';

  // Contract-type lookup map for O(1) name + retention_pct
  const typeById = useMemo(
    () => new Map(contractTypes.map(t => [t.id, t])),
    [contractTypes],
  );

  const filtered = useMemo(() => {
    const v = q.toLowerCase();
    return contracts.filter(c => {
      if (projectFilter !== 'all' && c.project_id !== projectFilter) return false;
      if (statusFilter  !== 'all' && c.status !== statusFilter) return false;
      if (q) {
        const hit =
          (c.title || '').toLowerCase().includes(v) ||
          (c.no || '').toLowerCase().includes(v) ||
          (supById.get(c.supplier_id)?.name || '').toLowerCase().includes(v) ||
          (projById.get(c.project_id)?.name || '').toLowerCase().includes(v) ||
          (typeById.get(c.type_id)?.name || '').toLowerCase().includes(v);
        if (!hit) return false;
      }
      return true;
    }).map(c => ({
      ...c,
      // Enriched fields so sort + CSV can work on plain row keys
      supplier_name: supById.get(c.supplier_id)?.name || '',
      type_name:     typeById.get(c.type_id)?.name || '',
      amount:        c.amount == null || c.amount === '' ? null : Number(c.amount),
    }));
  }, [contracts, projectFilter, statusFilter, q, supById, projById, typeById]);

  // Client-side sort + pagination over the filtered rows (P3 shared helpers)
  const { view, page, pages, setPage, sortKey, sortDir, toggleSort } =
    useTableView(filtered, { pageSize: 25 });
  const sortProps = { activeKey: sortKey, dir: sortDir, onSort: toggleSort };

  function exportContractsCSV() {
    exportCSV(
      `contracts-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: 'no',            label: 'เลขที่' },
        { key: 'title',         label: 'ชื่อ' },
        { key: 'supplier_name', label: 'Supplier' },
        { key: 'type_name',     label: 'ประเภท' },
        { key: 'amount',        label: 'มูลค่า' },
        { key: c => DB_STATUS_LABEL[c.status] || c.status || '', label: 'สถานะ' },
        { key: 'start_date',    label: 'วันเริ่ม' },
        { key: 'end_date',      label: 'วันสิ้นสุด' },
        { key: 'warranty',      label: 'ประกัน' },
      ],
      filtered,
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Module 4 · เอกสาร</div>
          <h1 className="h-display">เอกสาร</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:640 }}>
            เก็บเอกสารทั้งหมดของบริษัท — สัญญา, ใบเสนอราคา, บันทึกข้อตกลง ฯลฯ
            แต่ละไฟล์อยู่ใน Google Drive และผูกกับโครงการ/คู่สัญญาในระบบ
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" onClick={exportContractsCSV} disabled={filtered.length === 0}>
            {Icons.download} Export CSV
          </button>
          {canWrite && (
            <button className="btn primary" onClick={() => setUploadOpen(true)}>{Icons.upload} อัพโหลดเอกสาร</button>
          )}
        </div>
      </div>

      {/* Filter row — project + search */}
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <label style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:12, color:'var(--ink-3)' }}>โครงการ</span>
          <select
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            style={{
              padding:'6px 28px 6px 10px', borderRadius:6,
              border:'1px solid var(--rule-2)', fontSize:12.5,
              background:'var(--surface)', fontFamily:'var(--font-sans)',
              appearance:'none',
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%236E6859' stroke-width='1.4' stroke-linecap='round'><path d='m3 4.5 3 3 3-3'/></svg>")`,
              backgroundRepeat:'no-repeat', backgroundPosition:'right 8px center',
              minWidth:180,
            }}>
            <option value="all">— ทุกโครงการ —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:12, color:'var(--ink-3)' }}>สถานะ</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding:'6px 28px 6px 10px', borderRadius:6,
              border:'1px solid var(--rule-2)', fontSize:12.5,
              background:'var(--surface)', fontFamily:'var(--font-sans)',
              appearance:'none',
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%236E6859' stroke-width='1.4' stroke-linecap='round'><path d='m3 4.5 3 3 3-3'/></svg>")`,
              backgroundRepeat:'no-repeat', backgroundPosition:'right 8px center',
              minWidth:140,
            }}>
            <option value="all">— ทุกสถานะ —</option>
            {Object.keys(DB_STATUS_LABEL).map(s => (
              <option key={s} value={s}>{DB_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหาชื่อเอกสาร / คู่สัญญา / โครงการ…" />
          <span style={{ fontSize:12, color:'var(--ink-3)' }}>
            <strong style={{ color:'var(--ink)' }}>{filtered.length}</strong> รายการ
          </span>
        </div>
      </div>

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>
      )}

      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <Th sortKey="no" {...sortProps} style={{ width:'12%' }}>ประเภทเอกสาร</Th>
              <Th sortKey="title" {...sortProps}>ชื่อเอกสาร</Th>
              <Th sortKey="supplier_name" {...sortProps}>คู่สัญญา</Th>
              <Th sortKey="amount" {...sortProps} className="num-col">มูลค่าสัญญา</Th>
              <Th sortKey="status" {...sortProps}>สถานะ</Th>
              <Th sortKey="start_date" {...sortProps}>วันเริ่มต้น</Th>
              <Th sortKey="end_date" {...sortProps}>วันสิ้นสุด</Th>
              <th>ระยะเวลารับประกัน</th>
              <th>Retention</th>
              <th style={{ width:80 }}>ไฟล์</th>
              <th style={{ width:40 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล
              </td></tr>
            ) : view.map(c => {
              const supplierName = supName(c.supplier_id);
              const projectName  = projName(c.project_id);
              const type         = typeById.get(c.type_id);
              const atts = attachmentsByContract[c.id] || [];
              const latest = atts[0];
              const ret = retentionStatus(c);
              const retColor = ret.state === 'released' ? '#2F4A1A'
                             : ret.state === 'due' ? '#8B2A1A'
                             : ret.state === 'soon' ? '#6B5121'
                             : ret.state === 'pending' ? 'var(--ink-3)'
                             : 'var(--ink-4)';
              const retLabel = ret.state === 'released'
                  ? `✓ คืนแล้ว ${fmtDate(ret.releasedAt)}`
                : ret.state === 'due'
                  ? `🔔 ถึงกำหนดเก็บคืน${ret.releaseDate ? ` (${fmtDate(ret.releaseDate.toISOString())})` : ''}`
                : ret.state === 'soon'
                  ? `⚠ อีก ${ret.daysLeft} วัน · ${fmtDate(ret.releaseDate.toISOString())}`
                : ret.state === 'pending'
                  ? `อีก ${ret.daysLeft} วัน · ${fmtDate(ret.releaseDate.toISOString())}`
                  : '—';
              return (
                <tr key={c.id} onClick={() => { window.localStorage.setItem('contract.currentId', c.id); go('contract-detail'); }} style={{ cursor:'pointer' }}>
                  <td>
                    <div style={{ fontSize:12.5, fontWeight:500 }}>{type?.name || '—'}</div>
                    <div className="font-mono" style={{ fontSize:10.5, color:'var(--ink-4)', marginTop:2 }}>{c.no}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight:500 }}>{c.title || '—'}</div>
                    <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:2 }}>{projectName}</div>
                  </td>
                  <td>
                    <span style={{ display:'inline-flex', gap:8, alignItems:'center' }}>
                      <Av initials={supplierName.slice(0,2)} kind="default" />
                      <span style={{ fontSize:12.5 }}>{supplierName}</span>
                    </span>
                  </td>
                  <td className="num-col num" style={{ fontWeight:500 }}>{c.amount != null ? money(c.amount) : '—'}</td>
                  <td>
                    {(() => {
                      const st = statusChip(c.status);
                      return (
                        <span style={{
                          display:'inline-flex', alignItems:'center', gap:6,
                          fontSize:11, fontWeight:500, padding:'2px 10px', borderRadius:999,
                          background: st.bg, color: st.fg, whiteSpace:'nowrap',
                        }}>
                          <span style={{ width:6, height:6, borderRadius:999, background: st.dot }} />
                          {st.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ fontSize:12, color:'var(--ink-3)' }}>
                    {c.start_date ? fmtDate(c.start_date) : '—'}
                  </td>
                  <td style={{ fontSize:12, color:'var(--ink-3)' }}>
                    {c.end_date ? fmtDate(c.end_date) : '—'}
                  </td>
                  <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>
                    {c.warranty || <span style={{ color:'var(--ink-4)' }}>—</span>}
                  </td>
                  <td style={{ fontSize:11.5 }}>
                    <div style={{ color:'var(--ink-2)', fontWeight:500 }}>
                      {type?.retention_pct != null ? `${Number(type.retention_pct)}%` : '—'}
                    </div>
                    {ret.state !== 'unknown' && (
                      <div style={{ color: retColor, marginTop:2, fontSize:11 }}>{retLabel}</div>
                    )}
                    {canWrite && (ret.state === 'due' || ret.state === 'soon') && (
                      <button className="btn sm" onClick={e => { e.stopPropagation(); releaseRetention(c); }}
                        style={{ marginTop:6, padding:'2px 8px', fontSize:10.5 }}>
                        บันทึกคืนเงินประกัน
                      </button>
                    )}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {latest && latest.drive_view_link ? (
                      <a href={latest.drive_view_link} target="_blank" rel="noopener noreferrer"
                         style={{ fontSize:11.5, color:'var(--teal)', textDecoration:'none' }}>
                        📄 Drive {atts.length > 1 && `(${atts.length})`}
                      </a>
                    ) : (
                      <span style={{ fontSize:11, color:'var(--ink-4)' }}>—</span>
                    )}
                  </td>
                  <td onClick={e => e.stopPropagation()} style={{ textAlign:'right' }}>
                    {isAdmin && (
                      <button
                        onClick={() => deleteContract(c, atts.length)}
                        title="ลบเอกสาร"
                        style={{
                          background:'none', border:'none', cursor:'pointer',
                          color:'var(--ink-4)', fontSize:16, padding:'4px 6px',
                          borderRadius:4,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#FDE8E4'; e.currentTarget.style.color = 'var(--clay)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-4)'; }}
                      >🗑</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pager page={page} pages={pages} setPage={setPage} total={filtered.length} />
      </div>

      {uploadOpen && (
        <UploadContractModal
          suppliers={suppliers}
          projects={projects}
          onClose={() => setUploadOpen(false)}
          go={go}
          onSaved={(newId) => {
            try { window.localStorage.setItem('contract.currentId', newId); } catch {}
            load();
          }}
        />
      )}
    </div>
  );
}

/* =================== Upload modal (real API + Drive upload) =================== */

function UploadContractModal({ suppliers, projects, onClose, go, onSaved }) {
  const [contractTypes, setContractTypes] = useState([]);

  const [file, setFile]         = useState(null);
  // 'review' = ส่งตรวจสอบเอกสารเข้า workflow 5 ขั้น (status เริ่ม='draft')
  // 'skip'   = ไฟล์ผ่านการตรวจสอบมาแล้ว / ไม่ต้องตรวจ → บันทึก + active ทันที
  const [reviewMode, setReviewMode] = useState('review');
  const [form, setForm] = useState({
    title:       '',
    supplier_id: '',
    project_id:  '',
    type_id:     '',
    amount:      '',
    currency:    'THB',
    start_date:  '',
    end_date:    '',
    warranty:    '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/contract-types');
        const d = await r.json();
        setContractTypes(d.items || []);
      } catch { /* ignore */ }
    })();
  }, []);

  const canSubmit = !!file && form.title.trim().length > 0 && !busy;

  async function submit() {
    setErr('');
    if (!file) { setErr('กรุณาเลือกไฟล์ PDF ของสัญญา'); return; }
    if (!form.title.trim()) { setErr('กรอกชื่อสัญญา'); return; }

    setBusy(true);
    try {
      const no = generateContractNo();
      // 1) Create the contract row — status depends on the chosen review mode
      const today = new Date().toISOString().slice(0, 10);
      const payload = {
        no,
        title:       form.title.trim(),
        supplier_id: form.supplier_id || null,
        project_id:  form.project_id  || null,
        type_id:     form.type_id     || null,
        amount:      form.amount === '' ? null : Number(form.amount),
        currency:    form.currency || 'THB',
        status:      reviewMode === 'skip' ? 'active' : 'draft',
        signed_at:   reviewMode === 'skip' ? today : null,
        start_date:  form.start_date || null,
        end_date:    form.end_date   || null,
        warranty:    form.warranty?.trim() || '',
      };
      const rCreate = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const dCreate = await rCreate.json();
      if (!rCreate.ok) { setErr(dCreate.error || 'สร้างสัญญาไม่สำเร็จ'); setBusy(false); return; }
      const created = dCreate.item;

      // 2) Upload the file
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category',    'contract');
      fd.append('entity_type', 'contract');
      fd.append('entity_id',   created.id);
      fd.append('entity_ref',  created.no);
      const rUp = await fetch('/api/upload', { method:'POST', body: fd });
      const dUp = await rUp.json();
      if (!rUp.ok) {
        const parts = [
          dUp.error || 'อัปโหลดไฟล์ไม่สำเร็จ — สัญญาถูกสร้างแล้ว แต่ยังไม่ได้แนบไฟล์',
          dUp.detail && `รายละเอียด: ${dUp.detail}`,
          dUp.hint,
        ].filter(Boolean);
        setErr(parts.join(' · '));
        setBusy(false);
        // contract is created — still call onSaved so list refreshes
        if (onSaved) onSaved(created.id);
        return;
      }

      // success
      setBusy(false);
      if (onSaved) onSaved(created.id);
      onClose();
      go('contract-detail');
    } catch (e) {
      setErr('เครือข่ายขัดข้อง');
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(20,18,14,0.32)',
      display:'grid', placeItems:'center', zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} className="card"
           style={{ width:620, padding:0, boxShadow:'var(--sh-pop)', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)' }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>อัพโหลดเอกสารใหม่</div>
          <h3 className="h-section">ข้อมูลสัญญา + ไฟล์ PDF</h3>
        </div>
        <div style={{ padding:24, overflowY:'auto' }}>

          {err && (
            <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
          )}

          {/* Review mode — user chooses BEFORE filling the form */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:11.5, color:'var(--ink-3)', fontWeight:500, marginBottom:8 }}>ประเภทการดำเนินการ</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                { value:'review', label:'ส่งตรวจสอบเอกสาร',   sub:'เข้า workflow 5 ขั้น (ตรวจสอบ → ฝ่ายกฎหมาย → Final)' },
                { value:'skip',   label:'ผ่านการตรวจสอบแล้ว', sub:'ข้ามขั้นตอน — บันทึกไฟล์เข้า Drive ทันที' },
              ].map(o => {
                const active = reviewMode === o.value;
                return (
                  <button key={o.value} type="button"
                    onClick={() => setReviewMode(o.value)}
                    style={{
                      textAlign:'left', cursor:'pointer',
                      padding:'12px 14px', borderRadius:8,
                      border: active ? '1.5px solid var(--teal)' : '1px solid var(--rule-2)',
                      background: active ? 'var(--teal-soft)' : 'var(--surface)',
                      transition: 'all 0.12s',
                    }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <span style={{
                        width:14, height:14, borderRadius:999,
                        border: active ? '4px solid var(--teal)' : '1.5px solid var(--rule-2)',
                        background: active ? 'var(--surface)' : 'transparent',
                      }} />
                      <span style={{ fontSize:13, fontWeight:600, color: active ? 'var(--teal-ink)' : 'var(--ink)' }}>{o.label}</span>
                    </div>
                    <div style={{ fontSize:11.5, color:'var(--ink-3)', paddingLeft:22 }}>{o.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form fields */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <label style={{ gridColumn:'1 / -1', display:'flex', flexDirection:'column', gap:6 }}>
              <span style={{ fontSize:11.5, color:'var(--ink-3)', fontWeight:500 }}>ชื่อสัญญา <span style={{ color:'var(--clay)' }}>*</span></span>
              <input value={form.title} onChange={e=>set('title', e.target.value)}
                placeholder="เช่น สัญญาก่อสร้างฐานราก โครงการ A"
                style={inputStyle} />
            </label>

            <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <span style={{ fontSize:11.5, color:'var(--ink-3)', fontWeight:500 }}>คู่สัญญา (Supplier)</span>
              <select value={form.supplier_id} onChange={e=>set('supplier_id', e.target.value)} style={inputStyle}>
                <option value="">— เลือก —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.code ? `${s.code} · ` : ''}{s.name}</option>)}
              </select>
            </label>

            <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <span style={{ fontSize:11.5, color:'var(--ink-3)', fontWeight:500 }}>โครงการ</span>
              <select value={form.project_id} onChange={e=>set('project_id', e.target.value)} style={inputStyle}>
                <option value="">— เลือก —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ''}{p.name}</option>)}
              </select>
            </label>

            <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <span style={{ fontSize:11.5, color:'var(--ink-3)', fontWeight:500 }}>ประเภทสัญญา</span>
              <select value={form.type_id} onChange={e=>set('type_id', e.target.value)} style={inputStyle}>
                <option value="">— เลือก —</option>
                {contractTypes.map(t => <option key={t.id} value={t.id}>{t.code ? `${t.code} · ` : ''}{t.name}</option>)}
              </select>
            </label>

            <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <span style={{ fontSize:11.5, color:'var(--ink-3)', fontWeight:500 }}>มูลค่า</span>
              <div style={{ display:'flex', gap:6 }}>
                <input type="number" value={form.amount} onChange={e=>set('amount', e.target.value)}
                  placeholder="0" style={{ ...inputStyle, flex:1 }} />
                <select value={form.currency} onChange={e=>set('currency', e.target.value)} style={{ ...inputStyle, width:90 }}>
                  <option value="THB">THB</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </label>

            <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <span style={{ fontSize:11.5, color:'var(--ink-3)', fontWeight:500 }}>เริ่มต้น</span>
              <input type="date" value={form.start_date} onChange={e=>set('start_date', e.target.value)} style={inputStyle} />
            </label>

            <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <span style={{ fontSize:11.5, color:'var(--ink-3)', fontWeight:500 }}>สิ้นสุด</span>
              <input type="date" value={form.end_date} onChange={e=>set('end_date', e.target.value)} style={inputStyle} />
            </label>

            <label style={{ gridColumn:'1 / -1', display:'flex', flexDirection:'column', gap:6 }}>
              <span style={{ fontSize:11.5, color:'var(--ink-3)', fontWeight:500 }}>
                การรับประกันผลงาน
                <span style={{ marginLeft:6, color:'var(--ink-4)', fontWeight:400 }}>(พิมพ์อิสระ)</span>
              </span>
              <input
                type="text"
                value={form.warranty}
                onChange={e => set('warranty', e.target.value)}
                placeholder="เช่น 1 ปี · 365 วัน · ตลอดอายุการใช้งาน · 6 เดือนหลังเซ็น"
                style={inputStyle} />
            </label>
          </div>

          {/* File picker */}
          <p style={{ fontSize:12, color:'var(--ink-3)', margin:'0 0 8px', lineHeight:1.6 }}>
            อัพโหลดไฟล์ PDF ของสัญญาที่ทำแล้วภายนอก การตรวจสอบเอกสารจะเริ่มเมื่อกด <strong>เริ่มตรวจสอบเอกสาร</strong> ในหน้าถัดไป
          </p>
          <label style={{
            display:'block', padding:'28px 22px',
            border:'2px dashed var(--rule-2)', borderRadius:8,
            background:'var(--surface-2)', textAlign:'center', cursor:'pointer',
          }}>
            <div style={{ fontSize:28, color:'var(--ink-4)', marginBottom:6 }}>↑</div>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--ink-2)', marginBottom:4 }}>
              ลากไฟล์มาที่นี่ หรือ <span style={{ color:'var(--teal)', textDecoration:'underline' }}>เลือกไฟล์</span>
            </div>
            <div style={{ fontSize:11, color:'var(--ink-3)' }}>รองรับ PDF, Word (.doc/.docx), รูป (.jpg/.png/.webp/.heic) · ไม่เกิน 25 MB</div>
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,.gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display:'none' }}
              onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
          {file && (
            <div style={{
              marginTop:14, display:'flex', gap:12, alignItems:'center',
              padding:'12px 14px', background:'var(--surface-2)',
              border:'1px solid var(--rule)', borderRadius:6,
            }}>
              <div style={{
                width:36, height:44, background:'var(--clay)', color:'#fff',
                borderRadius:3, display:'grid', placeItems:'center',
                fontSize:9, fontWeight:600, letterSpacing:0.5, flexShrink:0,
              }}>PDF</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.name}</div>
                <div style={{ fontSize:11, color:'var(--moss)', marginTop:2 }}>
                  ✓ พร้อมอัพโหลด · {Math.round(file.size / 1024)} KB
                </div>
              </div>
              <button className="btn ghost sm" onClick={() => setFile(null)} style={{ color:'var(--ink-4)' }}>×</button>
            </div>
          )}
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', background:'var(--surface-2)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
          <button className="btn primary" disabled={!canSubmit}
            onClick={submit}
            style={{ opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {busy ? 'กำลังอัพโหลด…' : <>{Icons.check} อัพโหลด & ไปที่สัญญาฉบับนี้</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =================== Detail (workflow-driven) =================== */

export function ScreenContract({ go }) {
  // The list-screen row click stashes the id in localStorage. We try that
  // first, then fall back to the most-recently-created contract.
  const [contract,  setContract]  = useState(null);
  const [allContracts, setAllContracts] = useState([]);
  const [allAttachments, setAllAttachments] = useState({});  // id → [att, ...]
  const [suppliers, setSuppliers] = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const { canWrite, isAdmin, user } = usePermissions();

  // phase: 'Uploaded' | 'Reviewing' | 'Reviewed' | 'Legal' | 'Final'
  const [phase, setPhase] = useState('Uploaded');
  const [legalOpen,   setLegalOpen]   = useState(false);
  const [finalOpen,   setFinalOpen]   = useState(false);
  // Manual document-review checklist — persisted into contracts.notes as
  // JSON (RFQ-style payload) so it survives reloads. ฝ่ายจัดซื้อ
  // ติ๊กครบทุกข้อก่อนส่งต่อขั้นถัดไป
  const [checks, setChecks] = useState({});
  // Send-to-legal record: { to, note, sentAt, by } — persisted with workflow
  const [legal, setLegal] = useState(null);
  // Linked purchase-order ids — persisted as workflow.linked_po_ids
  const [linkedPoIds, setLinkedPoIds] = useState([]);
  // Free-text part of contracts.notes (legacy plain text or payload.memo)
  const [memo, setMemo] = useState('');
  const allChecked = REVIEW_CHECKLIST.every(item => checks[item.key]);

  // Hydrate phase/checks/legal/memo from a contract row. JSON notes with a
  // .workflow payload win; legacy plain-text notes become memo and the phase
  // falls back to the DB status mapping.
  function hydrateFromContract(c) {
    const { workflow, memo: m } = parseContractNotes(c?.notes);
    setMemo(m);
    if (workflow) {
      setPhase(CT_STATUS[workflow.phase] ? workflow.phase : (DB_TO_BUCKET[c?.status] || 'Uploaded'));
      setChecks(workflow.checks || {});
      setLegal(workflow.legal || null);
      setLinkedPoIds(Array.isArray(workflow.linked_po_ids) ? workflow.linked_po_ids : []);
    } else {
      setPhase(DB_TO_BUCKET[c?.status] || 'Uploaded');
      setChecks({});
      setLegal(null);
      setLinkedPoIds([]);
    }
  }

  // Persist the review workflow into contracts.notes as JSON:
  //   { workflow: { phase, checks, legal }, memo:'<free text>' }
  // CLOBBER-SAFE (same pattern as screen-rfq.jsx persistConditions): re-fetch
  // the row's CURRENT notes right before the PATCH and merge — a save from
  // another tab never gets overwritten, and legacy plain-text notes are kept
  // as memo instead of being wiped.
  // `patch`             — partial workflow: { phase?, checks?, legal?, linked_po_ids? }
  // `opts.appendMemo`   — extra line appended to the memo free text
  // `opts.fields`       — extra contract columns to PATCH in the same call
  // `opts.expectStatus` — optimistic lock for STATUS-CHANGING calls: server
  //                       returns 409 if the row's status no longer matches
  async function persistWorkflow(patch = {}, opts = {}) {
    if (!contract) return { ok:false, error:'ไม่มีสัญญา' };
    const wf = { phase, checks, legal, linked_po_ids: linkedPoIds, ...patch };
    let base = {};        // preserve any other top-level keys in the payload
    let memoNow = memo;
    try {
      const rNow = await fetch('/api/contracts');
      if (rNow.ok) {
        const dNow = await rNow.json();
        const rowNow = (dNow.items || []).find(x => x.id === contract.id);
        if (rowNow) {
          const cur = parseContractNotes(rowNow.notes);
          memoNow = cur.memo;
          if (cur.payload) base = cur.payload;
        }
      }
    } catch { /* network hiccup — fall back to local snapshot */ }
    if (opts.appendMemo) memoNow = memoNow ? `${memoNow}\n${opts.appendMemo}` : opts.appendMemo;
    const nextNotes = JSON.stringify({ ...base, workflow: wf, memo: memoNow });
    try {
      const r = await fetch('/api/contracts', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: contract.id, notes: nextNotes, ...(opts.fields || {}),
          ...(opts.expectStatus ? { _expect: { status: opts.expectStatus } } : {}),
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        return { ok:false, error: d.error || 'บันทึกไม่สำเร็จ', conflict: r.status === 409 };
      }
      setMemo(memoNow);
      const rowPatch = { notes: nextNotes, ...(opts.fields || {}) };
      setContract(c => (c && c.id === contract.id) ? { ...c, ...rowPatch } : c);
      setAllContracts(cs => cs.map(x => x.id === contract.id ? { ...x, ...rowPatch } : x));
      return { ok:true };
    } catch {
      return { ok:false, error:'เครือข่ายขัดข้อง' };
    }
  }

  // Advance the workflow phase optimistically, then persist into notes.
  async function advancePhase(nextPhase, extra) {
    setPhase(nextPhase);
    const r = await persistWorkflow({ phase: nextPhase, ...(extra || {}) });
    if (!r.ok) alert(`บันทึกสถานะไม่สำเร็จ: ${r.error || 'ไม่ทราบสาเหตุ'}`);
  }

  // Persist the linked-PO id list into workflow.linked_po_ids (merge-safe
  // via persistWorkflow) — local state only updates after the save succeeds.
  async function saveLinkedPos(nextIds) {
    const r = await persistWorkflow({ linked_po_ids: nextIds });
    if (r.ok) setLinkedPoIds(nextIds);
    return r;
  }

  // ===== Lifecycle actions (active → expired / terminated) =====

  async function markExpired() {
    if (!contract) return;
    if (!confirm(`บันทึกว่าสัญญา "${contract.title || contract.no}" หมดอายุแล้ว?`)) return;
    try {
      const r = await fetch('/api/contracts', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        // _expect — optimistic lock: reject (409) if someone else already
        // changed the status; local state stays untouched.
        body: JSON.stringify({ id: contract.id, status: 'expired', _expect: { status: contract.status } }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        if (r.status === 409) { setErr(d.error || 'สถานะสัญญาถูกเปลี่ยนโดยผู้ใช้อื่น'); return; }
        alert(`บันทึกไม่สำเร็จ: ${d.error || 'ไม่ทราบสาเหตุ'}`);
        return;
      }
      setContract(c => c ? { ...c, status: 'expired' } : c);
      setAllContracts(cs => cs.map(x => x.id === contract.id ? { ...x, status: 'expired' } : x));
    } catch (e) {
      alert(`เครือข่ายขัดข้อง: ${e.message}`);
    }
  }

  async function terminateContract() {
    if (!contract) return;
    const reason = prompt(`เหตุผลการยกเลิกสัญญา "${contract.title || contract.no}" (จำเป็นต้องระบุ):`);
    if (reason == null) return;
    if (!reason.trim()) { alert('กรุณาระบุเหตุผลการยกเลิกสัญญา'); return; }
    if (!confirm(`ยืนยันยกเลิกสัญญา "${contract.title || contract.no}"?\n\nเหตุผล: ${reason.trim()}`)) return;
    const stamp = `[ยกเลิกสัญญา ${fmtDate(new Date().toISOString())}${user?.email ? ` โดย ${user.email}` : ''}] ${reason.trim()}`;
    // Single PATCH: status + reason appended into the notes memo (clobber-safe)
    // + optimistic lock — 409 if someone else changed the status first.
    const r = await persistWorkflow({}, { appendMemo: stamp, fields: { status: 'terminated' }, expectStatus: contract.status });
    if (!r.ok) {
      if (r.conflict) { setErr(r.error); return; }
      alert(`บันทึกไม่สำเร็จ: ${r.error || 'ไม่ทราบสาเหตุ'}`);
    }
  }

  async function loadAttachments(contractId) {
    if (!contractId) return;
    try {
      const r = await fetch(`/api/attachments?entity_type=contract&entity_id=${encodeURIComponent(contractId)}`);
      const d = await r.json();
      if (r.ok) setAttachments(d.items || []);
    } catch { /* ignore */ }
  }

  async function deleteCurrentContract() {
    if (!contract) return;
    const fileCount = attachments.length;
    const msg = `ลบเอกสาร "${contract.title || contract.no}"?` +
      (fileCount > 0
        ? `\n\nไฟล์ ${fileCount} ไฟล์ใน Google Drive จะถูกลบไปด้วย (ไม่สามารถกู้คืนได้)`
        : '\n\n(ไม่มีไฟล์แนบ)');
    if (!confirm(msg)) return;
    try {
      const r = await fetch('/api/contracts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: contract.id }),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(`ลบไม่สำเร็จ: ${d.error || 'ไม่ทราบสาเหตุ'}`);
        return;
      }
      if (d.deleted?.drive_errors?.length) {
        alert(
          `ลบเอกสารสำเร็จ — แต่มี ${d.deleted.drive_errors.length} ไฟล์ใน Drive ที่ลบไม่ออก:\n` +
          d.deleted.drive_errors.join('\n')
        );
      }
      try { window.localStorage.removeItem('contract.currentId'); } catch {}
      go('contract');  // back to list
    } catch (e) {
      alert(`เครือข่ายขัดข้อง: ${e.message}`);
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true); setErr('');
      try {
        const stashed = (typeof window !== 'undefined') ? window.localStorage.getItem('contract.currentId') : null;
        const [rC, rS, rP, rA] = await Promise.all([
          fetch('/api/contracts'),
          fetch('/api/suppliers'),
          fetch('/api/projects'),
          fetch('/api/attachments?entity_type=contract&limit=500'),
        ]);
        const dC = await rC.json();
        const dS = await rS.json();
        const dP = await rP.json();
        const dA = rA.ok ? await rA.json() : { items: [] };
        if (!rC.ok) { setErr(dC.error || 'โหลดข้อมูลไม่สำเร็จ'); setLoading(false); return; }
        const items = dC.items || [];
        // Group attachments by contract id
        const grouped = {};
        for (const a of (dA.items || [])) {
          if (!a.entity_id) continue;
          (grouped[a.entity_id] = grouped[a.entity_id] || []).push(a);
        }
        setAllAttachments(grouped);
        setAllContracts(items);
        const picked = (stashed && items.find(c => c.id === stashed)) || items[0] || null;
        setContract(picked);
        setSuppliers(dS.items || []);
        setProjects(dP.items  || []);
        if (picked) {
          // Hydrate workflow (phase/checks/legal) from the notes JSON payload;
          // legacy plain-text notes fall back to the DB-status mapping.
          hydrateFromContract(picked);
          // Reuse the grouped attachments — saves a redundant round-trip
          // (we already fetched all contract attachments with limit=500 above).
          setAttachments(grouped[picked.id] || []);
        }
      } catch {
        setErr('เครือข่ายขัดข้อง');
      }
      setLoading(false);
    })();
  }, []);

  // O(1) lookups (replaces .find() that ran on every render)
  const supplier = useMemo(
    () => suppliers.find(s => s.id === contract?.supplier_id),
    [suppliers, contract?.supplier_id]
  );
  const project = useMemo(
    () => projects.find(p => p.id === contract?.project_id),
    [projects, contract?.project_id]
  );
  // Header chip: lifecycle statuses (expired/terminated) win over the
  // review-phase chip; otherwise show the current workflow phase.
  const sp = (contract && DB_STATUS_CHIP[contract.status])
    ? DB_STATUS_CHIP[contract.status]
    : (CT_STATUS[phase] || CT_STATUS.Uploaded);

  async function uploadFinalFile(file) {
    if (!contract || !file) return { ok:false, error:'ไม่มีสัญญาหรือไฟล์' };
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category',    'contract');
    fd.append('entity_type', 'contract');
    fd.append('entity_id',   contract.id);
    fd.append('entity_ref',  contract.no || '');
    try {
      const r = await fetch('/api/upload', { method:'POST', body: fd });
      const d = await r.json();
      if (!r.ok) return { ok:false, error: d.error || 'อัปโหลดไม่สำเร็จ' };
      // Mark contract as active in DB now that final is uploaded.
      // If the PATCH fails, surface it — silently swallowing meant the UI
      // could show "active" while the DB stayed in draft.
      try {
        const pr = await fetch('/api/contracts', {
          method:'PATCH',
          headers:{ 'Content-Type':'application/json' },
          // _expect — optimistic lock: 409 if the status changed elsewhere.
          body: JSON.stringify({ id: contract.id, status:'active', signed_at: new Date().toISOString().slice(0,10), _expect: { status: contract.status } }),
        });
        if (!pr.ok) {
          const pd = await pr.json().catch(() => ({}));
          return { ok:false, error: pd.error || 'อัปเดตสถานะสัญญาไม่สำเร็จ' };
        }
      } catch {
        return { ok:false, error:'อัปเดตสถานะสัญญาไม่สำเร็จ — เครือข่ายขัดข้อง' };
      }
      await loadAttachments(contract.id);
      return { ok:true };
    } catch (e) {
      return { ok:false, error:'เครือข่ายขัดข้อง' };
    }
  }

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => go('contract')} style={{ marginBottom:20, marginLeft:-8 }}>
        {Icons.back} กลับไปสัญญาทั้งหมด
      </button>

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>
      )}

      <div className="page-head" style={{ alignItems:'flex-start' }}>
        <div className="page-title">
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
            <span className="font-mono" style={{ fontSize:12, color:'var(--ink-3)' }}>{contract?.no || '—'}</span>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:6,
              fontSize:11, fontWeight:500, padding:'2px 10px', borderRadius:999,
              background: sp.bg, color: sp.fg,
            }}>
              <span style={{ width:6, height:6, borderRadius:999, background: sp.dot }} />
              {sp.label}
            </span>
          </div>
          <h1 className="h-display">{loading ? 'กำลังโหลด…' : (contract?.title || 'ยังไม่มีข้อมูล')}</h1>
          <div style={{ display:'flex', gap:24, marginTop:12, fontSize:13, color:'var(--ink-3)', flexWrap:'wrap' }}>
            <span>โครงการ <strong style={{ color:'var(--ink-2)' }}>{project?.name || '—'}</strong></span>
            <span>ผู้รับเหมา <strong style={{ color:'var(--ink-2)' }}>{supplier?.name || '—'}</strong></span>
            <span>มูลค่า <strong style={{ color:'var(--ink-2)' }}>{contract?.amount != null ? money(contract.amount) : '—'}</strong></span>
          </div>
        </div>
        {contract && isAdmin && (
          <div>
            <button
              className="btn"
              onClick={() => deleteCurrentContract()}
              style={{ color:'var(--clay)', borderColor:'#F5C0B4' }}
              title="ลบเอกสารนี้และไฟล์ใน Drive"
            >
              🗑 ลบเอกสารนี้
            </button>
          </div>
        )}
      </div>

      {/* If contract already left the review pipeline (active, or lifecycle
          statuses expired/terminated), show a simple archive view instead of
          the review workflow stepper. */}
      {contract && ['active', 'expired', 'terminated'].includes(contract.status) && (
        <ActiveContractView
          contract={contract}
          attachments={attachments}
          memo={memo}
          linkedPoIds={linkedPoIds}
          onSaveLinks={saveLinkedPos}
          go={go}
          onMarkExpired={markExpired}
          onTerminate={terminateContract}
          onUploadAddon={async (file) => {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('category', 'contract');
            fd.append('entity_type', 'contract');
            fd.append('entity_id', contract.id);
            fd.append('entity_ref', contract.no);
            const r = await fetch('/api/upload', { method:'POST', body: fd });
            const d = await r.json();
            if (!r.ok) return { ok:false, error: [d.error, d.detail].filter(Boolean).join(' · ') };
            await loadAttachments(contract.id);
            return { ok:true };
          }}
        />
      )}

      {/* Review workflow only shown when status is still 'draft' */}
      {contract && !['active', 'expired', 'terminated'].includes(contract.status) && (
      <>
      {/* Workflow stepper — horizontal */}
      <div style={{ marginBottom:32, padding:'18px 22px', background:'var(--surface-2)', border:'1px solid var(--rule)', borderRadius:8 }}>
        <div className="eyebrow" style={{ marginBottom:14 }}>ขั้นตอนตรวจสอบสัญญา</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:0, alignItems:'flex-start' }}>
          {[
            { key:'Uploaded',  label:'1. อัพโหลดเอกสาร',  sub:'รับไฟล์จากภายนอก' },
            { key:'Reviewing', label:'2. ตรวจสอบเอกสาร', sub:'เช็คลิสต์โดยฝ่ายจัดซื้อ' },
            { key:'Reviewed',  label:'3. ผลการตรวจ',      sub:'สรุปรายการที่ตรวจแล้ว' },
            { key:'Legal',     label:'4. ส่งฝ่ายกฎหมาย',  sub:'รอผลตรวจ' },
            { key:'Final',     label:'5. Upload Final',   sub:'ไฟล์สัญญาสุดท้าย' },
          ].map((s, i, arr) => {
            const order = ['Uploaded','Reviewing','Reviewed','Legal','Final'];
            const cur   = order.indexOf(phase);
            const idx   = order.indexOf(s.key);
            const isDone = idx < cur;
            const isCur  = idx === cur;
            return (
              <div key={s.key} style={{ position:'relative', paddingRight: i < arr.length - 1 ? 20 : 0 }}>
                {i < arr.length - 1 && (
                  <div style={{
                    position:'absolute', top:14, left:36, right:0, height:2,
                    background: idx < cur ? 'var(--teal)' : 'var(--rule)',
                  }} />
                )}
                <div style={{ display:'flex', alignItems:'flex-start', gap:10, position:'relative', zIndex:1 }}>
                  <span style={{
                    width:28, height:28, borderRadius:999,
                    background: isCur ? 'var(--teal)' : isDone ? 'var(--teal-soft)' : 'var(--rule)',
                    color: isCur ? 'var(--paper)' : 'var(--teal-ink)',
                    display:'inline-grid', placeItems:'center',
                    fontSize:12, fontWeight:600, fontFamily:'var(--font-mono)',
                    flexShrink:0, border: isCur ? '2px solid var(--teal-ink)' : 'none',
                  }}>{isDone ? '✓' : i+1}</span>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:12.5, fontWeight: isCur ? 600 : 500,
                                  color: isCur ? 'var(--ink)' : isDone ? 'var(--ink-2)' : 'var(--ink-4)' }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize:11, color: isCur ? 'var(--ink-3)' : 'var(--ink-4)', marginTop:3, lineHeight:1.4 }}>
                      {s.sub}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:32 }}>
        <div>
          {/* Phase 1: Uploaded → confirm gate */}
          {phase === 'Uploaded' && (
            <div className="card" style={{ padding:32, textAlign:'center' }}>
              <div style={{ marginBottom:16, display:'inline-flex', alignItems:'center', gap:10, padding:'4px 12px', borderRadius:999, background:'#F0E4C5', color:'#6B5121', fontSize:11, fontWeight:500 }}>
                <span style={{ width:6, height:6, borderRadius:999, background:'var(--ochre)' }} />
                ขั้นตอนถัดไป · รอผู้ใช้คอนเฟิร์ม
              </div>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:24 }}>
                <div style={{
                  width:64, height:80, background:'var(--clay)', color:'#fff',
                  borderRadius:6, display:'grid', placeItems:'center',
                  fontSize:14, fontWeight:600, letterSpacing:0.5,
                }}>PDF</div>
              </div>
              <div style={{ fontSize:14, fontWeight:500, marginBottom:6 }}>{attachments[0]?.filename || contract?.title || '—'}</div>
              <div style={{ fontSize:11.5, color:'var(--ink-3)', marginBottom:24 }}>{attachments.length} ไฟล์แนบ</div>
              <h2 className="h-section" style={{ marginBottom:8 }}>เลือกการดำเนินการต่อ</h2>
              <p style={{ fontSize:13.5, color:'var(--ink-2)', lineHeight:1.7, margin:'0 auto 24px', maxWidth:520 }}>
                สัญญานี้อัปโหลดเข้าระบบและ Drive แล้ว ขั้นถัดไปเลือกได้ระหว่าง
                <strong> ตรวจสอบเอกสาร </strong>(ฝ่ายจัดซื้อตรวจตามเช็คลิสต์)
                หรือ <strong>ข้ามไป Final</strong> ถ้าเอกสารผ่านการตรวจจากภายนอกแล้ว
              </p>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, maxWidth:640, margin:'0 auto' }}>
                {/* Option A — manual document review */}
                <div style={{
                  padding:'20px 18px', borderRadius:10,
                  border:'1.5px solid var(--rule-2)', background:'var(--surface)',
                  textAlign:'left', display:'flex', flexDirection:'column', gap:10,
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{
                      width:30, height:30, borderRadius:999, background:'var(--teal-soft)',
                      color:'var(--teal-ink)', display:'grid', placeItems:'center', fontSize:13, fontWeight:600,
                    }}>☑</span>
                    <span style={{ fontSize:14, fontWeight:600 }}>ตรวจสอบเอกสาร</span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--ink-3)', lineHeight:1.55, flex:1 }}>
                    ฝ่ายจัดซื้อตรวจคู่สัญญา วงเงิน เงื่อนไขค้ำประกัน และวันที่ ตามเช็คลิสต์ ก่อนส่งฝ่ายกฎหมาย
                  </div>
                  {canWrite && (
                    <button className="btn primary" onClick={() => advancePhase('Reviewing')} disabled={!contract}>
                      {Icons.check} เริ่มตรวจสอบเอกสาร
                    </button>
                  )}
                </div>

                {/* Option B — skip review, mark active directly */}
                <div style={{
                  padding:'20px 18px', borderRadius:10,
                  border:'1.5px solid var(--rule-2)', background:'var(--surface)',
                  textAlign:'left', display:'flex', flexDirection:'column', gap:10,
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{
                      width:30, height:30, borderRadius:999, background:'#DEE7E3',
                      color:'#1F4D40', display:'grid', placeItems:'center', fontSize:16, fontWeight:600,
                    }}>✓</span>
                    <span style={{ fontSize:14, fontWeight:600 }}>ข้ามไป Final</span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--ink-3)', lineHeight:1.55, flex:1 }}>
                    สัญญาผ่านการตรวจจากภายนอกแล้ว — บันทึกเป็น "ใช้งานอยู่" ทันที, ไฟล์อยู่ใน Drive ตามเดิม
                  </div>
                  {canWrite && (
                  <button
                    className="btn"
                    disabled={!contract}
                    onClick={async () => {
                      if (!confirm('ยืนยันข้ามขั้นตอนตรวจสอบ/ฝ่ายกฎหมาย และบันทึกสัญญาเป็น "ใช้งานอยู่"?')) return;
                      try {
                        const r = await fetch('/api/contracts', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            id: contract.id,
                            status: 'active',
                            signed_at: new Date().toISOString().slice(0,10),
                            // Optimistic lock — 409 if the status changed elsewhere
                            _expect: { status: contract.status },
                          }),
                        });
                        const d = await r.json();
                        if (!r.ok) {
                          if (r.status === 409) { setErr(d.error || 'สถานะสัญญาถูกเปลี่ยนโดยผู้ใช้อื่น'); return; }
                          alert(`บันทึกไม่สำเร็จ: ${d.error || 'ไม่ทราบสาเหตุ'}`);
                          return;
                        }
                        setContract(d.item || { ...contract, status:'active', signed_at: new Date().toISOString().slice(0,10) });
                        setPhase('Final');
                        // Record the skip in the notes workflow too, so a
                        // reload shows the same terminal phase.
                        persistWorkflow({ phase:'Final' });
                      } catch (e) {
                        alert(`เครือข่ายขัดข้อง: ${e.message}`);
                      }
                    }}
                  >
                    บันทึกและข้าม
                  </button>
                  )}
                </div>
              </div>

              {isAdmin && (
                <button
                  className="btn ghost"
                  onClick={() => deleteCurrentContract()}
                  style={{ marginTop:18, color:'var(--clay)' }}>
                  ยกเลิก / ลบเอกสารนี้
                </button>
              )}
            </div>
          )}

          {/* Phase 2: Reviewing — manual checklist by procurement */}
          {phase === 'Reviewing' && (
            <div className="card" style={{ padding:32 }}>
              <div className="eyebrow" style={{ marginBottom:6 }}>ตรวจสอบโดยฝ่ายจัดซื้อ</div>
              <h2 className="h-section" style={{ marginBottom:8 }}>ตรวจสอบเอกสาร</h2>
              <p style={{ fontSize:13, color:'var(--ink-3)', margin:'0 0 20px', lineHeight:1.6 }}>
                เปิดไฟล์สัญญา (แผงด้านขวา) เทียบกับข้อมูลที่บันทึกไว้ แล้วติ๊กยืนยันทุกข้อก่อนส่งต่อ
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
                {REVIEW_CHECKLIST.map(item => (
                  <label key={item.key} style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'12px 16px', borderRadius:8,
                    border:`1px solid ${checks[item.key] ? 'var(--teal)' : 'var(--rule-2)'}`,
                    background: checks[item.key] ? 'var(--teal-soft)' : 'var(--surface)',
                    cursor: canWrite ? 'pointer' : 'default',
                  }}>
                    {canWrite ? (
                      <input
                        type="checkbox"
                        checked={!!checks[item.key]}
                        onChange={e => {
                          const next = { ...checks, [item.key]: e.target.checked };
                          setChecks(next);
                          // Save each tick into the notes payload so the
                          // checklist survives a reload.
                          persistWorkflow({ checks: next });
                        }}
                        style={{ width:16, height:16, accentColor:'var(--teal)', flexShrink:0 }}
                      />
                    ) : (
                      <span style={{ fontSize:14, color: checks[item.key] ? 'var(--teal)' : 'var(--ink-4)', flexShrink:0 }}>
                        {checks[item.key] ? '✓' : '○'}
                      </span>
                    )}
                    <span style={{ fontSize:13, color:'var(--ink-2)' }}>{item.label}</span>
                  </label>
                ))}
              </div>
              {canWrite ? (
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <button
                    className="btn primary"
                    disabled={!allChecked}
                    onClick={() => advancePhase('Reviewed')}
                    style={{ opacity: allChecked ? 1 : 0.5, cursor: allChecked ? 'pointer' : 'not-allowed' }}
                  >
                    {Icons.check} บันทึกผลตรวจ · ไปขั้นถัดไป
                  </button>
                  {!allChecked && (
                    <span style={{ fontSize:12, color:'var(--ink-3)' }}>ติ๊กให้ครบทุกข้อก่อนส่งต่อ</span>
                  )}
                </div>
              ) : (
                <div style={{ fontSize:12.5, color:'var(--ink-3)' }}>รอฝ่ายจัดซื้อตรวจสอบเอกสาร</div>
              )}
            </div>
          )}

          {/* Phase 3+: review result */}
          {(phase === 'Reviewed' || phase === 'Legal' || phase === 'Final') && (
            <ReviewResultPanel
              phase={phase}
              checks={checks}
              legal={legal}
              onSendToLegal={() => setLegalOpen(true)}
              onUploadFinal={() => setFinalOpen(true)}
            />
          )}
        </div>

        {/* Right rail */}
        <aside style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="card">
            <h3 className="h-card" style={{ marginBottom:14 }}>ข้อมูลสัญญา</h3>
            <KV label="เลขที่สัญญา" value={contract?.no || '—'} mono />
            <KV label="ประเภท" value={contract?.type_id || '—'} />
            <KV label="มูลค่ารวม" value={contract?.amount != null ? money(contract.amount) : '—'} />
            <KV label="เซ็นเมื่อ" value={fmtDate(contract?.signed_at)} />
            <KV label="ระยะเวลา" value={contract?.start_date ? `${fmtDate(contract.start_date)} – ${fmtDate(contract.end_date)}` : '—'} />
            <KV label="รับประกันผลงาน" value={contract?.warranty || '—'} />
            {memo && (
              <div style={{ marginTop:12, padding:'10px 12px', background:'var(--surface-2)', borderRadius:6, fontSize:12, color:'var(--ink-2)', whiteSpace:'pre-wrap', lineHeight:1.6 }}>
                <div className="eyebrow" style={{ marginBottom:6 }}>บันทึก</div>
                {memo}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="h-card" style={{ marginBottom:14 }}>ไฟล์</h3>
            {attachments.length === 0 ? (
              <div style={{ textAlign:'center', padding:20, color:'var(--ink-3)', fontSize:12.5 }}>
                ยังไม่มีข้อมูล
              </div>
            ) : (
              <div>
                {attachments.map(att => (
                  <div key={att.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid var(--rule)' }}>
                    <span style={{
                      width:24, height:28, background:'var(--clay)', color:'#fff',
                      borderRadius:3, display:'grid', placeItems:'center',
                      fontSize:8, fontWeight:600, flexShrink:0,
                    }}>PDF</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{att.filename}</div>
                      <div style={{ fontSize:10, color:'var(--ink-3)', marginTop:1 }}>
                        {att.size ? `${Math.round(att.size / 1024)} KB` : ''} · {fmtDate(att.uploaded_at)}
                      </div>
                    </div>
                    {att.drive_view_link && (
                      <a href={att.drive_view_link} target="_blank" rel="noreferrer" className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }}>{Icons.external}</a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
      </>
      )}

      {legalOpen && (
        <SendToLegalModal
          onSend={({ to, note }) => {
            setLegalOpen(false);
            // Record who/when the draft went to legal — persisted in the
            // notes workflow payload so it survives reloads.
            const rec = { to, note, sentAt: new Date().toISOString(), by: user?.email || '' };
            setLegal(rec);
            advancePhase('Legal', { legal: rec });
          }}
          onClose={() => setLegalOpen(false)} />
      )}
      {finalOpen && (
        <UploadFinalModal
          onUpload={uploadFinalFile}
          onDone={() => { setFinalOpen(false); advancePhase('Final'); }}
          onClose={() => setFinalOpen(false)} />
      )}

      {/* คลังสัญญาทั้งหมด — at bottom so user can navigate */}
      {allContracts.length > 0 && (
        <ContractArchive
          contracts={allContracts}
          currentId={contract?.id}
          attachmentsByContract={allAttachments}
          suppliers={suppliers}
          projects={projects}
          go={go}
          onSelect={(c) => {
            try { window.localStorage.setItem('contract.currentId', c.id); } catch {}
            setContract(c);
            hydrateFromContract(c);   // per-contract workflow from notes
            setAttachments(allAttachments[c.id] || []);
            if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
          }}
        />
      )}
    </div>
  );
}

/* =================== Contract Archive (mini list) =================== */
function ContractArchive({ contracts, currentId, attachmentsByContract, suppliers, projects, go, onSelect }) {
  // O(1) name lookups (was .find() per row × per render)
  const supById = useMemo(() => {
    const m = new Map();
    for (const s of suppliers) m.set(s.id, s);
    return m;
  }, [suppliers]);
  const projById = useMemo(() => {
    const m = new Map();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);
  const supName = (id) => supById.get(id)?.name || '—';
  const projName = (id) => projById.get(id)?.name || '—';

  const { signedCount, totalSignedValue } = useMemo(() => {
    let count = 0, total = 0;
    for (const c of contracts) {
      if (c.status === 'active') {
        count++;
        total += Number(c.amount) || 0;
      }
    }
    return { signedCount: count, totalSignedValue: total };
  }, [contracts]);

  return (
    <section style={{ marginTop:56 }}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:14 }}>
        <h2 className="h-section">คลังสัญญาทั้งหมด</h2>
        <div style={{ display:'flex', gap:18, fontSize:12.5, color:'var(--ink-3)' }}>
          <span>ทั้งหมด <strong style={{ color:'var(--ink)' }}>{contracts.length}</strong> ฉบับ</span>
          <span>เซ็นแล้ว <strong style={{ color:'var(--moss)' }}>{signedCount}</strong> ฉบับ</span>
          <span>มูลค่ารวม <strong style={{ color:'var(--ink-2)' }}>{money(totalSignedValue)}</strong></span>
        </div>
      </div>

      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:'12%' }}>เลขที่</th>
              <th>หัวข้อ / โครงการ</th>
              <th>คู่สัญญา</th>
              <th className="num-col">มูลค่า</th>
              <th>เซ็นเมื่อ</th>
              <th>สถานะ</th>
              <th style={{ width:110 }}>ไฟล์</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map(c => {
              // Lifecycle statuses (expired/terminated) get their own chip;
              // pipeline statuses map through the workflow bucket.
              const sp = statusChip(c.status);
              const atts = attachmentsByContract[c.id] || [];
              const latest = atts[0];
              const isCurrent = c.id === currentId;
              return (
                <tr key={c.id}
                  onClick={() => {
                    if (isCurrent) return;
                    // Parent owns the detail state — switch in-place via the
                    // callback (keeps fetched suppliers/projects warm).
                    onSelect?.(c);
                  }}
                  style={{
                    cursor: isCurrent ? 'default' : 'pointer',
                    background: isCurrent ? 'var(--paper-2)' : undefined,
                  }}>
                  <td>
                    <div className="font-mono" style={{ fontSize:12, color: isCurrent ? 'var(--teal)' : 'var(--ink-2)', fontWeight:500 }}>
                      {c.no} {isCurrent && <span style={{ fontSize:10 }}>← กำลังดู</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight:500, fontSize:13 }}>{c.title || '—'}</div>
                    <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:2 }}>{projName(c.project_id)}</div>
                  </td>
                  <td style={{ fontSize:12.5 }}>{supName(c.supplier_id)}</td>
                  <td className="num-col num" style={{ fontWeight:500, fontSize:13 }}>
                    {c.amount != null ? money(c.amount) : '—'}
                  </td>
                  <td style={{ fontSize:12, color:'var(--ink-3)' }}>
                    {c.signed_at ? fmtDate(c.signed_at) : <span style={{ color:'var(--ink-4)' }}>—</span>}
                  </td>
                  <td>
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:6,
                      fontSize:11, fontWeight:500, padding:'2px 10px', borderRadius:999,
                      background: sp.bg, color: sp.fg,
                    }}>
                      <span style={{ width:6, height:6, borderRadius:999, background: sp.dot }} />
                      {sp.label}
                    </span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {latest && latest.drive_view_link ? (
                      <a href={latest.drive_view_link} target="_blank" rel="noopener noreferrer"
                         style={{ fontSize:11.5, color:'var(--teal)', textDecoration:'none' }}>
                        📄 Drive {atts.length > 1 && `(${atts.length})`}
                      </a>
                    ) : (
                      <span style={{ fontSize:11, color:'var(--ink-4)' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------
   ActiveContractView — shown when the contract left the review pipeline:
   status 'active' (skipped review at upload, or completed full workflow)
   as well as lifecycle statuses 'expired' / 'terminated'.
   Clean archive view: file list + simple actions. No phase stepper.
   ---------------------------------------------------------- */
function ActiveContractView({ contract, attachments, memo, linkedPoIds, onSaveLinks, go, onUploadAddon, onMarkExpired, onTerminate }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = React.useRef(null);
  const { canWrite } = usePermissions();

  async function handleFile(f) {
    if (!f) return;
    setErr(''); setBusy(true);
    const r = await onUploadAddon(f);
    if (!r.ok) setErr(r.error || 'อัปโหลดไม่สำเร็จ');
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:32 }}>
      <div>
        <div className="card" style={{ padding:28, marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
            <div style={{
              width:36, height:36, borderRadius:999,
              background:'var(--teal-soft)', color:'var(--teal-ink)',
              display:'grid', placeItems:'center', fontSize:18, fontWeight:600,
            }}>✓</div>
            <div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:18, fontWeight:500 }}>
                เก็บไว้เรียบร้อยแล้ว
              </div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>
                สัญญาอยู่ใน Google Drive · folder "สัญญา (Contracts)"
              </div>
            </div>
          </div>

          <div className="eyebrow" style={{ marginBottom:8 }}>ไฟล์แนบ ({attachments.length})</div>
          {attachments.length === 0 ? (
            <div style={{ padding:20, textAlign:'center', fontSize:13, color:'var(--ink-3)', background:'var(--surface-2)', borderRadius:6 }}>
              ยังไม่มีไฟล์
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {attachments.map(a => (
                <div key={a.id} style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'10px 14px', background:'var(--surface-2)',
                  border:'1px solid var(--rule)', borderRadius:6,
                }}>
                  <div style={{
                    width:32, height:40, background:'var(--clay)', color:'#fff',
                    borderRadius:3, display:'grid', placeItems:'center',
                    fontSize:9, fontWeight:600, flexShrink:0,
                  }}>PDF</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.filename}</div>
                    <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>
                      {new Date(a.uploaded_at).toLocaleString('th-TH', { dateStyle:'short', timeStyle:'short' })}
                      {a.uploaded_by && ` · ${a.uploaded_by}`}
                    </div>
                  </div>
                  {a.drive_view_link && (
                    <a href={a.drive_view_link} target="_blank" rel="noopener noreferrer" className="btn ghost sm">
                      เปิดใน Drive ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {canWrite && (
            <>
              <hr className="hr" style={{ margin:'22px 0 18px' }} />

              <div className="eyebrow" style={{ marginBottom:8 }}>เพิ่มไฟล์ใหม่ (Addendum / Amendment)</div>
              <p style={{ fontSize:12.5, color:'var(--ink-3)', margin:'0 0 12px' }}>
                อัปโหลดไฟล์เพิ่มเติม เช่น สัญญาแก้ไข, แนบเอกสารประกอบ — จะถูกเก็บใน folder เดียวกัน
              </p>
              {err && (
                <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:12 }}>{err}</div>
              )}
              <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,.gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={e => handleFile(e.target.files?.[0])}
                disabled={busy}
                style={{ fontSize:13 }} />
              {busy && <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:8 }}>กำลังอัปโหลด…</div>}
            </>
          )}

          {canWrite && contract.status === 'active' && (
            <>
              <hr className="hr" style={{ margin:'22px 0 18px' }} />

              <div className="eyebrow" style={{ marginBottom:8 }}>สถานะสัญญา</div>
              <p style={{ fontSize:12.5, color:'var(--ink-3)', margin:'0 0 12px' }}>
                เมื่อสัญญาสิ้นสุดตามกำหนด บันทึกเป็น "หมดอายุ" — หากต้องยุติก่อนกำหนด กด "ยกเลิกสัญญา" (ต้องระบุเหตุผล)
              </p>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn" onClick={onMarkExpired}>
                  หมดอายุ
                </button>
                <button className="btn" onClick={onTerminate}
                  style={{ color:'var(--clay)', borderColor:'#F5C0B4' }}>
                  ยกเลิกสัญญา
                </button>
              </div>
            </>
          )}
        </div>

        <LinkedPOSection
          linkedPoIds={linkedPoIds || []}
          onSaveLinks={onSaveLinks}
          go={go}
          canWrite={canWrite}
        />
      </div>

      <aside>
        <div className="card" style={{ padding:24 }}>
          <div className="eyebrow" style={{ marginBottom:10 }}>ข้อมูลสัญญา</div>
          <KV label="เลขที่สัญญา" value={contract.no} mono />
          <KV label="สถานะ" value={(() => {
            const st = DB_STATUS_CHIP[contract.status]
              || { bg:'#DEE7E3', fg:'#1F4D40', label:'ใช้งานอยู่' };
            return (
              <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:999,
                background: st.bg, color: st.fg, fontSize:11, fontWeight:500 }}>
                {st.label}
              </span>
            );
          })()} />
          <KV label="วันเซ็น" value={contract.signed_at ? fmtDate(contract.signed_at) : '—'} />
          <KV label="เริ่มสัญญา" value={contract.start_date ? fmtDate(contract.start_date) : '—'} />
          <KV label="สิ้นสุดสัญญา" value={contract.end_date ? fmtDate(contract.end_date) : '—'} />
          <KV label="รับประกันผลงาน" value={contract.warranty || '—'} />
          {memo && (
            <div style={{ marginTop:12, padding:'10px 12px', background:'var(--surface-2)', borderRadius:6, fontSize:12, color:'var(--ink-2)', whiteSpace:'pre-wrap', lineHeight:1.6 }}>
              <div className="eyebrow" style={{ marginBottom:6 }}>บันทึก</div>
              {memo}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ----------------------------------------------------------
   LinkedPOSection — "PO ที่เชื่อมโยง" card in the active-contract view.
   Ids live in workflow.linked_po_ids inside contracts.notes (saved via the
   clobber-safe persistWorkflow helper). Rows link straight to po-detail;
   ids whose PO no longer exists render as "(ถูกลบแล้ว)".
   ---------------------------------------------------------- */
function LinkedPOSection({ linkedPoIds, onSaveLinks, go, canWrite }) {
  const [pos, setPos] = useState([]);
  const [posLoaded, setPosLoaded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/purchase-orders');
        const d = await r.json();
        if (r.ok) setPos(d.items || []);
      } catch { /* ignore — missing POs render as deleted */ }
      setPosLoaded(true);
    })();
  }, []);

  const poById = useMemo(() => {
    const m = new Map();
    for (const p of pos) m.set(p.id, p);
    return m;
  }, [pos]);

  function openPO(id) {
    try { window.localStorage.setItem('po.currentId', id); } catch {}
    go('po-detail');
  }

  async function removeLink(id) {
    setErr('');
    const r = await onSaveLinks(linkedPoIds.filter(x => x !== id));
    if (!r.ok) setErr(r.error || 'บันทึกไม่สำเร็จ');
  }

  return (
    <div className="card" style={{ padding:28, marginBottom:24 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom:4 }}>ใบสั่งซื้อ</div>
          <h3 className="h-card" style={{ margin:0 }}>PO ที่เชื่อมโยง ({linkedPoIds.length})</h3>
        </div>
        {canWrite && (
          <button className="btn sm" onClick={() => { setErr(''); setPickerOpen(true); }}>
            {Icons.external} เชื่อมกับ PO
          </button>
        )}
      </div>

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:12 }}>{err}</div>
      )}

      {linkedPoIds.length === 0 ? (
        <div style={{ padding:20, textAlign:'center', fontSize:13, color:'var(--ink-3)', background:'var(--surface-2)', borderRadius:6 }}>
          ยังไม่มี PO ที่เชื่อมโยงกับสัญญานี้
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {linkedPoIds.map(id => {
            const p = poById.get(id);
            if (!p) {
              // PO id no longer exists in the fetched list (deleted) —
              // muted row, not clickable. While loading, show a placeholder.
              return (
                <div key={id} style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'10px 14px', background:'var(--surface-2)',
                  border:'1px dashed var(--rule-2)', borderRadius:6,
                }}>
                  <span className="font-mono" style={{ fontSize:11.5, color:'var(--ink-4)' }}>
                    {posLoaded ? 'PO (ถูกลบแล้ว)' : 'กำลังโหลด…'}
                  </span>
                  {canWrite && posLoaded && (
                    <button className="btn ghost sm" onClick={() => removeLink(id)}
                      title="เอาออกจากรายการ" style={{ marginLeft:'auto', color:'var(--ink-4)', padding:'2px 6px' }}>×</button>
                  )}
                </div>
              );
            }
            const st = PO_STATUS[p.status] || PO_STATUS.ordered;
            return (
              <div key={id}
                onClick={() => openPO(id)}
                style={{
                  display:'flex', alignItems:'center', gap:12, cursor:'pointer',
                  padding:'10px 14px', background:'var(--surface-2)',
                  border:'1px solid var(--rule)', borderRadius:6,
                }}>
                <span className="font-mono" style={{ fontSize:12, color:'var(--teal)', fontWeight:500, flexShrink:0 }}>{p.no || '—'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title || '—'}</div>
                  <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>{p.supplier_name || '—'}</div>
                </div>
                <span className="num" style={{ fontSize:12.5, fontWeight:500, flexShrink:0 }}>
                  {p.amount != null ? money(p.amount) : '—'}
                </span>
                <span style={{
                  display:'inline-flex', alignItems:'center', gap:6, flexShrink:0,
                  fontSize:11, fontWeight:500, padding:'2px 10px', borderRadius:999,
                  background: st.bg, color: st.fg, whiteSpace:'nowrap',
                }}>
                  <span style={{ width:6, height:6, borderRadius:999, background: st.dot }} />
                  {st.label}
                </span>
                {canWrite && (
                  <button className="btn ghost sm"
                    onClick={e => { e.stopPropagation(); removeLink(id); }}
                    title="เอาออกจากรายการ" style={{ color:'var(--ink-4)', padding:'2px 6px' }}>×</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pickerOpen && (
        <LinkPOModal
          pos={pos}
          initial={linkedPoIds}
          onSave={onSaveLinks}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

/* =================== Link-PO picker modal =================== */

function LinkPOModal({ pos, initial, onSave, onClose }) {
  const [q, setQ] = useState('');
  // Selection starts from the current linked ids — ids whose PO was deleted
  // stay in the set untouched (they're not listed, so they can't be unticked
  // here; remove them from the section row instead).
  const [sel, setSel] = useState(() => new Set(initial));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const filtered = useMemo(() => {
    const v = q.trim().toLowerCase();
    if (!v) return pos;
    return pos.filter(p =>
      (p.no || '').toLowerCase().includes(v) ||
      (p.title || '').toLowerCase().includes(v) ||
      (p.supplier_name || '').toLowerCase().includes(v));
  }, [pos, q]);

  function toggle(id) {
    setSel(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function save() {
    setBusy(true); setErr('');
    const r = await onSave([...sel]);
    setBusy(false);
    if (!r.ok) { setErr(r.error || 'บันทึกไม่สำเร็จ'); return; }
    onClose();
  }

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(20,18,14,0.32)',
      display:'grid', placeItems:'center', zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} className="card"
           style={{ width:640, padding:0, boxShadow:'var(--sh-pop)', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)' }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>เชื่อมสัญญากับใบสั่งซื้อ</div>
          <h3 className="h-section">เลือก PO ที่เกี่ยวข้องกับสัญญานี้</h3>
        </div>
        <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--rule)' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหาเลขที่ PO / ชื่องาน / Supplier…" />
        </div>
        <div style={{ padding:'8px 24px', overflowY:'auto', flex:1 }}>
          {err && (
            <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, margin:'8px 0' }}>{err}</div>
          )}
          {filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:28, color:'var(--ink-3)', fontSize:12.5 }}>
              ไม่พบใบสั่งซื้อ
            </div>
          ) : filtered.map(p => {
            const st = PO_STATUS[p.status] || PO_STATUS.ordered;
            const checked = sel.has(p.id);
            return (
              <label key={p.id} style={{
                display:'flex', alignItems:'center', gap:12,
                padding:'10px 12px', margin:'6px 0', borderRadius:8, cursor:'pointer',
                border:`1px solid ${checked ? 'var(--teal)' : 'var(--rule-2)'}`,
                background: checked ? 'var(--teal-soft)' : 'var(--surface)',
              }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(p.id)}
                  style={{ width:16, height:16, accentColor:'var(--teal)', flexShrink:0 }}
                />
                <span className="font-mono" style={{ fontSize:12, color:'var(--ink-2)', fontWeight:500, flexShrink:0 }}>{p.no || '—'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title || '—'}</div>
                  <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>{p.supplier_name || '—'}</div>
                </div>
                <span className="num" style={{ fontSize:12.5, fontWeight:500, flexShrink:0 }}>
                  {p.amount != null ? money(p.amount) : '—'}
                </span>
                <span style={{
                  display:'inline-flex', alignItems:'center', gap:6, flexShrink:0,
                  fontSize:11, fontWeight:500, padding:'2px 10px', borderRadius:999,
                  background: st.bg, color: st.fg, whiteSpace:'nowrap',
                }}>
                  <span style={{ width:6, height:6, borderRadius:999, background: st.dot }} />
                  {st.label}
                </span>
              </label>
            );
          })}
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', background:'var(--surface-2)', display:'flex', justifyContent:'flex-end', alignItems:'center', gap:8 }}>
          <span style={{ marginRight:'auto', fontSize:12, color:'var(--ink-3)' }}>
            เลือกแล้ว <strong style={{ color:'var(--ink)' }}>{sel.size}</strong> รายการ
          </span>
          <button className="btn ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? 'กำลังบันทึก…' : <>{Icons.check} บันทึกการเชื่อมโยง</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewResultPanel({ phase, checks, legal, onSendToLegal, onUploadFinal }) {
  const { canWrite } = usePermissions();

  return (
    <div className="card" style={{ padding:28, background:'var(--surface-2)', marginBottom:24 }}>
      <div style={{ marginBottom:20 }}>
        <div className="eyebrow" style={{ marginBottom:6 }}>ตรวจสอบโดยฝ่ายจัดซื้อ</div>
        <h2 className="h-section" style={{ margin:0 }}>ผลการตรวจสอบเอกสาร</h2>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {REVIEW_CHECKLIST.map(item => (
          <div key={item.key} style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'var(--ink-2)' }}>
            <span style={{ color: checks[item.key] ? 'var(--moss)' : 'var(--ink-4)', fontSize:14 }}>
              {checks[item.key] ? '✓' : '○'}
            </span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginTop:24, paddingTop:20, borderTop:'1px solid var(--rule)' }}>
        {canWrite && phase === 'Reviewed' && (
          <button className="btn primary" onClick={onSendToLegal}>
            {Icons.external} ส่งให้ฝ่ายกฎหมาย
          </button>
        )}
        {phase === 'Legal' && (
          <>
            <div style={{ flex:1, padding:'8px 14px', background:'var(--chip-recv-bg)', color:'var(--chip-recv-fg)', borderRadius:6, fontSize:12, display:'flex', alignItems:'center', gap:8 }}>
              <span>{Icons.clock}</span>
              <span>
                รอผลตรวจจากฝ่ายกฎหมาย
                {legal?.sentAt && (
                  <span style={{ display:'block', fontSize:11, marginTop:2, opacity:0.85 }}>
                    ส่งให้ {legal.to || '—'} เมื่อ {fmtDate(legal.sentAt)}{legal.by ? ` · โดย ${legal.by}` : ''}
                  </span>
                )}
              </span>
            </div>
            {canWrite && (
              <button className="btn primary" onClick={onUploadFinal}>
                {Icons.upload} Upload Final
              </button>
            )}
          </>
        )}
        {phase === 'Final' && (
          <div style={{ flex:1, padding:'8px 14px', background:'var(--moss-soft)', color:'#2F4A1A', borderRadius:6, fontSize:12, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ color:'var(--moss)' }}>{Icons.check}</span>
            Upload Final เรียบร้อย — สัญญานี้พร้อมใช้งาน
          </div>
        )}
      </div>
    </div>
  );
}

/* =================== Modals =================== */

function SendToLegalModal({ onSend, onClose }) {
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(20,18,14,0.32)',
      display:'grid', placeItems:'center', zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} className="card"
           style={{ width:560, padding:0, boxShadow:'var(--sh-pop)' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)' }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>ส่งให้ฝ่ายกฎหมายตรวจ</div>
          <h3 className="h-section">ส่งผลการตรวจให้ฝ่ายกฎหมาย</h3>
        </div>
        <div style={{ padding:24, display:'flex', flexDirection:'column', gap:14 }}>
          <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <span style={{ fontSize:11.5, color:'var(--ink-3)', fontWeight:500 }}>ส่งถึง</span>
            <input value={to} onChange={e => setTo(e.target.value)}
              style={{
                padding:'9px 12px', fontSize:13, border:'1px solid var(--rule-2)',
                borderRadius:6, background:'var(--paper)', outline:'none', fontFamily:'inherit',
              }} />
          </label>
          <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <span style={{ fontSize:11.5, color:'var(--ink-3)', fontWeight:500 }}>ข้อความ</span>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              style={{
                padding:'9px 12px', fontSize:13, border:'1px solid var(--rule-2)',
                borderRadius:6, background:'var(--paper)', outline:'none',
                fontFamily:'inherit', minHeight:96, resize:'vertical',
              }} />
          </label>
          <div style={{ padding:'10px 14px', background:'var(--surface-2)', borderRadius:6, fontSize:11.5, color:'var(--ink-3)' }}>
            📎 จะแนบผลการตรวจสอบและไฟล์สัญญาฉบับร่าง
          </div>
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', background:'var(--surface-2)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={() => onSend({ to: to.trim(), note: note.trim() })}>
            {Icons.external} ส่งให้ฝ่ายกฎหมาย
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadFinalModal({ onUpload, onDone, onClose }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');

  async function submit() {
    if (!file) { setErr('กรุณาเลือกไฟล์'); return; }
    setBusy(true); setErr('');
    const res = await onUpload(file);
    setBusy(false);
    if (!res || !res.ok) { setErr(res?.error || 'อัปโหลดไม่สำเร็จ'); return; }
    onDone();
  }

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(20,18,14,0.32)',
      display:'grid', placeItems:'center', zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} className="card"
           style={{ width:520, padding:0, boxShadow:'var(--sh-pop)' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)' }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>ขั้นสุดท้าย</div>
          <h3 className="h-section">อัพโหลดเอกสารฉบับ Final</h3>
        </div>
        <div style={{ padding:24 }}>
          {err && (
            <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
          )}
          <p style={{ fontSize:13, color:'var(--ink-2)', margin:'0 0 16px', lineHeight:1.6 }}>
            อัพโหลดไฟล์สัญญาที่ผ่านการตรวจสอบจากฝ่ายกฎหมายและเซ็นเรียบร้อย — เมื่อบันทึกแล้ว สถานะจะเปลี่ยนเป็น Final
          </p>
          <label style={{
            display:'block', padding:'24px 20px',
            border:'2px dashed var(--rule-2)', borderRadius:8,
            background:'var(--surface-2)', textAlign:'center', cursor:'pointer',
          }}>
            <div style={{ fontSize:24, color:'var(--ink-4)', marginBottom:6 }}>↑</div>
            <div style={{ fontSize:12.5, fontWeight:500, color:'var(--ink-2)' }}>
              ลากไฟล์ หรือ <span style={{ color:'var(--teal)', textDecoration:'underline' }}>เลือกไฟล์</span>
            </div>
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,.gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display:'none' }}
              onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
          {file && (
            <div style={{
              marginTop:14, display:'flex', gap:12, alignItems:'center',
              padding:'10px 14px', background:'var(--surface-2)',
              border:'1px solid var(--rule)', borderRadius:6,
            }}>
              <div style={{ width:30, height:36, background:'var(--clay)', color:'#fff',
                  borderRadius:3, display:'grid', placeItems:'center',
                  fontSize:8, fontWeight:600, letterSpacing:0.4, flexShrink:0 }}>PDF</div>
              <div style={{ flex:1, fontSize:12.5 }}>{file.name}</div>
              <button className="btn ghost sm" onClick={() => setFile(null)} style={{ color:'var(--ink-4)' }}>×</button>
            </div>
          )}
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', background:'var(--surface-2)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
          <button className="btn primary" disabled={!file || busy} onClick={submit}
            style={{ opacity: (file && !busy) ? 1 : 0.5, cursor: (file && !busy) ? 'pointer' : 'not-allowed' }}>
            {busy ? 'กำลังอัปโหลด…' : <>{Icons.check} บันทึก & ปิดสัญญา</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =================== Subcomponents =================== */

function KV({ label, value, mono }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--rule)', fontSize:12.5 }}>
      <span style={{ color:'var(--ink-3)' }}>{label}</span>
      <span style={{
        color:'var(--ink)', fontWeight:500,
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        fontSize: mono ? 12 : 12.5,
      }}>{value}</span>
    </div>
  );
}

const inputStyle = {
  padding:'9px 12px', fontSize:13,
  border:'1px solid var(--rule-2)', borderRadius:6,
  background:'var(--paper)', color:'var(--ink)',
  outline:'none', fontFamily:'inherit', width:'100%',
};
