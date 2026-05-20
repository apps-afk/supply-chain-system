'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Icons, Chip, Av, money } from '../lib/shell';
import { SettingsSearchBox } from '../lib/settings-shared';
/*
  Contract module — upload-driven AI review workflow.

  Wired to /api/contracts, /api/upload (Google Drive), /api/attachments.

  DB statuses: draft | active | expired | terminated
  UI workflow phases (visual prototype):
    Uploaded → Reviewing → Reviewed → Legal → Final
  Mapping for the 5-stat pipeline at the top of the list:
    draft     → Uploaded  (just uploaded, awaiting AI review)
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
  Uploaded:  { bg:'#F0E4C5',             fg:'#6B5121',             dot:'var(--ochre)', label:'รอตรวจ AI' },
  Reviewing: { bg:'var(--teal-soft)',    fg:'var(--teal-ink)',     dot:'var(--teal)',  label:'AI กำลังตรวจ' },
  Reviewed:  { bg:'#DEE7E3',             fg:'#1F4D40',             dot:'var(--teal)',  label:'AI ตรวจเสร็จ' },
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
  const yr = t.match(/(\d+)\s*(?:ปี|year)/);
  const mo = t.match(/(\d+)\s*(?:เดือน|month)/);
  const dy = t.match(/(\d+)\s*(?:วัน|day)/);
  if (yr) days += parseInt(yr[1], 10) * 365;
  if (mo) days += parseInt(mo[1], 10) * 30;
  if (dy) days += parseInt(dy[1], 10);
  return days > 0 ? days : null;
}

/**
 * Compute retention release status for a contract: when can the supplier
 * come back and reclaim their retention money?
 * Base date = signed_at or end_date; release = base + warranty days.
 * Returns { state: 'due' | 'soon' | 'pending' | 'unknown', releaseDate, daysLeft }
 */
