'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Icons, Chip, Av, Spark, Delta, money } from '../lib/shell';
import { downloadRfqExcel, ExcelDocPreview } from './screen-rfq-create';
import { findUnit } from '../lib/settings-shared';

// Read the supplier's filled-in quote workbook and pull out the unit price
// they entered per line (matched by the item code in column B → price in
// column G), plus the Overhead/VAT % from the totals rows. Mirrors the
// layout produced by downloadRfqExcel.
async function parseQuoteExcel(file, itemCodes) {
  const _xl = await import('exceljs');
  const ExcelJS = _xl.default || _xl;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  const codeSet = new Set(itemCodes);
  const priceByCode = {};
  let overheadPct = null, vatPct = null;
  // ExcelJS cell.value can be: number, string, Date, {formula,result},
  // {richText:[...]}, {hyperlink,text}, or {error}. Pull a numeric value
  // out of any of these.
  const num = (v) => {
    if (v == null) return NaN;
    if (typeof v === 'number') return v;
    if (v instanceof Date) return NaN;
    if (typeof v === 'object') {
      if (v.error) return NaN;
      if (Array.isArray(v.richText)) return num(v.richText.map(t => t.text).join(''));
      if (v.result !== undefined) return num(v.result);
      if (v.text !== undefined) return num(v.text);     // hyperlink
      if (v.value !== undefined) return num(v.value);
      return NaN;
    }
    const n = Number(String(v).replace(/[^\d.\-]/g, ''));
    return n;
  };
  // A code cell may also be richText/string — read its plain text.
  const txt = (v) => {
    if (v == null) return '';
    if (typeof v === 'object') {
      if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('');
      if (v.text !== undefined) return String(v.text);
      if (v.result !== undefined) return String(v.result);
    }
    return String(v);
  };
  let matched = 0;
  ws?.eachRow((row) => {
    const code  = txt(row.getCell(2).value).trim();            // col B
    if (codeSet.has(code)) {
      const p = num(row.getCell(7).value);                     // col G price/unit
      if (!Number.isNaN(p)) { priceByCode[code] = p; matched++; }
    }
    const labelA = txt(row.getCell(1).value);
    if (/overhead/i.test(labelA)) { const v = num(row.getCell(7).value); if (!Number.isNaN(v)) overheadPct = v; }
    else if (/vat/i.test(labelA)) { const v = num(row.getCell(7).value); if (!Number.isNaN(v)) vatPct = v; }
  });
  return { priceByCode, overheadPct, vatPct, matched, total: itemCodes.length };
}

/*
  RFQ — list + the post-quote "confirm to Price DB" screen.

  Wired to /api/rfqs (CRUD), /api/upload (Drive), /api/attachments.

  DB statuses: draft | sent | received | closed | cancelled
*/

/* =================== Constants =================== */

const RFQ_STATUS = {
  draft:     { bg:'var(--paper-2)',      fg:'var(--ink-3)',         dot:'var(--ink-4)', label:'ร่าง' },
  sent:      { bg:'var(--ochre-soft)',   fg:'#6B5121',              dot:'var(--ochre)', label:'ส่งแล้ว · รอตอบกลับ' },
  received:  { bg:'var(--moss-soft)',    fg:'#2F4A1A',              dot:'var(--moss)',  label:'ได้รับ Quote' },
  closed:    { bg:'var(--teal-soft)',    fg:'var(--teal-ink)',      dot:'var(--teal)',  label:'ปิดงาน' },
  cancelled: { bg:'var(--clay-soft)',    fg:'#6B2D1A',              dot:'var(--clay)',  label:'ยกเลิก' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' });
  } catch { return iso; }
}

/* =================== List =================== */

