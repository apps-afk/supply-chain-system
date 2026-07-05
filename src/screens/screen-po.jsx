'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Icons, Chip, money } from '../lib/shell';
import { printDoc } from './screen-compare-create-pricedb';
import { usePermissions } from '../lib/use-permissions';
import { useTableView, Th, Pager } from '../lib/table-utils';

/*
  ใบสั่งซื้อ (Purchase Orders) — PO registry (ทะเบียนเก็บ PO). The company
  opens POs in another system; this screen records them (manual entry via
  POManualModal) or creates one from an approved comparison, then tracks
  สั่งแล้ว → รับของแล้ว → ปิดงาน (or ยกเลิก) plus receiving/payment.

  Row: { no, comparison_id, project_id, supplier_id, supplier_name, title,
         status: ordered|received|closed|cancelled, items_json:[{code,name,
         unit,qty,price}], amount, notes, created_by, ordered_at,
         received_at, closed_at, created_at,
         // P3 Source-to-Pay
         received_json: [{at, by, note, lines:[{code, qty}]}],
         invoice_no, invoice_date, paid_at, paid_amount, payment_ref,
         payment_status: unpaid|partial|paid }
*/

export const PO_STATUS = {
  ordered:   { bg:'var(--ochre-soft)', fg:'#6B5121',         dot:'var(--ochre)', label:'สั่งแล้ว · รอรับของ' },
  received:  { bg:'var(--moss-soft)',  fg:'#2F4A1A',         dot:'var(--moss)',  label:'รับของแล้ว' },
  closed:    { bg:'var(--teal-soft)',  fg:'var(--teal-ink)', dot:'var(--teal)',  label:'ปิดงาน' },
  cancelled: { bg:'var(--clay-soft)',  fg:'#6B2D1A',         dot:'var(--clay)',  label:'ยกเลิก' },
};

// Contract DB status → Thai label (mirrors screen-contract.jsx DB_STATUS_LABEL)
const CONTRACT_STATUS_LABEL = {
  draft:      'ร่าง · รอตรวจ',
  active:     'ใช้งานอยู่',
  expired:    'หมดอายุ',
  terminated: 'ยกเลิก',
};

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' }); }
  catch { return iso; }
}

// Running PO number PO-YYYY-#### — first free slot (same scheme as RFQ/CMP).
export async function nextPoNo() {
  const y = new Date().getFullYear();
  const prefix = `PO-${y}-`;
  try {
    const r = await fetch('/api/purchase-orders');
    if (r.ok) {
      const d = await r.json();
      const used = new Set();
      for (const p of (d.items || [])) {
        const no = String(p?.no || '').trim();
        if (no.startsWith(prefix)) {
          const n = parseInt(no.slice(prefix.length), 10);
          if (!Number.isNaN(n)) used.add(n);
        }
      }
      let n = 1;
      while (used.has(n)) n++;
      return `${prefix}${String(n).padStart(4, '0')}`;
    }
  } catch { /* fall through */ }
  return `${prefix}${String(Date.now() % 10000).padStart(4, '0')}`;
}

function StatusPill({ status }) {
  const sp = PO_STATUS[status] || PO_STATUS.ordered;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:6, fontSize:11,
      fontWeight:500, padding:'2px 10px', borderRadius:999, background:sp.bg, color:sp.fg,
    }}>
      <span style={{ width:6, height:6, borderRadius:999, background:sp.dot }} />
      {sp.label}
    </span>
  );
}

export const PAY_STATUS = {
  unpaid:  { bg:'var(--paper-2)',     fg:'var(--ink-3)', label:'ยังไม่จ่าย' },
  partial: { bg:'var(--ochre-soft)',  fg:'#6B5121',      label:'จ่ายบางส่วน' },
  paid:    { bg:'var(--moss-soft)',   fg:'#2F4A1A',      label:'จ่ายแล้ว' },
};

function PayPill({ status }) {
  const sp = PAY_STATUS[status] || PAY_STATUS.unpaid;
  return (
    <span style={{ display:'inline-block', fontSize:10.5, fontWeight:500, padding:'1px 8px',
                   borderRadius:999, background:sp.bg, color:sp.fg }}>
      {sp.label}
    </span>
  );
}

// Total received qty per line code, summed over every receipt event.
function receivedByCode(po) {
  const map = {};
  const events = Array.isArray(po?.received_json) ? po.received_json : [];
  for (const ev of events) {
    for (const l of (ev.lines || [])) {
      map[l.code] = (map[l.code] || 0) + (Number(l.qty) || 0);
    }
  }
  return map;
}