function retentionStatus(contract) {
  const warrantyDays = parseWarrantyDays(contract?.warranty);
  const baseStr = contract?.signed_at || contract?.end_date;
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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    });
  }, [contracts, projectFilter, q, supById, projById, typeById]);

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
          <button className="btn primary" onClick={() => setUploadOpen(true)}>{Icons.upload} อัพโหลดเอกสาร</button>
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
              <th style={{ width:'12%' }}>ประเภทเอกสาร</th>
              <th>ชื่อเอกสาร</th>
              <th>คู่สัญญา</th>
              <th className="num-col">มูลค่าสัญญา</th>
              <th>วันเริ่มต้น</th>
              <th>วันสิ้นสุด</th>
              <th>ระยะเวลารับประกัน</th>
              <th>Retention</th>
              <th style={{ width:80 }}>ไฟล์</th>
              <th style={{ width:40 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล
              </td></tr>
            ) : filtered.map(c => {
              const supplierName = supName(c.supplier_id);
              const projectName  = projName(c.project_id);
              const type         = typeById.get(c.type_id);
              const atts = attachmentsByContract[c.id] || [];
              const latest = atts[0];
              const ret = retentionStatus(c);
              const retColor = ret.state === 'due' ? '#8B2A1A'
                             : ret.state === 'soon' ? '#6B5121'
                             : ret.state === 'pending' ? 'var(--ink-3)'
                             : 'var(--ink-4)';
              const retLabel = ret.state === 'due'
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
  // 'ai'   = ส่งให้ AI ตรวจสอบเข้า workflow 5 ขั้น (status เริ่ม='draft')
  // 'skip' = ไฟล์ผ่านการตรวจสอบมาแล้ว / ไม่ต้องตรวจ → บันทึก + active ทันที
  const [reviewMode, setReviewMode] = useState('ai');
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
                { value:'ai',   label:'ส่งให้ AI ตรวจสอบ',        sub:'เข้า workflow 5 ขั้น (AI → ฝ่ายกฎหมาย → Final)' },
                { value:'skip', label:'ผ่านการตรวจสอบแล้ว', sub:'ข้ามขั้นตอน — บันทึกไฟล์เข้า Drive ทันที' },
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
            อัพโหลดไฟล์ PDF ของสัญญาที่ทำแล้วภายนอก ระบบจะยังไม่เริ่มตรวจสอบจนกว่าจะกด <strong>คอนเฟิร์มให้ AI ตรวจ</strong> ในหน้าถัดไป
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
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,.gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*" style={{ display:'none' }}
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

  // phase: 'Uploaded' | 'Reviewing' | 'Reviewed' | 'Legal' | 'Final'
  const [phase, setPhase] = useState('Uploaded');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [legalOpen,   setLegalOpen]   = useState(false);
  const [finalOpen,   setFinalOpen]   = useState(false);

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
          // map DB status to a starting phase
          setPhase(DB_TO_BUCKET[picked.status] || 'Uploaded');
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
  const sp = CT_STATUS[phase] || CT_STATUS.Uploaded;

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
      // Mark contract as active in DB now that final is uploaded
      try {
        await fetch('/api/contracts', {
          method:'PATCH',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ id: contract.id, status:'active', signed_at: new Date().toISOString().slice(0,10) }),
        });
      } catch {}
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
        {contract && (
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

      {/* If contract is already 'active' (skipped review or workflow done),
          show a simple archive view instead of the AI workflow stepper. */}
      {contract && contract.status === 'active' && (
        <ActiveContractView
          contract={contract}
          attachments={attachments}
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

      {/* AI workflow only shown when status is still 'draft' */}
      {contract && contract.status !== 'active' && (
      <>
      {/* Workflow stepper — horizontal */}
      <div style={{ marginBottom:32, padding:'18px 22px', background:'var(--surface-2)', border:'1px solid var(--rule)', borderRadius:8 }}>
        <div className="eyebrow" style={{ marginBottom:14 }}>ขั้นตอนตรวจสอบสัญญา</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:0, alignItems:'flex-start' }}>
          {[
            { key:'Uploaded',  label:'1. อัพโหลดเอกสาร', sub:'รับไฟล์จากภายนอก' },
            { key:'Reviewing', label:'2. AI กำลังตรวจ',  sub:'หลังกดคอนเฟิร์ม' },
            { key:'Reviewed',  label:'3. AI Report',     sub:'รายการที่ต้องแก้' },
            { key:'Legal',     label:'4. ส่งฝ่ายกฎหมาย', sub:'รอผลตรวจ' },
            { key:'Final',     label:'5. Upload Final',  sub:'ไฟล์สัญญาสุดท้าย' },
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
                <strong> ส่งให้ AI ตรวจสอบ </strong>(วิเคราะห์เทียบ Template มาตรฐาน)
                หรือ <strong>ข้ามไป Final</strong> ถ้าเอกสารผ่านการตรวจจากภายนอกแล้ว
              </p>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, maxWidth:640, margin:'0 auto' }}>
                {/* Option A — AI review */}
                <div style={{
                  padding:'20px 18px', borderRadius:10,
                  border:'1.5px solid var(--rule-2)', background:'var(--surface)',
                  textAlign:'left', display:'flex', flexDirection:'column', gap:10,
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{
                      width:30, height:30, borderRadius:999, background:'var(--teal-soft)',
                      color:'var(--teal-ink)', display:'grid', placeItems:'center', fontSize:13, fontWeight:600,
                    }}>AI</span>
                    <span style={{ fontSize:14, fontWeight:600 }}>ส่งให้ AI ตรวจสอบ</span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--ink-3)', lineHeight:1.55, flex:1 }}>
                    วิเคราะห์เทียบ Template + ออก Report ประเด็นที่ต้องแก้ ใช้เวลา 1–2 นาที
                  </div>
                  <button className="btn primary" onClick={() => setConfirmOpen(true)} disabled={!contract}>
                    {Icons.sparkles} เริ่ม AI ตรวจ
                  </button>
                </div>

                {/* Option B — skip AI, mark active directly */}
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
                  <button
                    className="btn"
                    disabled={!contract}
                    onClick={async () => {
                      if (!confirm('ยืนยันข้ามขั้นตอน AI/ฝ่ายกฎหมาย และบันทึกสัญญาเป็น "ใช้งานอยู่"?')) return;
                      try {
                        const r = await fetch('/api/contracts', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            id: contract.id,
                            status: 'active',
                            signed_at: new Date().toISOString().slice(0,10),
                          }),
                        });
                        const d = await r.json();
                        if (!r.ok) { alert(`บันทึกไม่สำเร็จ: ${d.error || 'ไม่ทราบสาเหตุ'}`); return; }
                        setContract(d.item || { ...contract, status:'active', signed_at: new Date().toISOString().slice(0,10) });
                        setPhase('Final');
                      } catch (e) {
                        alert(`เครือข่ายขัดข้อง: ${e.message}`);
                      }
                    }}
                  >
                    บันทึกและข้าม
                  </button>
                </div>
              </div>

              <button
                className="btn ghost"
                onClick={() => deleteCurrentContract()}
                style={{ marginTop:18, color:'var(--clay)' }}>
                ยกเลิก / ลบเอกสารนี้
              </button>
            </div>
          )}

          {/* Phase 2: Reviewing — animated waiting state */}
          {phase === 'Reviewing' && (
            <div className="card" style={{ padding:32, textAlign:'center' }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
                <span style={{
                  width:48, height:48, borderRadius:999,
                  background:'var(--teal)', color:'var(--paper)',
                  display:'inline-grid', placeItems:'center', fontSize:18, fontWeight:600,
                }}>AI</span>
              </div>
              <h2 className="h-section" style={{ marginBottom:8 }}>AI กำลังตรวจสอบสัญญา…</h2>
              <p style={{ fontSize:13, color:'var(--ink-3)', maxWidth:420, margin:'0 auto 20px', lineHeight:1.6 }}>
                กำลังเทียบสัญญากับ Template มาตรฐาน · ตรวจสอบเงื่อนไข · สรุปประเด็นที่ต้องแก้
              </p>
              <div style={{ width:'80%', maxWidth:420, height:6, margin:'0 auto', background:'var(--rule)', borderRadius:999, overflow:'hidden' }}>
                <div style={{ height:'100%', width:'68%', background:'var(--teal)', borderRadius:999 }} />
              </div>
              <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:8 }}>ประมาณ 30 วินาที</div>
              <button className="btn sm" onClick={() => setPhase('Reviewed')} style={{ marginTop:24 }}>
                (ข้าม · ดู Report สำหรับ demo)
              </button>
            </div>
          )}

          {/* Phase 3+: AI Report */}
          {(phase === 'Reviewed' || phase === 'Legal' || phase === 'Final') && (
            <AIReportPanel
              phase={phase}
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

          {/* Demo helper: jump to any phase */}
          <div className="card" style={{ background:'var(--surface-2)' }}>
            <div className="eyebrow" style={{ marginBottom:8 }}>Demo · ทดสอบแต่ละขั้นตอน</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {['Uploaded','Reviewing','Reviewed','Legal','Final'].map(p => (
                <button key={p} onClick={() => setPhase(p)} className="btn sm" style={{
                  background: phase === p ? 'var(--ink)' : 'transparent',
                  color: phase === p ? 'var(--paper)' : 'var(--ink-2)',
                  borderColor: phase === p ? 'var(--ink)' : 'var(--rule)',
                  fontSize:10.5, padding:'4px 8px',
                }}>{CT_STATUS[p].label}</button>
              ))}
            </div>
          </div>
        </aside>
      </div>
      </>
      )}

      {confirmOpen && (
        <ConfirmAIModal
          onConfirm={() => { setConfirmOpen(false); setPhase('Reviewing'); setTimeout(() => setPhase('Reviewed'), 2000); }}
          onClose={() => setConfirmOpen(false)} />
      )}
      {legalOpen && (
        <SendToLegalModal
          onSend={() => { setLegalOpen(false); setPhase('Legal'); }}
          onClose={() => setLegalOpen(false)} />
      )}
      {finalOpen && (
        <UploadFinalModal
          onUpload={uploadFinalFile}
          onDone={() => { setFinalOpen(false); setPhase('Final'); }}
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
        />
      )}
    </div>
  );
}

