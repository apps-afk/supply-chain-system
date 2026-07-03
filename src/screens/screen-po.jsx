'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Icons, Chip, money } from '../lib/shell';
import { printDoc } from './screen-compare-create-pricedb';

/*
  ใบสั่งซื้อ (Purchase Orders) — closes the loop after a comparison is
  approved. Created from compare-detail with supplier + items + prices
  prefilled; tracked through สั่งแล้ว → รับของแล้ว → ปิดงาน (or ยกเลิก).

  Row: { no, comparison_id, project_id, supplier_id, supplier_name, title,
         status: ordered|received|closed|cancelled, items_json:[{code,name,
         unit,qty,price}], amount, notes, created_by, ordered_at,
         received_at, closed_at, created_at }
*/

export const PO_STATUS = {
  ordered:   { bg:'var(--ochre-soft)', fg:'#6B5121',         dot:'var(--ochre)', label:'สั่งแล้ว · รอรับของ' },
  received:  { bg:'var(--moss-soft)',  fg:'#2F4A1A',         dot:'var(--moss)',  label:'รับของแล้ว' },
  closed:    { bg:'var(--teal-soft)',  fg:'var(--teal-ink)', dot:'var(--teal)',  label:'ปิดงาน' },
  cancelled: { bg:'var(--clay-soft)',  fg:'#6B2D1A',         dot:'var(--clay)',  label:'ยกเลิก' },
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

/* =================== List =================== */
export function ScreenPOList({ go }) {
  const [pos, setPos]           = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [filter, setFilter]     = useState('ทั้งหมด');
  const [q, setQ]               = useState('');

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
    });
  }, [pos, filter, q]);

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Module 6 · จัดซื้อจัดจ้าง</div>
          <h1 className="h-display">ใบสั่งซื้อ (PO)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:600 }}>
            สร้างจากใบเปรียบเทียบราคาที่อนุมัติแล้ว · ติดตามสถานะ สั่ง → รับของ → ปิดงาน
          </p>
        </div>
        <button className="btn primary" onClick={() => go('compare')}>{Icons.plus} สร้างจากใบเปรียบเทียบ</button>
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
              <th style={{ width:'13%' }}>PO No.</th>
              <th>รายการ</th>
              <th>Supplier</th>
              <th>โครงการ</th>
              <th className="num-col">มูลค่า</th>
              <th>วันที่สั่ง</th>
              <th style={{ width:150 }}>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีใบสั่งซื้อ — เปิดใบเปรียบเทียบที่อนุมัติแล้ว แล้วกด "สร้างใบสั่งซื้อ"
              </td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} onClick={() => { try { localStorage.setItem('po.currentId', p.id); } catch {} go('po-detail'); }}
                  style={{ cursor:'pointer' }}>
                <td className="font-mono" style={{ fontSize:12, fontWeight:500, color:'var(--ink-2)' }}>{p.no}</td>
                <td style={{ fontWeight:500 }}>{p.title || '—'}</td>
                <td style={{ fontSize:12.5 }}>{p.supplier_name || '—'}</td>
                <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{projById.get(p.project_id)?.name || '—'}</td>
                <td className="num-col num" style={{ fontWeight:500 }}>{money(Number(p.amount) || 0)}</td>
                <td style={{ fontSize:12, color:'var(--ink-3)' }}>{fmtDate(p.ordered_at)}</td>
                <td><StatusPill status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =================== Detail =================== */
export function ScreenPODetail({ go }) {
  const [po, setPo]             = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [busy, setBusy]         = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stashed = (typeof window !== 'undefined') ? localStorage.getItem('po.currentId') : null;
        const [r, rP] = await Promise.all([fetch('/api/purchase-orders'), fetch('/api/projects')]);
        const d = await r.json();
        if (!r.ok) { setErr(d.error || 'โหลดข้อมูลไม่สำเร็จ'); setLoading(false); return; }
        if (rP.ok) setProjects((await rP.json()).items || []);
        const list = d.items || [];
        setPo((stashed && list.find(x => x.id === stashed)) || list[0] || null);
      } catch { setErr('เครือข่ายขัดข้อง'); }
      setLoading(false);
    })();
  }, []);

  const items = useMemo(() => (Array.isArray(po?.items_json) ? po.items_json : []), [po]);
  const proj = useMemo(() => projects.find(p => p.id === po?.project_id), [projects, po]);

  async function transition(patch, confirmMsg) {
    if (!po || (confirmMsg && !confirm(confirmMsg))) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/purchase-orders', {
        method:'PATCH', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ id: po.id, ...patch }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error || 'บันทึกไม่สำเร็จ');
      else setPo(p => ({ ...p, ...patch }));
    } catch { setErr('เครือข่ายขัดข้อง'); }
    setBusy(false);
  }

  const today = () => new Date().toLocaleDateString('sv-SE');

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
            {po.received_at && <span>รับของ <strong style={{ color:'var(--ink-2)' }}>{fmtDate(po.received_at)}</strong></span>}
            {po.closed_at && <span>ปิดงาน <strong style={{ color:'var(--ink-2)' }}>{fmtDate(po.closed_at)}</strong></span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
          <button className="btn" onClick={() => printDoc(`${po.no}`)}>{Icons.download} พิมพ์ / PDF</button>
          {po.status === 'ordered' && (
            <>
              <button className="btn primary" disabled={busy}
                onClick={() => transition({ status:'received', received_at: today() }, 'บันทึกว่ารับของครบแล้ว?')}>
                {Icons.check} บันทึกรับของ
              </button>
              <button className="btn ghost" disabled={busy} style={{ color:'var(--clay)' }}
                onClick={() => transition({ status:'cancelled' }, 'ยกเลิกใบสั่งซื้อนี้?')}>
                ยกเลิก PO
              </button>
            </>
          )}
          {po.status === 'received' && (
            <button className="btn primary" disabled={busy}
              onClick={() => transition({ status:'closed', closed_at: today() }, 'ปิดงานใบสั่งซื้อนี้?')}>
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
    </div>
  );
}