/* =================== List =================== */
export function ScreenPOList({ go }) {
  const { canWrite } = usePermissions();
  const [pos, setPos]           = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [filter, setFilter]     = useState('ทั้งหมด');
  const [q, setQ]               = useState('');
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [r, rP] = await Promise.all([fetch('/api/purchase-orders'), fetch('/api/projects')]);
        const d = await r.json();
        if (!r.ok) { setErr(d.error || 'โหลดข้อมูลไม่สำเร็จ'); }
        else setPos(d.items || []);
        if (rP.ok) setProjects((await rP.json()).items || []);
      } catch { setErr('เครือข่ายขัดข้อง'); }
      setLoading(false);
    })();
  }, []);

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const existingNos = useMemo(() => new Set(pos.map(p => String(p.no || '').trim())), [pos]);

  const counts = useMemo(() => {
    const c = { ordered:0, received:0, closed:0, cancelled:0 };
    for (const p of pos) if (c[p.status] !== undefined) c[p.status]++;
    return c;
  }, [pos]);

  const filtered = useMemo(() => {
    const v = q.toLowerCase();
    return pos.filter(p => {
      if (filter !== 'ทั้งหมด' && p.status !== filter) return false;
      if (q && !((p.no || '').toLowerCase().includes(v) || (p.title || '').toLowerCase().includes(v) || (p.supplier_name || '').toLowerCase().includes(v))) return false;
      return true;
    }).map(p => ({ ...p, amountN: Number(p.amount) || 0 }));
  }, [pos, filter, q]);

  const { view, page, pages, setPage, sortKey, sortDir, toggleSort, total } =
    useTableView(filtered, { pageSize: 25 });
  const thProps = { activeKey: sortKey, dir: sortDir, onSort: toggleSort };

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Module 6 · จัดซื้อจัดจ้าง</div>
          <h1 className="h-display">ใบสั่งซื้อ (PO)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:600 }}>
            ทะเบียนใบสั่งซื้อ — บันทึก PO ที่เปิดจากระบบภายนอกหรือจากใบเปรียบเทียบ · ติดตามรับของและการจ่ายเงิน
          </p>
        </div>
        {canWrite && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
            <button className="btn" onClick={() => go('compare')}>สร้างจากใบเปรียบเทียบ</button>
            <button className="btn primary" onClick={() => setManualOpen(true)}>{Icons.plus} บันทึก PO ภายนอก</button>
          </div>
        )}
      </div>

      <div style={{
        display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:0,
        borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)',
        padding:'24px 0', marginBottom:32,
      }}>
        {Object.keys(PO_STATUS).map((s, i) => (
          <div key={s} style={{ paddingLeft: i === 0 ? 0 : 24, borderLeft: i === 0 ? 'none' : '1px solid var(--rule)' }}>
            <div className="eyebrow" style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:10, color:PO_STATUS[s].fg, marginBottom:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:PO_STATUS[s].dot }} />
              {PO_STATUS[s].label}
            </div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:28, lineHeight:1 }}>{counts[s]}</div>
          </div>
        ))}
      </div>

      {err && <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>}

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {['ทั้งหมด', ...Object.keys(PO_STATUS)].map(f => (
            <button key={f} onClick={() => setFilter(f)} className="btn sm" style={{
              background: filter === f ? 'var(--ink)' : 'transparent',
              color: filter === f ? 'var(--paper)' : 'var(--ink-2)',
              borderColor: filter === f ? 'var(--ink)' : 'var(--rule)',
              padding:'5px 12px',
            }}>{f === 'ทั้งหมด' ? f : PO_STATUS[f].label}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, padding:'5px 10px', border:'1px solid var(--rule-2)', borderRadius:6, background:'var(--surface)', width:240 }}>
          {Icons.search}
          <input placeholder="ค้นหา PO No. / Supplier…" value={q} onChange={e=>setQ(e.target.value)}
                 style={{ flex:1, border:0, outline:0, background:'transparent', fontSize:13 }} />
        </div>
      </div>

      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <Th sortKey="no" {...thProps} style={{ width:'13%' }}>PO No.</Th>
              <Th sortKey="title" {...thProps}>รายการ</Th>
              <Th sortKey="supplier_name" {...thProps}>Supplier</Th>
              <th>โครงการ</th>
              <Th sortKey="amountN" {...thProps} className="num-col">มูลค่า</Th>
              <Th sortKey="ordered_at" {...thProps}>วันที่สั่ง</Th>
              <Th sortKey="status" {...thProps} style={{ width:150 }}>สถานะ</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีใบสั่งซื้อ — เปิดใบเปรียบเทียบที่อนุมัติแล้ว แล้วกด "สร้างใบสั่งซื้อ"
              </td></tr>
            ) : view.map(p => (
              <tr key={p.id} onClick={() => { try { localStorage.setItem('po.currentId', p.id); } catch {} go('po-detail'); }}
                  style={{ cursor:'pointer' }}>
                <td className="font-mono" style={{ fontSize:12, fontWeight:500, color:'var(--ink-2)' }}>{p.no}</td>
                <td style={{ fontWeight:500 }}>{p.title || '—'}</td>
                <td style={{ fontSize:12.5 }}>{p.supplier_name || '—'}</td>
                <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{projById.get(p.project_id)?.name || '—'}</td>
                <td className="num-col">
                  <div className="num" style={{ fontWeight:500 }}>{money(p.amountN)}</div>
                  {p.status !== 'cancelled' && (
                    <div style={{ marginTop:2 }}><PayPill status={p.payment_status} /></div>
                  )}
                </td>
                <td style={{ fontSize:12, color:'var(--ink-3)' }}>{fmtDate(p.ordered_at)}</td>
                <td><StatusPill status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={page} pages={pages} setPage={setPage} total={total} />
      </div>

      {manualOpen && (
        <POManualModal existingNos={existingNos}
          onClose={() => setManualOpen(false)}
          onSaved={item => {
            try { localStorage.setItem('po.currentId', item.id); } catch {}
            go('po-detail');
          }} />
      )}
    </div>
  );
}

/* =================== Manual PO modal (create / edit) =================== */
// Records a PO opened in the external system into this registry (POST), or
// edits a registry entry that is still 'ordered' (PATCH when `initial` given).
const emptyPoRow = () => ({ code:'', name:'', qty:1, unit:'', price:'' });