/* =================== Contract Archive (mini list) =================== */
function ContractArchive({ contracts, currentId, attachmentsByContract, suppliers, projects, go }) {
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
              const bucket = DB_TO_BUCKET[c.status];
              const sp = bucket ? CT_STATUS[bucket] : { bg:'var(--paper-2)', fg:'var(--ink-3)', dot:'var(--ink-4)', label: DB_STATUS_LABEL[c.status] || c.status };
              const atts = attachmentsByContract[c.id] || [];
              const latest = atts[0];
              const isCurrent = c.id === currentId;
              return (
                <tr key={c.id}
                  onClick={() => {
                    if (isCurrent) return;
                    try { window.localStorage.setItem('contract.currentId', c.id); } catch {}
                    go('contract-detail');
                    // Force reload of detail by re-navigating
                    if (typeof window !== 'undefined') window.location.reload();
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

/* =================== AI Report panel =================== */
/* ----------------------------------------------------------
   ActiveContractView — shown when contract.status === 'active'
   (either skipped AI review at upload, or completed full workflow).
   Clean archive view: file list + simple actions. No phase stepper.
   ---------------------------------------------------------- */
function ActiveContractView({ contract, attachments, onUploadAddon }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = React.useRef(null);

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

          <hr className="hr" style={{ margin:'22px 0 18px' }} />

          <div className="eyebrow" style={{ marginBottom:8 }}>เพิ่มไฟล์ใหม่ (Addendum / Amendment)</div>
          <p style={{ fontSize:12.5, color:'var(--ink-3)', margin:'0 0 12px' }}>
            อัปโหลดไฟล์เพิ่มเติม เช่น สัญญาแก้ไข, แนบเอกสารประกอบ — จะถูกเก็บใน folder เดียวกัน
          </p>
          {err && (
            <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:12 }}>{err}</div>
          )}
          <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,.gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
            onChange={e => handleFile(e.target.files?.[0])}
            disabled={busy}
            style={{ fontSize:13 }} />
          {busy && <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:8 }}>กำลังอัปโหลด…</div>}
        </div>
      </div>

      <aside>
        <div className="card" style={{ padding:24 }}>
          <div className="eyebrow" style={{ marginBottom:10 }}>ข้อมูลสัญญา</div>
          <KV label="เลขที่สัญญา" value={contract.no} mono />
          <KV label="สถานะ" value={
            <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:999,
              background:'#DEE7E3', color:'#1F4D40', fontSize:11, fontWeight:500 }}>
              ใช้งานอยู่
            </span>
          } />
          <KV label="วันเซ็น" value={contract.signed_at ? fmtDate(contract.signed_at) : '—'} />
          <KV label="เริ่มสัญญา" value={contract.start_date ? fmtDate(contract.start_date) : '—'} />
          <KV label="สิ้นสุดสัญญา" value={contract.end_date ? fmtDate(contract.end_date) : '—'} />
          <KV label="รับประกันผลงาน" value={contract.warranty || '—'} />
        </div>
      </aside>
    </div>
  );
}

