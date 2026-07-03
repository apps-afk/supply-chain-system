'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Icons, Chip, Av, money, Delta } from '../lib/shell';
import { SettingsSearchBox } from '../lib/settings-shared';

/*
  Supplier Database — intelligence view over the supplier master.

  Built live from:
    /api/suppliers   — roster (name, type, payment_terms, status)
    /api/prices      — price points per supplier (what they sell, quote count)
    /api/rfqs        — RFQs sent to each supplier (parsed from notes payload)
    /api/materials   — material names for the price list
  The "win" signal = RFQ reached 'closed' (prices were saved to the DB).
*/

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' }); }
  catch { return iso; }
}

// Shared loader — both screens need the same joined view.
function useSupplierIntel() {
  const [suppliers, setSuppliers] = useState([]);
  const [prices, setPrices]       = useState([]);
  const [rfqs, setRfqs]           = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [rS, rP, rR, rM] = await Promise.all([
          fetch('/api/suppliers'), fetch('/api/prices'), fetch('/api/rfqs'), fetch('/api/materials'),
        ]);
        const dS = await rS.json();
        if (!rS.ok) { setErr(dS.error || 'โหลดข้อมูลไม่สำเร็จ'); setLoading(false); return; }
        setSuppliers(dS.items || []);
        if (rP.ok) setPrices((await rP.json()).items || []);
        if (rR.ok) setRfqs((await rR.json()).items || []);
        if (rM.ok) setMaterials((await rM.json()).items || []);
      } catch { setErr('เครือข่ายขัดข้อง'); }
      setLoading(false);
    })();
  }, []);

  const intel = useMemo(() => {
    const matById = new Map(materials.map(m => [m.id, m]));
    // RFQs per supplier — supplier_id lives inside the notes JSON
    const rfqsBySup = new Map();
    for (const r of rfqs) {
      let sid = null;
      try { sid = JSON.parse(r.notes)?.supplier_id || null; } catch {}
      if (!sid) continue;
      if (!rfqsBySup.has(sid)) rfqsBySup.set(sid, []);
      rfqsBySup.get(sid).push(r);
    }
    // Price points per supplier
    const pxBySup = new Map();
    for (const p of prices) {
      if (!p.supplier_id) continue;
      if (!pxBySup.has(p.supplier_id)) pxBySup.set(p.supplier_id, []);
      pxBySup.get(p.supplier_id).push(p);
    }
    const rows = suppliers.map(s => {
      const px = pxBySup.get(s.id) || [];
      const supRfqs = rfqsBySup.get(s.id) || [];
      const wins = supRfqs.filter(r => r.status === 'closed').length;
      const distinctMats = new Set(px.map(p => p.material_id)).size;
      const lastQuote = px.length ? px[0].captured_at : null; // prices ordered desc
      return {
        ...s,
        status3: s.status || (s.active === false ? 'Non-Active' : 'Active'),
        pricePoints: px,
        itemsSold: distinctMats,
        quotes: px.length,
        rfqCount: supRfqs.length,
        wins,
        winRate: supRfqs.length ? (wins / supRfqs.length) * 100 : null,
        lastQuote,
        rfqList: supRfqs,
      };
    });
    return { rows, matById };
  }, [suppliers, prices, rfqs, materials]);

  return { ...intel, loading, err };
}