export function ScreenRFQ({ go }) {
  const [rfqs,     setRfqs]     = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState('');
  const [filter,   setFilter]   = useState('ทั้งหมด');
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true); setErr('');
    try {
      const [rR, rP] = await Promise.all([
        fetch('/api/rfqs'),
        fetch('/api/projects'),
      ]);
      const dR = await rR.json();
      const dP = await rP.json();
      // Don't overwrite items[] when the response was an error — without this
      // a 401 from /api/rfqs would simultaneously surface "unauthorised" and
      // wipe the list to [], hiding any prior data the user had on screen.
      if (!rR.ok) {
        setErr(dR.error || 'โหลดข้อมูลไม่สำเร็จ');
      } else {
        setRfqs(dR.items || []);
      }
      if (rP.ok) setProjects(dP.items || []);
    } catch {
      setErr('เครือข่ายขัดข้อง');
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // O(1) project name lookup
  const projById = useMemo(() => {
    const m = new Map();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);
  const projName = (id) => projById.get(id)?.name || '—';

  // Past-due heuristic: due_date in the past + status 'sent'
  const today = new Date().toISOString().slice(0,10);

  // status counts + overdue computed in one pass (was 6 .filter() calls per render)
  const { statusCounts, overdue } = useMemo(() => {
    const counts = { draft:0, sent:0, received:0, closed:0, cancelled:0 };
    let od = 0;
    for (const r of rfqs) {
      if (counts[r.status] !== undefined) counts[r.status]++;
      if (r.status === 'sent' && r.due_date && r.due_date < today) od++;
    }
    return { statusCounts: counts, overdue: od };
  }, [rfqs, today]);

  const filtered = useMemo(() => {
    const v = q.toLowerCase();
    return rfqs.filter(r => {
      if (filter !== 'ทั้งหมด' && r.status !== filter) return false;
      if (q) {
        if (!((r.no || '').toLowerCase().includes(v) || (r.title || '').toLowerCase().includes(v) || (projById.get(r.project_id)?.name || '').toLowerCase().includes(v))) return false;
      }
      return true;
    });
  }, [rfqs, filter, q, projById]);

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Module 1 · จัดซื้อจัดจ้าง</div>
          <h1 className="h-display">ใบขอให้เสนอราคา (RFQ)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:560 }}>
            หนึ่งใบ ต่อ Supplier หนึ่งราย — สำหรับเทียบราคาให้สร้างหลายใบ
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" onClick={() => {
            // Clear any stale stashed id so the confirm screen opens the most
            // recent RFQ deterministically — not whichever row was viewed last
            // session (risk: quote attached to the wrong RFQ).
            try { window.localStorage.removeItem('rfq.currentId'); } catch {}
            go('rfq-confirm');
          }}>{Icons.upload} Upload Quote</button>
          <button className="btn primary" onClick={() => go('rfq-create')}>{Icons.plus} สร้าง RFQ ใหม่</button>
        </div>
      </div>

      {/* Stat strip — derived counts from data */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:0,
        borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)',
        padding:'24px 0', marginBottom:32,
      }}>
        {Object.keys(RFQ_STATUS).map((s, i) => {
          const count = statusCounts[s] || 0;
          const sp = RFQ_STATUS[s];
          return (
            <div key={s} style={{ paddingLeft: i === 0 ? 0 : 24, borderLeft: i === 0 ? 'none' : '1px solid var(--rule)' }}>
              <div className="eyebrow" style={{
                display:'inline-flex', alignItems:'center', gap:6,
                fontSize:10, color: sp.fg, marginBottom:6,
              }}>
                <span style={{ width:6, height:6, borderRadius:999, background:sp.dot }} />
                {sp.label}
              </div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:28, lineHeight:1 }}>{count}</div>
              <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:4 }}>
                {s === 'sent' && overdue > 0 && <span style={{ color:'var(--clay)' }}>{overdue} ใบเกินกำหนด</span>}
                {s === 'sent' && overdue === 0 && 'รอ Supplier ตอบกลับ'}
                {s === 'draft' && 'ยังไม่ได้ส่งออก'}
                {s === 'received' && 'พร้อมตรวจสอบ'}
                {s === 'closed' && 'ปิดงานแล้ว'}
                {s === 'cancelled' && 'ยกเลิก'}
              </div>
            </div>
          );
        })}
      </div>

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {['ทั้งหมด', ...Object.keys(RFQ_STATUS)].map(f => (
            <button key={f} onClick={() => setFilter(f)} className="btn sm" style={{
              background: filter === f ? 'var(--ink)' : 'transparent',
              color: filter === f ? 'var(--paper)' : 'var(--ink-2)',
              borderColor: filter === f ? 'var(--ink)' : 'var(--rule)',
              padding:'5px 12px',
            }}>{f === 'ทั้งหมด' ? f : RFQ_STATUS[f].label}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, padding:'5px 10px', border:'1px solid var(--rule-2)', borderRadius:6, background:'var(--surface)', width:240 }}>
          {Icons.search}
          <input placeholder="ค้นหา RFQ No. / รายการ / Supplier…" value={q} onChange={e=>setQ(e.target.value)}
                 style={{ flex:1, border:0, outline:0, background:'transparent', fontSize:13 }} />
        </div>
        <span style={{ fontSize:12.5, color:'var(--ink-3)' }}>
          แสดง <strong style={{ color:'var(--ink)' }}>{filtered.length}</strong> รายการ
        </span>
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:'14%' }}>RFQ No.</th>
              <th>รายการ</th>
              <th>โครงการ</th>
              <th>วันที่สร้างเอกสาร</th>
              <th>วันที่ครบกำหนด</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>ยังไม่มีข้อมูล</td></tr>
            ) : filtered.map(r => {
              const sp = RFQ_STATUS[r.status] || RFQ_STATUS.draft;
              const overdueFlag = r.status === 'sent' && r.due_date && r.due_date < today;
              return (
                <tr key={r.id} onClick={() => {
                    try { window.localStorage.setItem('rfq.currentId', r.id); } catch {}
                    go('rfq-confirm');
                  }}
                  style={{ cursor: 'pointer' }}>
                  <td>
                    <div className="font-mono" style={{ fontSize:12, color:'var(--ink-2)', fontWeight:500 }}>{r.no}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight:500 }}>{r.title || '—'}</div>
                  </td>
                  <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{projName(r.project_id)}</td>
                  <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{fmtDate(r.created_at)}</td>
                  <td>
                    <div style={{ fontSize:12.5 }}>{fmtDate(r.due_date)}</div>
                    {overdueFlag && <div style={{ fontSize:11, color:'var(--clay)', marginTop:2 }}>เกินกำหนด</div>}
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =================== Post-quote confirm screen =================== */
/*
  Loads the "current" RFQ from localStorage (set by the list-row click).
  Lets the user upload the supplier's quote PDF into Drive under category
  'rfq_quote' linked to this RFQ id.  Items comparison stays mock for now
  (no per-item API yet).
*/

export function ScreenRFQConfirm({ go }) {
  const [rfq,        setRfq]        = useState(null);
  const [parsed,     setParsed]     = useState(null); // hydrated notes payload
  const [projects,   setProjects]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [err,        setErr]        = useState('');
  const [items,      setItems]      = useState([]);  // mock for now
  const [quoteFile,  setQuoteFile]  = useState(null);
  const [uploading,  setUploading]  = useState(false);
  const [uploadErr,  setUploadErr]  = useState('');
  const [uploadOk,   setUploadOk]   = useState(null); // attachment record
  const [dlBusy,     setDlBusy]     = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Master data needed to turn parsed quote rows into price points
  const [matByCode,  setMatByCode]  = useState({});   // code → { id, unit_id, name }
  const [units,      setUnits]      = useState([]);
  const [lastPrice,  setLastPrice]  = useState({});   // material_id → latest price
  const [readBusy,   setReadBusy]   = useState(false);
  const [savePxBusy, setSavePxBusy] = useState(false);
  const [savePxMsg,  setSavePxMsg]  = useState('');
  const [pricesSaved, setPricesSaved] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true); setErr('');
      try {
        const stashed = (typeof window !== 'undefined') ? window.localStorage.getItem('rfq.currentId') : null;
        const [r, rP, rM, rU, rPx] = await Promise.all([
          fetch('/api/rfqs'), fetch('/api/projects'),
          fetch('/api/materials'), fetch('/api/units'), fetch('/api/prices'),
        ]);
        const d = await r.json();
        if (!r.ok) { setErr(d.error || 'โหลดข้อมูลไม่สำเร็จ'); setLoading(false); return; }
        if (rP.ok) { try { setProjects((await rP.json()).items || []); } catch {} }
        if (rM.ok) {
          try {
            const mats = (await rM.json()).items || [];
            setMatByCode(Object.fromEntries(mats.map(m => [m.code, { id: m.id, unit_id: m.unit_id, name: m.name }])));
          } catch {}
        }
        if (rU.ok) { try { setUnits((await rU.json()).items || []); } catch {} }
        if (rPx.ok) {
          try {
            // Latest price per material (list is ordered captured_at desc)
            const pts = (await rPx.json()).items || [];
            const latest = {};
            for (const p of pts) { if (!(p.material_id in latest)) latest[p.material_id] = Number(p.price); }
            setLastPrice(latest);
          } catch {}
        }
        const list = d.items || [];
        const picked = (stashed && list.find(x => x.id === stashed)) || list[0] || null;
        setRfq(picked);
        // If notes contains stringified items, hydrate the items table
        if (picked?.notes) {
          try {
            const parsed = JSON.parse(picked.notes);
            setParsed(parsed);
            if (parsed && Array.isArray(parsed.items)) {
              setItems(parsed.items.map(it => ({
                ...it,
                // Items saved from RFQ-create carry uid/itemCode but no `id`;
                // the table keys + toggle rely on a stable id, so derive one.
                id:      it.id || it.uid || it.itemCode,
                save:    it.save ?? true,
                outlier: it.outlier ?? false,
                isNew:   it.isNew   ?? false,
                newP:    it.newP ?? 0,
                oldP:    it.oldP ?? null,
              })));
            }
          } catch { /* not JSON, ignore */ }
        }
      } catch {
        setErr('เครือข่ายขัดข้อง');
      }
      setLoading(false);
    })();
  }, []);

  async function uploadQuote() {
    if (!quoteFile || !rfq) return;
    setUploading(true); setUploadErr(''); setUploadOk(null);
    const fd = new FormData();
    fd.append('file', quoteFile);
    fd.append('category',    'rfq_quote');
    fd.append('entity_type', 'rfq');
    fd.append('entity_id',   rfq.id);
    fd.append('entity_ref',  rfq.no || '');
    try {
      const r = await fetch('/api/upload', { method:'POST', body: fd });
      const d = await r.json();
      if (!r.ok) {
        setUploadErr([d.error, d.detail, d.hint].filter(Boolean).join(' — ') || 'อัปโหลดไม่สำเร็จ');
        setUploading(false); return;
      }
      // bump status to 'received'
      try {
        await fetch('/api/rfqs', {
          method:'PATCH',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ id: rfq.id, status:'received' }),
        });
      } catch {}
      setUploadOk(d.file);
      // Read the just-uploaded workbook and pull the supplier's prices in.
      await readQuoteIntoItems(quoteFile);
    } catch {
      setUploadErr('เครือข่ายขัดข้อง');
    }
    setUploading(false);
  }

  // Parse a quote file and merge prices into the items table for review.
  async function readQuoteIntoItems(file) {
    if (!file) return;
    setReadBusy(true);
    try {
      // Derive codes inside the functional updater so we never read a stale
      // `items` closure after the table was edited.
      let codes = [];
      setItems(its => { codes = its.map(it => it.itemCode).filter(Boolean); return its; });
      const { priceByCode, matched, total } = await parseQuoteExcel(file, codes);
      setItems(its => its.map(it => {
        const px = priceByCode[it.itemCode];
        const mat = matByCode[it.itemCode];
        const oldP = mat && lastPrice[mat.id] != null ? lastPrice[mat.id] : (it.oldP ?? null);
        if (px == null) return { ...it, oldP };
        return { ...it, newP: px, oldP, save: true };
      }));
      if (matched === 0) {
        setUploadErr(`อ่านไฟล์แล้ว แต่ไม่พบราคาที่ตรงกับรหัสรายการ (0/${total}) — ตรวจสอบว่าใช้ไฟล์ Template ของ RFQ นี้และไม่ได้แก้คอลัมน์รหัส`);
      } else {
        setUploadErr('');
      }
    } catch (e) {
      setUploadErr('อ่านไฟล์ Excel ไม่สำเร็จ: ' + (e?.message || ''));
    }
    setReadBusy(false);
  }

  // Save the reviewed prices into the Price DB (Material items only — the
  // price_points table links to materials).
  async function savePrices() {
    if (!rfq) return;
    if (Object.keys(matByCode).length === 0) {
      setSavePxMsg('โหลดข้อมูลวัสดุไม่สำเร็จ — รีเฟรชหน้าแล้วลองใหม่');
      return;
    }
    const rows = items.filter(it => it.save && Number(it.newP) > 0 && it.source === 'Material' && matByCode[it.itemCode]);
    if (rows.length === 0) {
      setSavePxMsg('ไม่มีรายการวัสดุที่มีราคา (>0) ให้บันทึก · งานจ้างเหมายังไม่รองรับ Price DB');
      return;
    }
    setSavePxBusy(true); setSavePxMsg('');
    let ok = 0; const errs = [];
    for (const it of rows) {
      const mat = matByCode[it.itemCode];
      const unit = findUnit(units, it.unit);
      try {
        const r = await fetch('/api/prices', {
          method:'POST', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({
            material_id: mat.id,
            supplier_id: parsed?.supplier_id || null,
            price: Number(it.newP),
            unit_id: unit?.id || mat.unit_id || null,
            source: 'RFQ',
            source_id: rfq.no || '',
          }),
        });
        if (r.ok) ok++; else { const d = await r.json().catch(()=>({})); errs.push(`${it.name}: ${d.error || 'ไม่สำเร็จ'}`); }
      } catch (e) { errs.push(`${it.name}: ${e.message}`); }
    }
    // Close the RFQ once prices are captured
    if (ok > 0) {
      try {
        await fetch('/api/rfqs', { method:'PATCH', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ id: rfq.id, status:'closed' }) });
        setRfq(rf => ({ ...rf, status: 'closed' }));
      } catch {}
      setPricesSaved(true);
    }
    setSavePxMsg(`บันทึกเข้า Price DB สำเร็จ ${ok}/${rows.length} รายการ${errs.length ? ' · ' + errs.slice(0,3).join(' · ') : ''}`);
    setSavePxBusy(false);
  }

  const toggle = (id) => setItems(its => its.map(it => it.id === id ? { ...it, save: !it.save } : it));

  const [statusBusy, setStatusBusy] = useState(false);
  async function changeStatus(next) {
    if (!rfq || next === rfq.status) return;
    setStatusBusy(true);
    try {
      const r = await fetch('/api/rfqs', {
        method:'PATCH', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ id: rfq.id, status: next }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'เปลี่ยนสถานะไม่สำเร็จ'); }
      else { setRfq(rf => ({ ...rf, status: next })); }
    } catch { setErr('เครือข่ายขัดข้อง'); }
    setStatusBusy(false);
  }

  // Rebuild & download the RFQ Excel from the saved record. Item names +
  // contact + overhead all live in the notes payload, so no catalog needed.
  async function downloadExcel() {
    if (!rfq) return;
    setDlBusy(true); setErr('');
    try {
      const proj = projects.find(p => p.id === rfq.project_id);
      const rows = (parsed?.items || []).map(it => ({
        code: it.itemCode, name: it.name || '', spec: '', qty: it.qty, unit: it.unit,
      }));
      await downloadRfqExcel({
        rfqNo: rfq.no,
        supplier: { name: parsed?.supplier_name || '' },
        project: proj || null,
        title: rfq.title,
        due: rfq.due_date,
        contact: { name: parsed?.contact_name || '', email: parsed?.contact_email || '' },
        items: rows,
        overheadHint: parsed?.overheadHint || '',
        notes: parsed?.memo || '',
      });
    } catch (e) {
      setErr('สร้างไฟล์ Excel ไม่สำเร็จ: ' + (e?.message || ''));
    }
    setDlBusy(false);
  }

  const saving = items.filter(i => i.save).length;
  const flagged = items.filter(i => i.outlier).length;

  return (
    <div className="page" style={{ paddingBottom: 200 }}>
      <button className="btn ghost sm" onClick={() => go('rfq')} style={{ marginBottom: 20, marginLeft: -8 }}>
        {Icons.back} กลับไป RFQ
      </button>

      <div className="page-head" style={{ alignItems: 'flex-start' }}>
        <div className="page-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span className="font-mono" style={{ fontSize:12, color:'var(--ink-3)' }}>{rfq?.no || '—'}</span>
            <Chip kind="recv">{rfq?.status === 'received' ? 'รับ Quote แล้ว' : 'อัพโหลด Quote'}</Chip>
          </div>
          <h1 className="h-display">{loading ? 'กำลังโหลด…' : (rfq?.title || 'ตรวจสอบก่อนบันทึก Price DB')}</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: '8px 0 0', maxWidth: 620 }}>
            อัพโหลดไฟล์ใบเสนอราคาจาก Supplier (PDF) เก็บเข้า Google Drive · จากนั้นเปรียบเทียบราคากับ Price DB
          </p>
        </div>
        {rfq && (
          <div style={{ display:'flex', gap:16, alignItems:'flex-end' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-start' }}>
              <span style={{ fontSize:11.5, color:'var(--ink-3)' }}>เอกสาร RFQ</span>
              <button className="btn" onClick={downloadExcel} disabled={dlBusy || !parsed}>
                {Icons.download} {dlBusy ? 'กำลังสร้าง…' : 'ดาวน์โหลด Excel'}
              </button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>
              <span style={{ fontSize:11.5, color:'var(--ink-3)' }}>เปลี่ยนสถานะ</span>
              <select value={rfq.status || 'draft'} onChange={e => changeStatus(e.target.value)} disabled={statusBusy}
                style={{ padding:'8px 12px', fontSize:13, border:'1px solid var(--rule-2)', borderRadius:6, background:'var(--paper)', fontFamily:'inherit', cursor:'pointer' }}>
                {Object.keys(RFQ_STATUS).map(s => <option key={s} value={s}>{RFQ_STATUS[s].label}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>
      )}

      {/* Upload section */}
      <div className="card" style={{ padding:'20px 24px', marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <h3 className="h-card">อัพโหลด Quote PDF จาก Supplier</h3>
            <p style={{ fontSize:12.5, color:'var(--ink-3)', margin:'4px 0 0' }}>
              ไฟล์จะถูกเก็บเข้า Google Drive ภายใต้หมวด "ใบเสนอราคา (RFQ Quotes)"
            </p>
          </div>
        </div>

        {uploadErr && (
          <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:12 }}>{uploadErr}</div>
        )}

        {uploadOk ? (
          <div style={{
            padding:'12px 14px', background:'var(--moss-soft)',
            border:'1px solid var(--moss)', borderRadius:6,
            display:'flex', gap:12, alignItems:'center',
          }}>
            <span style={{ color:'var(--moss)' }}>{Icons.check}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:500, color:'#2F4A1A' }}>
                อัปโหลดสำเร็จ {readBusy ? '· กำลังอ่านราคา…' : '· อ่านราคาจากไฟล์แล้ว'}
              </div>
              <div style={{ fontSize:11.5, color:'#2F4A1A', marginTop:2 }}>
                {uploadOk.name} · เก็บเข้า Google Drive แล้ว · ตรวจสอบราคาด้านล่างก่อนบันทึกเข้า Price DB
              </div>
            </div>
            {quoteFile && (
              <button className="btn sm" onClick={() => readQuoteIntoItems(quoteFile)} disabled={readBusy}>
                {readBusy ? 'อ่าน…' : 'อ่านไฟล์อีกครั้ง'}
              </button>
            )}
            {uploadOk.viewLink && (
              <a href={uploadOk.viewLink} target="_blank" rel="noreferrer" className="btn sm">
                {Icons.external} เปิดดู
              </a>
            )}
          </div>
        ) : (
          <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
            <label style={{
              flex:'1 1 320px', padding:'18px 20px',
              border:'2px dashed var(--rule-2)', borderRadius:8,
              background:'var(--surface-2)', textAlign:'center', cursor:'pointer',
            }}>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--ink-2)', marginBottom:4 }}>
                {quoteFile ? quoteFile.name : <>เลือกไฟล์ PDF ของใบเสนอราคา</>}
              </div>
              <div style={{ fontSize:11, color:'var(--ink-3)' }}>
                {quoteFile ? `${Math.round(quoteFile.size/1024)} KB` : 'รองรับ PDF, Excel (.xls/.xlsx/.csv), Word, รูป · ไม่เกิน 25 MB'}
              </div>
              <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.heic,.heif,.gif,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display:'none' }}
                onChange={e => setQuoteFile(e.target.files?.[0] || null)} />
            </label>
            <button className="btn primary" disabled={!quoteFile || uploading || !rfq} onClick={uploadQuote}>
              {uploading ? 'กำลังอัปโหลด…' : <>{Icons.upload} อัพโหลด Quote</>}
            </button>
          </div>
        )}
      </div>

      {/* Preview of the RFQ document that gets exported to Excel (collapsible) */}
      {parsed && Array.isArray(parsed.items) && parsed.items.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <button onClick={() => setPreviewOpen(o => !o)}
              style={{ display:'inline-flex', alignItems:'center', gap:8, background:'none', border:0, padding:0, cursor:'pointer' }}>
              <span style={{ display:'inline-flex', transform: previewOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.15s', color:'var(--ink-3)' }}>
                {Icons.chevronD}
              </span>
              <h3 className="h-section" style={{ margin:0 }}>ตัวอย่างเอกสาร RFQ (ก่อน Export)</h3>
              <span style={{ fontSize:12, color:'var(--ink-3)' }}>· {parsed.items.length} รายการ</span>
            </button>
            <button className="btn" onClick={downloadExcel} disabled={dlBusy || !parsed}>
              {Icons.download} {dlBusy ? 'กำลังสร้าง…' : 'ดาวน์โหลด Excel'}
            </button>
          </div>
          {previewOpen && (
            <ExcelDocPreview
              rfqNo={rfq?.no}
              supplier={{ name: parsed.supplier_name || '' }}
              project={projects.find(p => p.id === rfq?.project_id) || null}
              items={parsed.items}
              catalog={{ itemByCode: new Map((parsed.items || []).map(it => [it.itemCode, { name: it.name, spec: '' }])) }}
              approvalRoles={[]}
              due={rfq?.due_date}
              title={rfq?.title}
              overheadHint={parsed.overheadHint || ''}
              vatPolicy={parsed.vatPolicy || 'supplier'}
              notes={parsed.memo || ''}
            />
          )}
        </div>
      )}

      {/* Main comparison panel — items table remains mock */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--rule)' }}>
          <div>
            <h3 className="h-card">เปรียบเทียบราคา · {items.length} รายการ</h3>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '4px 0 0' }}>
              <span style={{ color: 'var(--clay)' }}>● {flagged} รายการผิดปกติ</span>
              <span style={{ color: 'var(--ink-4)', margin: '0 8px' }}>·</span>
              <span style={{ color: 'var(--moss)' }}>● {saving} รายการจะบันทึก</span>
              <span style={{ color: 'var(--ink-4)', margin: '0 8px' }}>·</span>
              <span style={{ color: 'var(--ink-3)' }}>● {items.length - saving} รายการข้าม</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn sm" onClick={() => setItems(items.map(i => ({ ...i, save: true })))}>เลือกทั้งหมด</button>
            <button className="btn sm" onClick={() => setItems(items.map(i => ({ ...i, save: false })))}>ยกเลิกทั้งหมด</button>
          </div>
        </div>

        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th style={{ width: '28%' }}>รายการ</th>
              <th className="num-col">จำนวน</th>
              <th>ราคาเดิมใน DB</th>
              <th className="num-col">ราคาใหม่จาก RFQ</th>
              <th className="num-col">Δ เปลี่ยน</th>
              <th>ประวัติ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>ยังไม่มีข้อมูล — อัพโหลด Quote ก่อน · ฟีเจอร์เปรียบเทียบราคารายตัวจะเชื่อม API ในขั้นถัดไป</td></tr>
            ) : items.map((it) => {
              const delta = (it.oldP == null || Number(it.oldP) === 0) ? null : ((it.newP - it.oldP) / it.oldP) * 100;
              const dir = delta == null ? 'new' : delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat';
              return (
                <tr key={it.id} className={it.outlier ? 'row-flag-err' : ''}>
                  <td>
                    <label style={{ display: 'inline-flex', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={it.save}
                        onChange={() => toggle(it.id)}
                        style={{ width:16, height:16, accentColor:'var(--teal)', cursor:'pointer' }}
                      />
                    </label>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {it.name}
                      {it.isNew && <Chip kind="new">NEW</Chip>}
                      {it.outlier && <Chip kind="risk-high">{Icons.alert} ผิดปกติ</Chip>}
                    </div>
                    <div className="font-mono" style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>{it.id}</div>
                  </td>
                  <td className="num-col num" style={{ color: 'var(--ink-2)' }}>{(it.qty || 0).toLocaleString()} {it.unit}</td>
                  <td>
                    {it.oldP == null
                      ? <span style={{ fontSize:12, color:'var(--ink-4)' }}>— ไม่มีในระบบ</span>
                      : (<>
                          <span className="num">{money(it.oldP)}</span>
                          <div style={{ fontSize:11, color:'var(--ink-4)', marginTop:2 }}>{it.oldDate}</div>
                        </>)}
                  </td>
                  <td className="num-col">
                    <input
                      type="text"
                      value={(it.newP || 0).toLocaleString()}
                      onChange={(e) => {
                        // Strip commas/spaces so users can paste "1,234"
                        const n = Number(e.target.value.replace(/[^\d.-]/g, '')) || 0;
                        setItems(prev => prev.map(x => x.id === it.id ? { ...x, newP: n } : x));
                      }}
                      className="num"
                      style={{ width:90, padding:'6px 10px', fontSize:13, border:'1px solid var(--rule)', borderRadius:4, textAlign:'right', background:'var(--paper)' }} />
                    <span style={{ marginLeft:6, fontSize:11, color:'var(--ink-3)' }}>฿</span>
                  </td>
                  <td className="num-col">
                    {delta == null
                      ? <Delta dir="new" />
                      : <Delta pct={`${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`} dir={dir} />}
                  </td>
                  <td>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                      {it.oldP != null && (
                        <Spark data={[it.oldP * 0.94, it.oldP * 0.96, it.oldP * 0.98, it.oldP, it.newP]}
                          w={70} h={20}
                          color={dir === 'up' ? 'var(--clay)' : dir === 'down' ? 'var(--moss)' : 'var(--ink-4)'} />
                      )}
                      <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }} title="ดูประวัติ">{Icons.external}</button>
                    </span>
                  </td>
                  <td>
                    <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }}>{Icons.more}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sticky confirmation footer */}
      <div style={{
        position:'fixed', left:240, right:0, bottom:0,
        background:'var(--surface)', borderTop:'1px solid var(--rule)',
        padding:'16px 48px', display:'flex', alignItems:'center', gap:24,
        boxShadow:'0 -8px 24px -12px rgba(20,18,14,0.10)', zIndex:10,
      }}>
        <div style={{ display:'flex', gap:32 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom:2 }}>จะบันทึกเข้า Price DB</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:24, lineHeight:1 }}>
              {saving} <span style={{ fontSize:13, color:'var(--ink-3)' }}>/ {items.length} รายการ</span>
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom:2 }}>มูลค่ารวมตาม Quote</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:24, lineHeight:1 }}>{money(items.filter(i=>i.save).reduce((s,i)=>s+(i.newP||0)*(i.qty||0),0))}</div>
          </div>
        </div>
        {savePxMsg && (
          <div style={{
            padding:'8px 12px', borderRadius:6, fontSize:12, alignSelf:'center',
            background: pricesSaved ? 'var(--moss-soft)' : '#FDE8E4',
            color: pricesSaved ? '#2F4A1A' : '#8B2A1A', maxWidth:360,
          }}>{savePxMsg}</div>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button className="btn ghost" onClick={() => go('rfq')}>กลับ</button>
          <button className="btn primary" style={{ padding:'10px 20px' }}
            disabled={items.length === 0 || savePxBusy || pricesSaved}
            onClick={savePrices}>
            {Icons.check} {savePxBusy ? 'กำลังบันทึก…' : (pricesSaved ? 'บันทึกแล้ว' : 'ยืนยันบันทึก Price DB')}
          </button>
        </div>
      </div>
    </div>
  );
}