function AIReportPanel({ phase, onSendToLegal, onUploadFinal }) {
  const findings = [];

  return (
    <>
      <div className="card" style={{ padding:28, background:'var(--surface-2)', marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom:6 }}>AI Risk Report</div>
            <h2 className="h-section" style={{ margin:0 }}>สรุปประเด็นที่ต้องแก้</h2>
          </div>
          <Chip kind="ai">Claude Sonnet</Chip>
        </div>

        <div style={{ padding:'24px 0', textAlign:'center', color:'var(--ink-3)', fontSize:13 }}>
          ยังไม่มีข้อมูล
        </div>

        <div style={{ display:'flex', gap:8, marginTop:24, paddingTop:20, borderTop:'1px solid var(--rule)' }}>
          <button className="btn">{Icons.download} ดาวน์โหลด Report</button>
          {phase === 'Reviewed' && (
            <button className="btn primary" onClick={onSendToLegal}>
              {Icons.external} ส่ง Report ให้ฝ่ายกฎหมาย
            </button>
          )}
          {phase === 'Legal' && (
            <>
              <div style={{ flex:1, padding:'8px 14px', background:'var(--chip-recv-bg)', color:'var(--chip-recv-fg)', borderRadius:6, fontSize:12, display:'flex', alignItems:'center', gap:8 }}>
                <span>{Icons.clock}</span> รอผลตรวจจากฝ่ายกฎหมาย
              </div>
              <button className="btn primary" onClick={onUploadFinal}>
                {Icons.upload} Upload Final
              </button>
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

      <h3 className="h-section" style={{ marginBottom:16 }}>รายการที่ต้องแก้ ({findings.length} ข้อ)</h3>
      {findings.length === 0 ? (
        <div className="card" style={{ padding:40, textAlign:'center', color:'var(--ink-3)', fontSize:13 }}>
          ยังไม่มีข้อมูล
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {findings.map((f, i) => (
            <Finding key={i} {...f} />
          ))}
        </div>
      )}
    </>
  );
}

/* =================== Modals =================== */

function ConfirmAIModal({ onConfirm, onClose }) {
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(20,18,14,0.32)',
      display:'grid', placeItems:'center', zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} className="card"
           style={{ width:480, padding:0, boxShadow:'var(--sh-pop)' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)' }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>ก่อนเริ่มตรวจสอบ</div>
          <h3 className="h-section">ยืนยันให้ AI ตรวจสอบ</h3>
        </div>
        <div style={{ padding:24 }}>
          <p style={{ margin:'0 0 14px', fontSize:13.5, color:'var(--ink-2)', lineHeight:1.7 }}>
            AI จะอ่านเนื้อหาสัญญาทั้งฉบับและออก Report ภายใน 1–2 นาที — กรุณายืนยันก่อนเริ่ม
          </p>
          <ul style={{ margin:0, paddingLeft:18, fontSize:12.5, color:'var(--ink-3)', lineHeight:1.9 }}>
            <li>ระบบจะส่งข้อมูลไป AI Service ที่บริษัทใช้</li>
            <li>ผลที่ได้เป็นเพียงคำแนะนำ — ต้องตรวจสอบโดยฝ่ายกฎหมายอีกครั้ง</li>
            <li>เริ่มได้ทันที · กดยกเลิกได้ระหว่างประมวลผล</li>
          </ul>
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', background:'var(--surface-2)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={onConfirm}>
            {Icons.sparkles} ยืนยัน · เริ่มตรวจสอบ
          </button>
        </div>
      </div>
    </div>
  );
}

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
          <h3 className="h-section">ส่ง AI Report ให้ฝ่ายกฎหมาย</h3>
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
            📎 จะแนบ AI Report และไฟล์สัญญาฉบับร่าง
          </div>
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', background:'var(--surface-2)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={onSend}>
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
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,.gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*" style={{ display:'none' }}
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

function Finding({ tone, title, clause, category, body, isPositive }) {
  const tones = {
    warn: 'var(--ochre)',
    err:  'var(--clay)',
    info: isPositive ? 'var(--moss)' : 'var(--teal)',
  };
  return (
    <div style={{
      background:'var(--surface)',
      border:'1px solid var(--rule)',
      borderLeft:`3px solid ${tones[tone]}`,
      borderRadius:6, padding:20,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:14, fontWeight:500 }}>{title}</span>
          {isPositive && <span style={{ color:'var(--moss)', fontSize:14 }}>✓</span>}
        </div>
        <div style={{ display:'flex', gap:8, fontSize:11, color:'var(--ink-3)' }}>
          <span style={{ fontFamily:'var(--font-mono)' }}>{clause}</span>
          <span>·</span>
          <span>{category}</span>
        </div>
      </div>
      <p style={{ fontSize:12.5, color:'var(--ink-2)', lineHeight:1.6, margin:0 }}>{body}</p>
    </div>
  );
}

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