/* =================== List screen =================== */
export function ScreenSupplierDB({ go }) {
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('ทั้งหมด');
  const { rows, loading, err } = useSupplierIntel();

  const filtered = useMemo(() => {
    const v = q.toLowerCase();
    return rows.filter(s => {
      if (typeFilter !== 'ทั้งหมด' && !(s.type || '').toLowerCase().includes(typeFilter.toLowerCase())) return false;
      if (q && !((s.name || '').toLowerCase().includes(v) || (s.code || '').toLowerCase().includes(v))) return false;
      return true;
    });
  }, [rows, typeFilter, q]);

  const stats = useMemo(() => {
    const active = rows.filter(s => s.status3 === 'Active');
    const totalQuotes = rows.reduce((a, s) => a + s.quotes, 0);
    const withRfq = rows.filter(s => s.rfqCount > 0);
    const avgWin = withRfq.length
      ? withRfq.reduce((a, s) => a + (s.winRate || 0), 0) / withRfq.length
      : null;
    const itemsSold = rows.reduce((a, s) => a + s.itemsSold, 0);
    return { total: rows.length, active: active.length, totalQuotes, avgWin, itemsSold };
  }, [rows]);

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Module 5 · Supplier Intelligence</div>
          <h1 className="h-display">Supplier Database</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:640 }}>
            สำรวจดูว่า Supplier แต่ละเจ้าขายอะไรบ้าง · เคยเสนอราคามาแล้วกี่ครั้ง ·
            อัตราชนะ RFQ — ใช้ประกอบการตัดสินใจ
          </p>
        </div>
        <button className="btn" onClick={() => go('suppliers')}>{Icons.edit} จัดการ Supplier Master</button>
      </div>

      <div style={{
        display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:0,
        borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)',
        padding:'24px 0', marginBottom:32,
      }}>
        {[
          { label:'Supplier ทั้งหมด', value: loading ? '…' : stats.total, sub:`${stats.active} Active` },
          { label:'รายการที่เคยเสนอราคา', value: loading ? '…' : stats.itemsSold, sub:'distinct วัสดุ' },
          { label:'ราคาในระบบ', value: loading ? '…' : stats.totalQuotes, sub:'price points ทั้งหมด' },
          { label:'อัตราชนะเฉลี่ย', value: loading ? '…' : (stats.avgWin == null ? '—' : stats.avgWin.toFixed(0) + '%'), sub:'RFQ → ปิดงาน' },
        ].map((s, i) => (
          <div key={i} style={{ paddingLeft: i === 0 ? 0 : 28, borderLeft: i === 0 ? 'none' : '1px solid var(--rule)' }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4 }}>
          {['ทั้งหมด','Material','SubContract'].map(c => (
            <button key={c} onClick={() => setTypeFilter(c)} className="btn sm" style={{
              background: typeFilter === c ? 'var(--ink)' : 'transparent',
              color: typeFilter === c ? 'var(--paper)' : 'var(--ink-2)',
              borderColor: typeFilter === c ? 'var(--ink)' : 'var(--rule)',
              padding:'5px 12px',
            }}>{c}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหา Supplier…" />
          <span style={{ fontSize:12.5, color:'var(--ink-3)' }}>
            แสดง <strong style={{ color:'var(--ink)' }}>{filtered.length}</strong> ราย
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
              <th style={{ width:'10%' }}>รหัส</th>
              <th>Supplier · ประเภท</th>
              <th className="num-col">รายการที่เสนอ</th>
              <th className="num-col">ราคาในระบบ</th>
              <th className="num-col">RFQ · ชนะ</th>
              <th className="num-col">Win Rate</th>
              <th>เครดิตเทอม</th>
              <th>เสนอราคาล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มี Supplier — เพิ่มได้ที่ Settings → ผู้ขาย/ผู้รับเหมา
              </td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} onClick={() => {
                  try { window.localStorage.setItem('supplierdb.currentId', s.id); } catch {}
                  go('supplierdb-detail');
                }} style={{ cursor:'pointer' }}>
                <td className="font-mono" style={{ fontSize:11.5, color:'var(--ink-2)', fontWeight:500 }}>{s.code}</td>
                <td>
                  <div style={{ display:'inline-flex', gap:10, alignItems:'center' }}>
                    <Av initials={(s.name || '').slice(0,2)} kind="default" />
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontWeight:500 }}>{s.name}</span>
                        {s.status3 === 'Blacklist' && (
                          <span style={{ display:'inline-block', padding:'1px 7px', borderRadius:3,
                            background:'var(--clay-soft)', color:'#6B2D1A', fontSize:10, fontWeight:600 }}>Blacklist</span>
                        )}
                        {s.status3 === 'Non-Active' && (
                          <span style={{ display:'inline-block', padding:'1px 7px', borderRadius:3,
                            background:'var(--paper-2)', color:'var(--ink-3)', fontSize:10, fontWeight:600 }}>Non-Active</span>
                        )}
                      </div>
                      <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>
                        {(s.type || '—').split(',').map(t => t.trim()).filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="num-col num" style={{ color:'var(--ink-2)' }}>{s.itemsSold || '—'}</td>
                <td className="num-col num" style={{ color:'var(--ink-2)' }}>{s.quotes || '—'}</td>
                <td className="num-col">
                  {s.rfqCount
                    ? <span className="num">{s.rfqCount} · {s.wins}</span>
                    : <span style={{ color:'var(--ink-4)' }}>—</span>}
                </td>
                <td className="num-col">
                  {s.winRate == null ? <span style={{ color:'var(--ink-4)' }}>—</span> : (
                    <div style={{ display:'inline-flex', alignItems:'center', gap:6, justifyContent:'flex-end' }}>
                      <div style={{ width:54, height:5, background:'var(--rule)', borderRadius:999, overflow:'hidden' }}>
                        <div style={{ width:`${s.winRate}%`, height:'100%', background:'var(--teal)' }} />
                      </div>
                      <span className="num" style={{ fontSize:12, fontWeight:500, minWidth:42 }}>{s.winRate.toFixed(0)}%</span>
                    </div>
                  )}
                </td>
                <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{s.payment_terms || '—'}</td>
                <td style={{ fontSize:12, color:'var(--ink-3)' }}>{fmtDate(s.lastQuote)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =================== Detail screen =================== */
export function ScreenSupplierDBDetail({ go }) {
  const { rows, matById, loading, err } = useSupplierIntel();
  const [supId, setSupId] = useState(null);

  useEffect(() => {
    try { setSupId(window.localStorage.getItem('supplierdb.currentId')); } catch {}
  }, []);

  const sup = useMemo(
    // No silent fallback to rows[0] — a stale/deleted id must show "not
    // found" rather than a different supplier's data.
    () => (supId ? rows.find(s => s.id === supId) || null : rows[0] || null),
    [rows, supId]
  );

  // Latest price per material this supplier quoted
  const priceRows = useMemo(() => {
    if (!sup) return [];
    const seen = new Set();
    const out = [];
    for (const p of sup.pricePoints) {        // ordered captured_at desc
      if (seen.has(p.material_id)) continue;
      seen.add(p.material_id);
      const m = matById.get(p.material_id);
      out.push({
        id: p.id, name: m?.name || p.material_id, code: m?.code || '',
        price: Number(p.price), at: p.captured_at, source: p.source, sourceId: p.source_id,
      });
    }
    return out;
  }, [sup, matById]);

  if (loading) {
    return (
      <div className="page">
        <button className="btn ghost sm" onClick={() => go('supplierdb')} style={{ marginBottom:20, marginLeft:-8 }}>
          {Icons.back} กลับไป Supplier Database
        </button>
        <div style={{ padding:40, textAlign:'center', color:'var(--ink-3)' }}>กำลังโหลด…</div>
      </div>
    );
  }

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => go('supplierdb')} style={{ marginBottom:20, marginLeft:-8 }}>
        {Icons.back} กลับไป Supplier Database
      </button>

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>
      )}

      <div className="page-head" style={{ alignItems:'flex-start' }}>
        <div className="page-title">
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
            <span className="font-mono" style={{ fontSize:12, color:'var(--ink-3)' }}>{sup?.code || '—'}</span>
            <Chip kind={sup?.status3 === 'Active' ? 'active' : 'draft'}>{sup?.status3 || '—'}</Chip>
          </div>
          <h1 className="h-display" style={{ margin:0 }}>{sup?.name || 'ยังไม่มีข้อมูล'}</h1>
          <div style={{ display:'flex', gap:24, marginTop:12, fontSize:13, color:'var(--ink-3)', flexWrap:'wrap' }}>
            <span>ประเภท <strong style={{ color:'var(--ink-2)' }}>{(sup?.type || '—').split(',').map(t=>t.trim()).filter(Boolean).join(' · ') || '—'}</strong></span>
            <span>เครดิตเทอม <strong style={{ color:'var(--ink-2)' }}>{sup?.payment_terms || '—'}</strong></span>
            <span>ผู้ติดต่อ <strong style={{ color:'var(--ink-2)' }}>{sup?.contact_name || '—'}</strong>{sup?.phone ? ` · ${sup.phone}` : ''}</span>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" onClick={() => go('suppliers')}>{Icons.edit} แก้ไขข้อมูล Master</button>
          <button className="btn primary" onClick={() => go('rfq-create')}>สร้าง RFQ ให้ Supplier นี้</button>
        </div>
      </div>

      <div style={{
        display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:0,
        borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)',
        padding:'24px 0', marginBottom:32,
      }}>
        {[
          { label:'รายการที่เคยเสนอ', value: sup?.itemsSold ?? 0, sub:'distinct วัสดุ' },
          { label:'ราคาในระบบ', value: sup?.quotes ?? 0, sub:'price points' },
          { label:'RFQ ที่ได้รับ', value: sup?.rfqCount ?? 0, sub:`ปิดงาน ${sup?.wins ?? 0} ใบ` },
          { label:'Win Rate', value: sup?.winRate == null ? '—' : sup.winRate.toFixed(0) + '%', sub:'RFQ → ปิดงาน' },
        ].map((stat, i) => (
          <div key={i} style={{ paddingLeft: i === 0 ? 0 : 28, borderLeft: i === 0 ? 'none' : '1px solid var(--rule)' }}>
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-sub">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:32, alignItems:'flex-start' }}>
        {/* Latest price per material */}
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--rule)' }}>
            <h3 className="h-card">ราคาล่าสุดที่เคยเสนอ · {priceRows.length} รายการ</h3>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>วัสดุ</th>
                <th className="num-col">ราคา</th>
                <th>ที่มา</th>
                <th>เมื่อ</th>
              </tr>
            </thead>
            <tbody>
              {priceRows.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign:'center', padding:32, color:'var(--ink-3)' }}>
                  ยังไม่มีราคาจาก Supplier นี้
                </td></tr>
              ) : priceRows.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight:500, fontSize:13 }}>{p.name}</div>
                    {p.code && <div className="font-mono" style={{ fontSize:10.5, color:'var(--ink-4)', marginTop:2 }}>{p.code}</div>}
                  </td>
                  <td className="num-col num" style={{ fontWeight:500 }}>{money(p.price)}</td>
                  <td style={{ fontSize:11.5 }}>
                    <span style={{ padding:'1px 8px', borderRadius:3,
                      background: p.source === 'RFQ' ? 'var(--teal-soft)' : 'var(--paper-2)',
                      color: p.source === 'RFQ' ? 'var(--teal-ink)' : 'var(--ink-2)', fontWeight:500 }}>
                      {p.source === 'RFQ' ? (p.sourceId || 'RFQ') : 'Manual'}
                    </span>
                  </td>
                  <td style={{ fontSize:12, color:'var(--ink-3)' }}>{fmtDate(p.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RFQ history */}
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--rule)' }}>
            <h3 className="h-card">RFQ ที่ส่งให้ · {sup?.rfqCount ?? 0} ใบ</h3>
          </div>
          {(!sup || sup.rfqList.length === 0) ? (
            <div style={{ padding:32, textAlign:'center', color:'var(--ink-3)', fontSize:13 }}>
              ยังไม่เคยส่ง RFQ ให้ Supplier นี้
            </div>
          ) : sup.rfqList.map((r, i) => (
            <div key={r.id} onClick={() => { try { localStorage.setItem('rfq.currentId', r.id); } catch {} go('rfq-confirm'); }}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 20px',
                       borderTop: i ? '1px solid var(--rule)' : 'none', cursor:'pointer' }}>
              <span className="font-mono" style={{ fontSize:11.5, fontWeight:500, color:'var(--ink-2)' }}>{r.no}</span>
              <span style={{ flex:1, fontSize:12.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</span>
              <span style={{ fontSize:11, color:'var(--ink-3)' }}>
                {{ draft:'ร่าง', sent:'ส่งแล้ว', received:'ได้ Quote', closed:'ปิดงาน', cancelled:'ยกเลิก' }[r.status] || r.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
