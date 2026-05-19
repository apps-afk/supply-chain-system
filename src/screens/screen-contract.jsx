'use client';
import React, { useState, useEffect } from 'react';
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
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('ทั้งหมด');
  const [uploadOpen, setUploadOpen] = useState(false);

  async function load() {
    setLoading(true); setErr('');
    try {
      const [rContracts, rSuppliers, rProjects] = await Promise.all([
        fetch('/api/contracts'),
        fetch('/api/suppliers'),
        fetch('/api/projects'),
      ]);
      const dContracts = await rContracts.json();
      const dSuppliers = await rSuppliers.json();
      const dProjects  = await rProjects.json();
      if (!rContracts.ok) { setErr(dContracts.error || 'โหลดข้อมูลไม่สำเร็จ'); }
      setContracts(dContracts.items || []);
      setSuppliers(dSuppliers.items || []);
      setProjects(dProjects.items   || []);
    } catch {
      setErr('เครือข่ายขัดข้อง');
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const supName = (id) => suppliers.find(s => s.id === id)?.name || '—';
  const projName = (id) => projects.find(p => p.id === id)?.name || '—';

  const filtered = contracts.filter(c => {
    if (filter !== 'ทั้งหมด') {
      // filter can be either a UI bucket (Uploaded/Reviewing/...) or a DB status
      if (CT_STATUS[filter]) {
        if (DB_TO_BUCKET[c.status] !== filter) return false;
      } else if (c.status !== filter) {
        return false;
      }
    }
    if (q) {
      const v = q.toLowerCase();
      const hit =
        (c.no || '').toLowerCase().includes(v) ||
        (c.title || '').toLowerCase().includes(v) ||
        supName(c.supplier_id).toLowerCase().includes(v) ||
        projName(c.project_id).toLowerCase().includes(v);
      if (!hit) return false;
    }
    return true;
  });

  // Pipeline counts — derived from DB statuses via DB_TO_BUCKET
  const stats = ['Uploaded','Reviewing','Reviewed','Legal','Final'].map(b => ({
    s: b,
    count: contracts.filter(c => DB_TO_BUCKET[c.status] === b).length,
  }));

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Module 4 · สัญญา</div>
          <h1 className="h-display">สัญญา (Contracts)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:640 }}>
            อัพโหลดสัญญาที่ทำแล้วภายนอก ระบบจะให้ AI ตรวจสอบและออก Report
            · ทีมส่ง Report ให้กฎหมายตรวจ แล้ว Upload ไฟล์ Final กลับเข้าระบบ
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn primary" onClick={() => setUploadOpen(true)}>{Icons.upload} อัพโหลดสัญญา</button>
        </div>
      </div>

      {/* 5-status pipeline */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:12,
        marginBottom:32,
      }}>
        {stats.map((s,i) => {
          const sp = CT_STATUS[s.s];
          const isMine = filter === s.s;
          return (
            <button key={s.s} onClick={() => setFilter(filter === s.s ? 'ทั้งหมด' : s.s)}
              className="card" style={{
                padding:'16px 18px', textAlign:'left',
                border:'1px solid', cursor:'pointer',
                borderColor: isMine ? sp.dot : 'var(--rule)',
                background: 'var(--surface)',
                boxShadow: isMine ? `inset 0 0 0 1px ${sp.dot}` : 'none',
                fontFamily:'inherit',
              }}>
              <div className="eyebrow" style={{
                display:'inline-flex', alignItems:'center', gap:6,
                fontSize:10, color: sp.fg, marginBottom:6,
              }}>
                <span style={{ width:6, height:6, borderRadius:999, background:sp.dot }} />
                {sp.label}
              </div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:32, lineHeight:1 }}>{s.count}</div>
              <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:6 }}>
                {i === 0 && 'ยังไม่กดคอนเฟิร์มให้ AI ตรวจ'}
                {i === 1 && 'AI กำลังประมวลผล'}
                {i === 2 && 'Report พร้อมส่งฝ่ายกฎหมาย'}
                {i === 3 && 'อยู่ที่ทีมกฎหมาย'}
                {i === 4 && 'ปิดงาน · ใช้งานในระบบ'}
              </div>
            </button>
          );
        })}
      </div>

      {/* DB status filter pills */}
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4 }}>
          {['ทั้งหมด', ...Object.keys(DB_STATUS_LABEL)].map(f => (
            <button key={f} onClick={() => setFilter(f)} className="btn sm" style={{
              background: filter === f ? 'var(--ink)' : 'transparent',
              color: filter === f ? 'var(--paper)' : 'var(--ink-2)',
              borderColor: filter === f ? 'var(--ink)' : 'var(--rule)',
              padding:'5px 12px',
            }}>{f === 'ทั้งหมด' ? 'ทั้งหมด' : DB_STATUS_LABEL[f]}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหา CT / โครงการ / ผู้รับเหมา…" />
          <span style={{ fontSize:12, color:'var(--ink-3)' }}>
            <strong style={{ color:'var(--ink)' }}>{filtered.length}</strong> ฉบับ
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
              <th style={{ width:'12%' }}>เลขที่</th>
              <th>หัวข้อ / โครงการ</th>
              <th>คู่สัญญา</th>
              <th className="num-col">มูลค่า</th>
              <th>กิจกรรมล่าสุด</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล
              </td></tr>
            ) : filtered.map(c => {
              const bucket = DB_TO_BUCKET[c.status];
              const sp = bucket ? CT_STATUS[bucket] : { bg:'var(--paper-2)', fg:'var(--ink-3)', dot:'var(--ink-4)', label: DB_STATUS_LABEL[c.status] || c.status };
              const supplierName = supName(c.supplier_id);
              const projectName  = projName(c.project_id);
              return (
                <tr key={c.id} onClick={() => { window.localStorage.setItem('contract.currentId', c.id); go('contract-detail'); }} style={{ cursor:'pointer' }}>
                  <td>
                    <div className="font-mono" style={{ fontSize:12, color:'var(--ink-2)', fontWeight:500 }}>{c.no}</div>
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
                  <td style={{ fontSize:12, color:'var(--ink-3)' }}>{fmtDate(c.updated_at || c.created_at)}</td>
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
  const [form, setForm] = useState({
    title:       '',
    supplier_id: '',
    project_id:  '',
    type_id:     '',
    amount:      '',
    currency:    'THB',
    start_date:  '',
    end_date:    '',
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
      // 1) Create the contract row
      const payload = {
        no,
        title:       form.title.trim(),
        supplier_id: form.supplier_id || null,
        project_id:  form.project_id  || null,
        type_id:     form.type_id     || null,
        amount:      form.amount === '' ? null : Number(form.amount),
        currency:    form.currency || 'THB',
        status:      'draft',
        start_date:  form.start_date || null,
        end_date:    form.end_date   || null,
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
          <div className="eyebrow" style={{ marginBottom:4 }}>อัพโหลดสัญญาใหม่</div>
          <h3 className="h-section">ข้อมูลสัญญา + ไฟล์ PDF</h3>
        </div>
        <div style={{ padding:24, overflowY:'auto' }}>

          {err && (
            <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
          )}

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
            <div style={{ fontSize:11, color:'var(--ink-3)' }}>รองรับ .pdf · ไม่เกิน 25 MB</div>
            <input type="file" accept=".pdf,application/pdf" style={{ display:'none' }}
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

  useEffect(() => {
    (async () => {
      setLoading(true); setErr('');
      try {
        const stashed = (typeof window !== 'undefined') ? window.localStorage.getItem('contract.currentId') : null;
        const [rC, rS, rP] = await Promise.all([
          fetch('/api/contracts'),
          fetch('/api/suppliers'),
          fetch('/api/projects'),
        ]);
        const dC = await rC.json();
        const dS = await rS.json();
        const dP = await rP.json();
        if (!rC.ok) { setErr(dC.error || 'โหลดข้อมูลไม่สำเร็จ'); setLoading(false); return; }
        const items = dC.items || [];
        const picked = (stashed && items.find(c => c.id === stashed)) || items[0] || null;
        setContract(picked);
        setSuppliers(dS.items || []);
        setProjects(dP.items  || []);
        if (picked) {
          // map DB status to a starting phase
          setPhase(DB_TO_BUCKET[picked.status] || 'Uploaded');
          await loadAttachments(picked.id);
        }
      } catch {
        setErr('เครือข่ายขัดข้อง');
      }
      setLoading(false);
    })();
  }, []);

  const supplier = suppliers.find(s => s.id === contract?.supplier_id);
  const project  = projects.find(p  => p.id === contract?.project_id);
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
      </div>

      {/* Workflow stepper — horizontal */}
      <div style={{ marginBottom:32, padding:'18px 22px', background:'var(--surface-2)', border:'1px solid var(--rule)', borderRadius:8 }}>
        <div className="eyebrow" style={{ marginBottom:14 }}>ขั้นตอนตรวจสอบสัญญา</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:0, alignItems:'flex-start' }}>
          {[
            { key:'Uploaded',  label:'1. อัพโหลดสัญญา', sub:'รับไฟล์จากภายนอก' },
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
              <h2 className="h-section" style={{ marginBottom:8 }}>คอนเฟิร์มให้ AI ตรวจสอบสัญญานี้?</h2>
              <p style={{ fontSize:13.5, color:'var(--ink-2)', lineHeight:1.7, margin:'0 auto 24px', maxWidth:480 }}>
                ระบบจะใช้ AI วิเคราะห์ข้อความในสัญญาเทียบกับ Template มาตรฐานของบริษัท
                และออก Report รายการประเด็นที่ต้องแก้ไข ใช้เวลาประมาณ <strong>1–2 นาที</strong>
              </p>
              <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                <button className="btn ghost">ยกเลิก / ลบไฟล์</button>
                <button className="btn primary" onClick={() => setConfirmOpen(true)} style={{ padding:'10px 24px' }} disabled={!contract}>
                  {Icons.sparkles} คอนเฟิร์มให้ AI ตรวจสอบ
                </button>
              </div>
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
    </div>
  );
}

/* =================== AI Report panel =================== */
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
          <h3 className="h-section">อัพโหลดสัญญาฉบับ Final</h3>
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
            <input type="file" accept=".pdf,application/pdf" style={{ display:'none' }}
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