function POManualModal({ initial = null, existingNos = null, onClose, onSaved }) {
  const isEdit = !!initial;
  const [no, setNo]               = useState(initial?.no || '');
  const [noLoading, setNoLoading] = useState(!isEdit);
  const [suppliers, setSuppliers] = useState([]);
  const [projects, setProjects]   = useState([]);
  // Supplier: pick from master, or free-text for suppliers not in master
  // (supplier_id null + supplier_name text).
  const [freeSupplier, setFreeSupplier] = useState(isEdit ? !initial.supplier_id : false);
  const [supplierId, setSupplierId]     = useState(initial?.supplier_id || '');
  const [supplierText, setSupplierText] = useState(initial?.supplier_name || '');
  const [projectId, setProjectId] = useState(initial?.project_id || '');
  const [title, setTitle]         = useState(initial?.title || '');
  const [orderedAt, setOrderedAt] = useState(initial?.ordered_at || new Date().toLocaleDateString('sv-SE'));
  const [rows, setRows] = useState(() => {
    const its = Array.isArray(initial?.items_json) ? initial.items_json : [];
    return its.length
      ? its.map(it => ({ code: it.code || '', name: it.name || '', qty: it.qty ?? 1,
                         unit: it.unit || '', price: it.price ?? '' }))
      : [emptyPoRow()];
  });
  const [notes, setNotes]   = useState(initial?.notes || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const computed = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.price) || 0), 0),
    [rows]
  );
  // Amount defaults to Σ qty×price; typing in the field overrides (null = auto).
  const [amountManual, setAmountManual] = useState(() => {
    if (!isEdit) return null;
    const its = Array.isArray(initial?.items_json) ? initial.items_json : [];
    const c = its.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    const a = Number(initial?.amount) || 0;
    return Math.abs(a - c) > 0.005 ? String(a) : null;
  });
  const amount = amountManual !== null ? (Number(amountManual) || 0) : computed;

  useEffect(() => {
    (async () => {
      try {
        const [rS, rP] = await Promise.all([fetch('/api/suppliers'), fetch('/api/projects')]);
        if (rS.ok) setSuppliers((await rS.json()).items || []);
        if (rP.ok) setProjects((await rP.json()).items || []);
      } catch { /* dropdowns just stay empty */ }
      if (!isEdit) {
        const n = await nextPoNo();
        setNo(v => v || n); // don't clobber a number the user already typed
        setNoLoading(false);
      }
    })();
  }, [isEdit]);

  // Active suppliers only — but keep the currently-selected one visible even
  // if it has since been deactivated/removed from master.
  const supplierOptions = useMemo(() => {
    const opts = suppliers.filter(s => s.active || s.id === supplierId);
    if (supplierId && !opts.some(s => s.id === supplierId)) {
      opts.unshift({ id: supplierId, name: initial?.supplier_name || supplierId });
    }
    return opts;
  }, [suppliers, supplierId, initial]);

  const setRow = (i, patch) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    setErr('');
    const noClean = no.trim();
    if (!noClean) { setErr('กรุณากรอกเลขที่ PO'); return; }
    if (existingNos?.has(noClean) && (!isEdit || noClean !== String(initial.no || '').trim())) {
      setErr(`เลขที่ "${noClean}" ถูกใช้แล้วในทะเบียน — กรุณาใช้เลขอื่น`); return;
    }
    let supId = null, supName = '';
    if (freeSupplier) {
      supName = supplierText.trim();
      if (!supName) { setErr('กรุณากรอกชื่อ Supplier'); return; }
    } else {
      const s = supplierOptions.find(x => x.id === supplierId);
      if (!s) { setErr('กรุณาเลือก Supplier (หรือสลับไปพิมพ์ชื่อเอง)'); return; }
      supId = s.id; supName = s.name;
    }
    const items = rows
      .filter(r => String(r.name || '').trim())
      .map(r => ({ code: String(r.code || '').trim(), name: String(r.name || '').trim(),
                   unit: String(r.unit || '').trim(), qty: Number(r.qty) || 0,
                   price: r.price === '' || r.price == null ? null : (Number(r.price) || 0) }));
    if (!items.length) { setErr('กรุณากรอกรายการสินค้าอย่างน้อย 1 รายการ (ต้องมีชื่อรายการ)'); return; }

    const body = {
      no: noClean,
      supplier_id: supId,
      supplier_name: supName,
      project_id: projectId || null,
      title: title.trim(),
      ordered_at: orderedAt || new Date().toLocaleDateString('sv-SE'),
      items_json: items,
      amount,
      notes,
    };
    setSaving(true);
    try {
      const r = await fetch('/api/purchase-orders', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: initial.id, ...body } : { ...body, status:'ordered' }),
      });
      const d = await r.json();
      if (!r.ok) {
        const msg = d.error || 'บันทึกไม่สำเร็จ';
        setErr(r.status === 400 && /duplicate|unique|ซ้ำ/i.test(msg)
          ? `เลขที่ "${noClean}" ถูกใช้แล้ว — กรุณาใช้เลขอื่น`
          : msg);
        setSaving(false);
        return;
      }
      onSaved(d.item || { ...(initial || {}), ...body });
    } catch { setErr('เครือข่ายขัดข้อง'); setSaving(false); }
  }

  const inputStyle = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid var(--rule-2)', borderRadius:6, background:'var(--surface)' };
  const cellStyle  = { width:'100%', padding:'6px 8px', fontSize:12.5, border:'1px solid var(--rule-2)', borderRadius:6, background:'var(--surface)' };
  const labelStyle = { fontSize:11.5, color:'var(--ink-3)', marginBottom:4 };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(20,18,14,0.45)', zIndex:80,
                  display:'grid', placeItems:'center', padding:20 }}
         onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card" style={{ width:'min(760px, 100%)', maxHeight:'88vh', overflow:'auto', padding:0 }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)' }}>
          <h3 className="h-card">{isEdit ? 'แก้ไข PO' : 'บันทึก PO ภายนอก'}</h3>
          <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:4 }}>
            {isEdit
              ? 'แก้ไขข้อมูลในทะเบียน — ทำได้เฉพาะ PO ที่ยังไม่บันทึกรับของ/ปิดงาน'
              : 'บันทึก PO ที่เปิดจากระบบภายนอกเข้าทะเบียน — ใช้เลขที่ PO จากระบบนั้นได้เลย'}
          </div>
        </div>

        {err && <div style={{ margin:'14px 24px 0', background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13 }}>{err}</div>}

        <div style={{ padding:'16px 24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <div style={labelStyle}>เลขที่ PO *</div>
            <input value={no} onChange={e => setNo(e.target.value)} style={{ ...inputStyle, fontFamily:'var(--font-mono, monospace)' }}
              placeholder={noLoading ? 'กำลังหาเลขรัน…' : 'PO-2026-0001'} />
            {!isEdit && (
              <div style={{ fontSize:11, color:'var(--ink-4)', marginTop:3 }}>ระบบใส่เลขรันให้ — แก้เป็นเลขจากระบบภายนอกได้</div>
            )}
          </div>
          <div>
            <div style={labelStyle}>วันที่สั่ง</div>
            <input type="date" value={orderedAt} onChange={e => setOrderedAt(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={{ ...labelStyle, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>Supplier *</span>
              <button type="button" onClick={() => setFreeSupplier(f => !f)}
                style={{ border:0, background:'transparent', color:'var(--teal-ink, var(--ink-2))', fontSize:11, cursor:'pointer', textDecoration:'underline', padding:0 }}>
                {freeSupplier ? 'เลือกจากทะเบียน Supplier' : 'ไม่อยู่ในทะเบียน? พิมพ์ชื่อเอง'}
              </button>
            </div>
            {freeSupplier ? (
              <input value={supplierText} onChange={e => setSupplierText(e.target.value)} style={inputStyle}
                placeholder="ชื่อ Supplier (นอกทะเบียน)" />
            ) : (
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} style={inputStyle}>
                <option value="">— เลือก Supplier —</option>
                {supplierOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <div style={labelStyle}>โครงการ (ไม่บังคับ)</div>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} style={inputStyle}>
              <option value="">— ไม่ระบุ —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code} · ${p.name}` : p.name}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:'1 / -1' }}>
            <div style={labelStyle}>ชื่องาน / รายการ</div>
            <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle}
              placeholder="เช่น สั่งซื้อเหล็กเส้นงานฐานราก อาคาร B" />
          </div>
        </div>

        <div style={{ borderTop:'1px solid var(--rule)' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width:'14%' }}>รหัส</th>
                <th>รายการ *</th>
                <th className="num-col" style={{ width:80 }}>จำนวน</th>
                <th style={{ width:80 }}>หน่วย</th>
                <th className="num-col" style={{ width:110 }}>ราคา/หน่วย</th>
                <th className="num-col" style={{ width:110 }}>รวม</th>
                <th style={{ width:36 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><input value={r.code} onChange={e => setRow(i, { code: e.target.value })} style={cellStyle} placeholder="—" /></td>
                  <td><input value={r.name} onChange={e => setRow(i, { name: e.target.value })} style={cellStyle} placeholder="ชื่อสินค้า/งาน" /></td>
                  <td><input type="number" min={0} value={r.qty} onChange={e => setRow(i, { qty: e.target.value })}
                        style={{ ...cellStyle, textAlign:'right' }} /></td>
                  <td><input value={r.unit} onChange={e => setRow(i, { unit: e.target.value })} style={cellStyle} placeholder="หน่วย" /></td>
                  <td><input type="number" min={0} step="0.01" value={r.price} onChange={e => setRow(i, { price: e.target.value })}
                        style={{ ...cellStyle, textAlign:'right' }} placeholder="—" /></td>
                  <td className="num-col num" style={{ fontSize:12.5 }}>{money((Number(r.qty) || 0) * (Number(r.price) || 0))}</td>
                  <td style={{ textAlign:'center' }}>
                    <button type="button" onClick={() => setRows(rs => rs.length > 1 ? rs.filter((_, j) => j !== i) : [emptyPoRow()])}
                      title="ลบแถว" style={{ border:0, background:'transparent', color:'var(--ink-4)', cursor:'pointer', fontSize:14, lineHeight:1 }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding:'10px 24px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <button type="button" className="btn sm" onClick={() => setRows(rs => [...rs, emptyPoRow()])}>{Icons.plus} เพิ่มแถว</button>
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:11.5, color:'var(--ink-3)' }}>มูลค่ารวม (คำนวณ {money(computed)})</span>
              <input type="number" min={0} step="0.01" value={amountManual !== null ? amountManual : computed}
                onChange={e => setAmountManual(e.target.value)}
                style={{ width:130, padding:'6px 8px', fontSize:13, textAlign:'right', fontWeight:600,
                         border:'1px solid var(--rule-2)', borderRadius:6, background:'var(--surface)' }} />
              {amountManual !== null && (
                <button type="button" onClick={() => setAmountManual(null)}
                  style={{ border:0, background:'transparent', color:'var(--teal-ink, var(--ink-2))', fontSize:11, cursor:'pointer', textDecoration:'underline', padding:0 }}>
                  ใช้ยอดคำนวณ
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)' }}>
          <div style={labelStyle}>หมายเหตุ</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            style={{ ...inputStyle, resize:'vertical', fontFamily:'inherit' }} placeholder="—" />
        </div>

        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button className="btn primary" disabled={saving || noLoading} onClick={save}>
            {saving ? 'กำลังบันทึก…' : isEdit ? 'บันทึกการแก้ไข' : 'บันทึกเข้าทะเบียน'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =================== Detail =================== */
export function ScreenPODetail({ go }) {
  const { canWrite, isAdmin } = usePermissions();
  const [po, setPo]             = useState(null);
  const [projects, setProjects] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [busy, setBusy]         = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [editOpen, setEditOpen]       = useState(false);
  const [otherNos, setOtherNos]       = useState(null); // duplicate-no precheck for edit

  async function loadAttachments(poId) {
    try {
      const r = await fetch(`/api/attachments?entity_type=po&entity_id=${encodeURIComponent(poId)}`);
      if (r.ok) setAttachments((await r.json()).items || []);
    } catch { /* optional */ }
  }

  useEffect(() => {
    (async () => {
      try {
        const stashed = (typeof window !== 'undefined') ? localStorage.getItem('po.currentId') : null;
        const [r, rP, rC] = await Promise.all([fetch('/api/purchase-orders'), fetch('/api/projects'), fetch('/api/contracts')]);
        const d = await r.json();
        if (!r.ok) { setErr(d.error || 'โหลดข้อมูลไม่สำเร็จ'); setLoading(false); return; }
        if (rP.ok) setProjects((await rP.json()).items || []);
        if (rC.ok) setContracts((await rC.json()).items || []);
        const list = d.items || [];
        const picked = (stashed && list.find(x => x.id === stashed)) || list[0] || null;
        setPo(picked);
        setOtherNos(new Set(list.map(x => String(x.no || '').trim())));
        if (picked) loadAttachments(picked.id);
      } catch { setErr('เครือข่ายขัดข้อง'); }
      setLoading(false);
    })();
  }, []);

  const items = useMemo(() => (Array.isArray(po?.items_json) ? po.items_json : []), [po]);
  const proj = useMemo(() => projects.find(p => p.id === po?.project_id), [projects, po]);
  const recvMap = useMemo(() => receivedByCode(po), [po]);
  const receipts = useMemo(
    () => (Array.isArray(po?.received_json) ? po.received_json : []),
    [po]
  );
  const fullyReceived = useMemo(
    () => items.length > 0 && items.every(it => (recvMap[it.code] || 0) >= (Number(it.qty) || 0)),
    [items, recvMap]
  );
  // Contracts linked to this PO — the link lives on the CONTRACT side, inside
  // notes as JSON: { workflow: { linked_po_ids: [...] }, memo }.
  const linkedContracts = useMemo(() => {
    if (!po) return [];
    return contracts.filter(c => {
      try {
        const parsed = JSON.parse(c.notes || '');
        const ids = parsed?.workflow?.linked_po_ids;
        return Array.isArray(ids) && ids.includes(po.id);
      } catch { return false; }
    });
  }, [contracts, po]);

  async function transition(patch, confirmMsg) {
    if (!po || (confirmMsg && !confirm(confirmMsg))) return;
    setBusy(true); setErr('');
    try {
      const body = { id: po.id, ...patch };
      // Optimistic lock: only when the patch changes STATUS. Server compares
      // and answers 409 (Thai message) if someone moved it first.
      if (patch.status) body._expect = { status: po.status };
      const r = await fetch('/api/purchase-orders', {
        method:'PATCH', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error || 'บันทึกไม่สำเร็จ');
      else setPo(p => ({ ...p, ...patch }));
    } catch { setErr('เครือข่ายขัดข้อง'); }
    setBusy(false);
  }

  const today = () => new Date().toLocaleDateString('sv-SE');

  // Admin-only: remove the entry from the registry entirely.
  async function deletePo() {
    if (!po) return;
    if (!confirm(`ลบ PO ${po.no} ออกจากทะเบียนถาวร?\nประวัติรับของ/บิล/การจ่ายเงินของใบนี้จะหายไปด้วย และกู้คืนไม่ได้`)) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/purchase-orders', {
        method:'DELETE', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ id: po.id }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'ลบไม่สำเร็จ'); setBusy(false); return; }
      try { localStorage.removeItem('po.currentId'); } catch {}
      go('po');
      return;
    } catch { setErr('เครือข่ายขัดข้อง'); }
    setBusy(false);
  }

  // Record a goods receipt. The event is composed SERVER-side (/receive) from
  // the current row, so two staff recording receipts concurrently can't
  // overwrite each other, and identity/timestamp come from the session.
  async function saveReceipt(lines, note) {
    const clean = lines.filter(l => (Number(l.qty) || 0) > 0)
                       .map(l => ({ code: l.code, qty: Number(l.qty) }));
    if (!clean.length) { setErr('กรุณากรอกจำนวนที่รับอย่างน้อย 1 รายการ'); return false; }
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/purchase-orders/receive', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: po.id, lines: clean, note: note || '' }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'บันทึกรับของไม่สำเร็จ'); setBusy(false); return false; }
      setPo(d.item);
      setBusy(false);
      return true;
    } catch { setErr('เครือข่ายขัดข้อง'); setBusy(false); return false; }
  }

  if (loading) {
    return (
      <div className="page">
        <button className="btn ghost sm" onClick={() => go('po')} style={{ marginBottom:20, marginLeft:-8 }}>{Icons.back} กลับไปใบสั่งซื้อ</button>
        <div style={{ padding:40, textAlign:'center', color:'var(--ink-3)' }}>กำลังโหลด…</div>
      </div>
    );
  }
  if (!po) {
    return (
      <div className="page">
        <button className="btn ghost sm" onClick={() => go('po')} style={{ marginBottom:20, marginLeft:-8 }}>{Icons.back} กลับไปใบสั่งซื้อ</button>
        <div className="card" style={{ padding:40, textAlign:'center', color:'var(--ink-3)' }}>ยังไม่มีใบสั่งซื้อ</div>
      </div>
    );
  }

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => go('po')} style={{ marginBottom:20, marginLeft:-8 }}>{Icons.back} กลับไปใบสั่งซื้อ</button>

      {err && <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>}

      <div className="page-head" style={{ alignItems:'flex-start' }}>
        <div className="page-title">
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
            <span className="font-mono" style={{ fontSize:12, color:'var(--ink-3)' }}>{po.no}</span>
            <StatusPill status={po.status} />
          </div>
          <h1 className="h-display">{po.title || 'ใบสั่งซื้อ'}</h1>
          <div style={{ display:'flex', gap:24, marginTop:10, fontSize:13, color:'var(--ink-3)', flexWrap:'wrap' }}>
            <span>Supplier <strong style={{ color:'var(--ink-2)' }}>{po.supplier_name || '—'}</strong></span>
            <span>โครงการ <strong style={{ color:'var(--ink-2)' }}>{proj ? (proj.code ? `${proj.code} · ${proj.name}` : proj.name) : '—'}</strong></span>
            <span>สั่งเมื่อ <strong style={{ color:'var(--ink-2)' }}>{fmtDate(po.ordered_at)}</strong></span>
            {po.comparison_id && (
              <span onClick={() => { try { localStorage.setItem('cmp.currentId', po.comparison_id); } catch {} go('compare-detail'); }}
                style={{ color:'var(--teal-ink)', cursor:'pointer', fontWeight:500 }}>
                ใบเปรียบเทียบต้นทาง ↗
              </span>
            )}
            {po.received_at && <span>รับของ <strong style={{ color:'var(--ink-2)' }}>{fmtDate(po.received_at)}</strong></span>}
            {po.closed_at && <span>ปิดงาน <strong style={{ color:'var(--ink-2)' }}>{fmtDate(po.closed_at)}</strong></span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
          <button className="btn" onClick={() => printDoc(`${po.no}`)}>{Icons.download} พิมพ์ / PDF</button>
          {canWrite && (
            <span title={po.status !== 'ordered' ? 'แก้ไขได้เฉพาะ PO สถานะ "สั่งแล้ว" — รายการที่รับของ/ปิดงาน/ยกเลิกแล้วต้องไม่ถูกแก้ย้อนหลัง' : undefined}>
              <button className="btn" disabled={busy || po.status !== 'ordered'} onClick={() => setEditOpen(true)}>
                {Icons.edit} แก้ไข PO
              </button>
            </span>
          )}
          {isAdmin && (
            <button className="btn ghost" disabled={busy} style={{ color:'var(--clay)' }} onClick={deletePo}>
              ลบ PO
            </button>
          )}
          {canWrite && po.status === 'ordered' && (
            <>
              <button className="btn primary" disabled={busy} onClick={() => setReceiveOpen(true)}>
                {Icons.check} บันทึกรับของ
              </button>
              <button className="btn ghost" disabled={busy} style={{ color:'var(--clay)' }}
                onClick={() => transition({ status:'cancelled' }, 'ยกเลิกใบสั่งซื้อนี้?')}>
                ยกเลิก PO
              </button>
            </>
          )}
          {canWrite && po.status === 'received' && (
            <button className="btn primary" disabled={busy}
              onClick={() => transition({ status:'closed', closed_at: today() }, 'ปิดงานใบสั่งซื้อนี้? (ควรบันทึกบิล/การจ่ายเงินให้ครบก่อน)')}>
              {Icons.check} ปิดงาน
            </button>
          )}
        </div>
      </div>

      {/* Printable PO document */}
      <div className="card print-area" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'28px 36px', borderBottom:'2px solid var(--ink)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontSize:11, letterSpacing:0.16, textTransform:'uppercase', color:'var(--ink-3)' }}>Initial Estate Co., Ltd.</div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:26, marginTop:6 }}>ใบสั่งซื้อ · Purchase Order</div>
            </div>
            <div style={{ textAlign:'right', fontSize:12, lineHeight:1.8 }}>
              <div>เลขที่ <span className="font-mono" style={{ fontWeight:600 }}>{po.no}</span></div>
              <div>วันที่สั่ง {fmtDate(po.ordered_at)}</div>
              <div>Supplier <strong>{po.supplier_name || '—'}</strong></div>
              {po.comparison_id && <div style={{ color:'var(--ink-3)', fontSize:11 }}>อ้างอิงใบเปรียบเทียบ</div>}
            </div>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:40 }}>#</th>
              <th style={{ width:'14%' }}>รหัส</th>
              <th>รายการ</th>
              <th className="num-col">จำนวน</th>
              <th>หน่วย</th>
              <th className="num-col">ราคา/หน่วย</th>
              <th className="num-col">รวม</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.code || i}>
                <td style={{ color:'var(--ink-3)' }}>{i + 1}</td>
                <td className="font-mono" style={{ fontSize:11.5, color:'var(--ink-3)' }}>{it.code}</td>
                <td style={{ fontWeight:500 }}>{it.name}</td>
                <td className="num-col num">{Number(it.qty) || 0}</td>
                <td style={{ fontSize:12.5 }}>{it.unit || '—'}</td>
                <td className="num-col num">{it.price != null ? money(Number(it.price)) : '—'}</td>
                <td className="num-col num" style={{ fontWeight:500 }}>
                  {it.price != null ? money(Number(it.price) * (Number(it.qty) || 0)) : '—'}
                </td>
              </tr>
            ))}
            <tr style={{ background:'#15130E', color:'#fff' }}>
              <td colSpan={6} style={{ padding:'12px 16px', textAlign:'right', fontWeight:500 }}>มูลค่ารวม</td>
              <td className="num-col num" style={{ padding:'12px 16px', fontWeight:700 }}>{money(Number(po.amount) || 0)}</td>
            </tr>
          </tbody>
        </table>
        {po.notes && (
          <div style={{ padding:'14px 36px', borderTop:'1px solid var(--rule)', fontSize:12.5, color:'var(--ink-2)' }}>
            <span style={{ color:'var(--ink-3)' }}>หมายเหตุ:</span> {po.notes}
          </div>
        )}
      </div>

      {/* ---- Source-to-Pay: receiving progress + billing/payment (P3) ---- */}
      {po.status !== 'cancelled' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginTop:24, alignItems:'start' }}>
          {/* Receiving */}
          <div className="card" style={{ padding:0 }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--rule)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 className="h-card">การรับของ</h3>
              {fullyReceived
                ? <Chip kind="active">รับครบแล้ว</Chip>
                : receipts.length > 0
                  ? <Chip kind="draft">รับบางส่วน</Chip>
                  : <span style={{ fontSize:12, color:'var(--ink-3)' }}>ยังไม่มีการรับของ</span>}
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>รายการ</th>
                  <th className="num-col">สั่ง</th>
                  <th className="num-col">รับแล้ว</th>
                  <th className="num-col">ค้างรับ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const got = recvMap[it.code] || 0;
                  const ordered = Number(it.qty) || 0;
                  const left = Math.max(0, ordered - got);
                  return (
                    <tr key={it.code || i}>
                      <td style={{ fontSize:12.5 }}>{it.name}</td>
                      <td className="num-col num">{ordered} {it.unit}</td>
                      <td className="num-col num" style={{ color: got ? 'var(--moss)' : 'var(--ink-4)', fontWeight: got ? 600 : 400 }}>{got}</td>
                      <td className="num-col num" style={{ color: left ? 'var(--clay)' : 'var(--ink-4)' }}>{left}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {receipts.length > 0 && (
              <div style={{ padding:'12px 20px', borderTop:'1px solid var(--rule)' }}>
                <div className="eyebrow" style={{ marginBottom:8 }}>ประวัติการรับ · {receipts.length} ครั้ง</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[...receipts].reverse().map((ev, i) => (
                    <div key={i} style={{ fontSize:12, color:'var(--ink-2)' }}>
                      <strong>{fmtDate(ev.at)}</strong>
                      {' — '}{(ev.lines || []).map(l => `${l.code} ×${l.qty}`).join(', ')}
                      {ev.note ? ` · ${ev.note}` : ''}
                      <span style={{ color:'var(--ink-4)' }}> · {ev.by}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {canWrite && po.status === 'ordered' && !fullyReceived && (
              <div style={{ padding:'12px 20px', borderTop:'1px solid var(--rule)' }}>
                <button className="btn sm" onClick={() => setReceiveOpen(true)}>{Icons.plus} บันทึกรับของ (บางส่วนได้)</button>
              </div>
            )}
          </div>

          {/* Billing & payment */}
          <BillingCard po={po} canWrite={canWrite} busy={busy} transition={transition}
                       attachments={attachments} onUploaded={() => loadAttachments(po.id)} />
        </div>
      )}

      {/* ---- Linked contracts (link is stored on the contract side) ---- */}
      {linkedContracts.length > 0 && (
        <div className="card" style={{ padding:0, marginTop:24 }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--rule)' }}>
            <h3 className="h-card">สัญญาที่เชื่อมโยง · {linkedContracts.length}</h3>
          </div>
          <div style={{ display:'flex', flexDirection:'column' }}>
            {linkedContracts.map((c, i) => (
              <div key={c.id}
                onClick={() => { try { localStorage.setItem('contract.currentId', c.id); } catch {} go('contract-detail'); }}
                style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 20px', cursor:'pointer',
                         borderTop: i === 0 ? 'none' : '1px solid var(--rule)' }}>
                <span className="font-mono" style={{ fontSize:11.5, color:'var(--ink-3)', minWidth:110 }}>{c.no || '—'}</span>
                <span style={{ flex:1, fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.title || '—'}</span>
                <span className="num" style={{ fontSize:12.5, fontWeight:500 }}>{c.amount != null ? money(Number(c.amount) || 0) : '—'}</span>
                <span style={{ fontSize:11.5, color:'var(--ink-3)' }}>{CONTRACT_STATUS_LABEL[c.status] || c.status || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {linkedContracts.length === 0 && po.status !== 'cancelled' && (
        <div style={{ marginTop:12, fontSize:12, color:'var(--ink-4)' }}>
          ยังไม่มีสัญญาเชื่อมโยง — เชื่อมได้จากหน้ารายละเอียดสัญญา (ปุ่ม 'เชื่อมกับ PO')
        </div>
      )}

      {receiveOpen && (
        <ReceiveModal items={items} recvMap={recvMap}
          onClose={() => setReceiveOpen(false)}
          onSave={async (lines, note) => {
            const ok = await saveReceipt(lines, note);
            if (ok) setReceiveOpen(false);
          }} />
      )}

      {editOpen && (
        <POManualModal initial={po} existingNos={otherNos}
          onClose={() => setEditOpen(false)}
          onSaved={item => {
            const oldNo = String(po.no || '').trim();
            setPo(p => ({ ...p, ...item }));
            // keep the dup-precheck set in step when the number was renamed
            setOtherNos(s => {
              if (!s) return s;
              const n = new Set(s); n.delete(oldNo); n.add(String(item.no || '').trim());
              return n;
            });
            setEditOpen(false);
          }} />
      )}
    </div>
  );
}

/* =================== Receive modal (partial receipts) =================== */
function ReceiveModal({ items, recvMap, onClose, onSave }) {
  const [lines, setLines] = useState(() => items.map(it => {
    const left = Math.max(0, (Number(it.qty) || 0) - (recvMap[it.code] || 0));
    return { code: it.code, name: it.name, unit: it.unit || '', left, qty: left };
  }));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const setQty = (i, v) => setLines(ls => ls.map((l, j) => {
    if (j !== i) return l;
    const n = Math.max(0, Math.min(Number(v) || 0, l.left)); // can't receive more than outstanding
    return { ...l, qty: n };
  }));

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(20,18,14,0.45)', zIndex:80,
                  display:'grid', placeItems:'center', padding:20 }}
         onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card" style={{ width:'min(560px, 100%)', maxHeight:'85vh', overflow:'auto', padding:0 }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)' }}>
          <h3 className="h-card">บันทึกรับของ</h3>
          <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:4 }}>
            กรอกจำนวนที่รับจริงครั้งนี้ — รับบางส่วนได้ ระบบจะรวมยอดให้อัตโนมัติ
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr><th>รายการ</th><th className="num-col">ค้างรับ</th><th className="num-col" style={{ width:120 }}>รับครั้งนี้</th></tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.code || i}>
                <td style={{ fontSize:12.5 }}>{l.name}</td>
                <td className="num-col num" style={{ color: l.left ? 'var(--ink-2)' : 'var(--ink-4)' }}>{l.left} {l.unit}</td>
                <td className="num-col">
                  <input type="number" min={0} max={l.left} value={l.qty}
                    onChange={e => setQty(i, e.target.value)} disabled={l.left === 0}
                    style={{ width:90, padding:'6px 8px', fontSize:13, textAlign:'right',
                             border:'1px solid var(--rule-2)', borderRadius:6, background: l.left === 0 ? 'var(--paper-2)' : 'var(--surface)' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)' }}>
          <input placeholder="หมายเหตุ (เช่น เลขที่ใบส่งของ)" value={note} onChange={e => setNote(e.target.value)}
            style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid var(--rule-2)', borderRadius:6 }} />
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button className="btn primary" disabled={saving || lines.every(l => !l.qty)}
            onClick={async () => { setSaving(true); await onSave(lines, note); setSaving(false); }}>
            {saving ? 'กำลังบันทึก…' : 'บันทึกการรับของ'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =================== Billing & payment card =================== */
function BillingCard({ po, canWrite, busy, transition, attachments, onUploaded }) {
  const [invNo, setInvNo]     = useState(po.invoice_no || '');
  const [invDate, setInvDate] = useState(po.invoice_date || '');
  const [payAmt, setPayAmt]   = useState(po.paid_amount ? String(po.paid_amount) : '');
  const [payDate, setPayDate] = useState(po.paid_at || '');
  const [payRef, setPayRef]   = useState(po.payment_ref || '');
  const [upBusy, setUpBusy]   = useState(false);
  const [upErr, setUpErr]     = useState('');

  const amount = Number(po.amount) || 0;

  async function saveBill() {
    await transition({ invoice_no: invNo, invoice_date: invDate || null });
  }
  async function savePayment() {
    const amt = Number(payAmt) || 0;
    const status = amt <= 0 ? 'unpaid' : amt + 0.005 >= amount ? 'paid' : 'partial';
    await transition({
      paid_amount: amt,
      paid_at: payDate || (amt > 0 ? new Date().toLocaleDateString('sv-SE') : null),
      payment_ref: payRef,
      payment_status: status,
    });
  }

  async function uploadBill(file) {
    if (!file) return;
    setUpBusy(true); setUpErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', 'po_invoice');
      fd.append('entity_type', 'po');
      fd.append('entity_id', po.id);
      fd.append('entity_ref', po.no || '');
      const r = await fetch('/api/upload', { method:'POST', body: fd });
      const d = await r.json();
      if (!r.ok) setUpErr(d.error || 'อัปโหลดไม่สำเร็จ');
      else onUploaded();
    } catch { setUpErr('เครือข่ายขัดข้อง'); }
    setUpBusy(false);
  }

  const inputStyle = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid var(--rule-2)', borderRadius:6, background:'var(--surface)' };

  return (
    <div className="card" style={{ padding:0 }}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--rule)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h3 className="h-card">บิล / การจ่ายเงิน</h3>
        <PayPill status={po.payment_status} />
      </div>

      <div style={{ padding:'16px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div>
          <div style={{ fontSize:11.5, color:'var(--ink-3)', marginBottom:4 }}>เลขที่บิล/ใบแจ้งหนี้</div>
          <input value={invNo} onChange={e => setInvNo(e.target.value)} disabled={!canWrite} style={inputStyle} placeholder="INV-…" />
        </div>
        <div>
          <div style={{ fontSize:11.5, color:'var(--ink-3)', marginBottom:4 }}>วันที่บิล</div>
          <input type="date" value={invDate} onChange={e => setInvDate(e.target.value)} disabled={!canWrite} style={inputStyle} />
        </div>
        {canWrite && (
          <div style={{ gridColumn:'1 / -1' }}>
            <button className="btn sm" disabled={busy} onClick={saveBill}>{Icons.check} บันทึกบิล</button>
          </div>
        )}
      </div>

      <div style={{ padding:'16px 20px', borderTop:'1px solid var(--rule)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div>
          <div style={{ fontSize:11.5, color:'var(--ink-3)', marginBottom:4 }}>ยอดจ่ายแล้ว (จากทั้งหมด {money(amount)})</div>
          <input type="number" min={0} value={payAmt} onChange={e => setPayAmt(e.target.value)} disabled={!canWrite} style={inputStyle} placeholder="0" />
        </div>
        <div>
          <div style={{ fontSize:11.5, color:'var(--ink-3)', marginBottom:4 }}>วันที่จ่าย</div>
          <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} disabled={!canWrite} style={inputStyle} />
        </div>
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:11.5, color:'var(--ink-3)', marginBottom:4 }}>อ้างอิงการจ่าย (เลขที่โอน/เช็ค)</div>
          <input value={payRef} onChange={e => setPayRef(e.target.value)} disabled={!canWrite} style={inputStyle} placeholder="—" />
        </div>
        {canWrite && (
          <div style={{ gridColumn:'1 / -1' }}>
            <button className="btn primary sm" disabled={busy} onClick={savePayment}>{Icons.check} บันทึกการจ่ายเงิน</button>
          </div>
        )}
      </div>

      <div style={{ padding:'16px 20px', borderTop:'1px solid var(--rule)' }}>
        <div className="eyebrow" style={{ marginBottom:10 }}>ไฟล์บิลแนบ · {attachments.length}</div>
        {upErr && <div style={{ color:'var(--clay)', fontSize:12, marginBottom:8 }}>{upErr}</div>}
        {attachments.length === 0 ? (
          <div style={{ fontSize:12.5, color:'var(--ink-4)', marginBottom:10 }}>ยังไม่มีไฟล์แนบ</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:10 }}>
            {attachments.map(a => (
              <div key={a.id} style={{ display:'flex', alignItems:'center', gap:10, fontSize:12.5 }}>
                <span style={{ color:'var(--ink-3)' }}>📄</span>
                <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.filename}</span>
                {a.drive_view_link && (
                  <a href={a.drive_view_link} target="_blank" rel="noreferrer" className="btn sm">เปิดดู</a>
                )}
              </div>
            ))}
          </div>
        )}
        {canWrite && (
          <label className="btn sm" style={{ cursor: upBusy ? 'wait' : 'pointer', opacity: upBusy ? 0.6 : 1 }}>
            {Icons.upload} {upBusy ? 'กำลังอัปโหลด…' : 'แนบไฟล์บิล'}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.doc,.docx" hidden disabled={upBusy}
              onChange={e => { uploadBill(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        )}
      </div>
    </div>
  );
}
