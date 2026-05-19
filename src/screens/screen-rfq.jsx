'use client';
import React, { useState } from 'react';
import { Icons, Chip, Av, Spark, Delta, money } from '../lib/shell';

/*
  RFQ — list + the post-quote "confirm to Price DB" screen.

  Per latest spec:
  - Title shows "ใบขอให้เสนอราคา (RFQ)"
  - Single summary card: docs waiting for Supplier to reply
  - Simpler table: RFQ No. / รายการ / Supplier / สร้างเอกสาร / ครบกำหนด / สถานะ
  - Statuses reduced to 2: Wait | Received
*/

/* =================== Data =================== */

// status: 'wait'    = created but Supplier hasn't sent back & been confirmed yet
// status: 'received' = supplier reply uploaded AND confirmed in system
const rfqRows = [];

/* =================== List =================== */

export function ScreenRFQ({ go }) {
  const [filter, setFilter] = useState('ทั้งหมด');
  const [q, setQ] = useState('');

  const waiting = rfqRows.filter(r => r.status === 'wait').length;

  const filtered = rfqRows.filter(r => {
    if (filter === 'Wait'     && r.status !== 'wait')     return false;
    if (filter === 'Received' && r.status !== 'received') return false;
    if (q) {
      const v = q.toLowerCase();
      if (!(r.no.toLowerCase().includes(v) || r.title.includes(q) || r.sup.includes(q))) return false;
    }
    return true;
  });

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
          <button className="btn">{Icons.upload} Upload Quote</button>
          <button className="btn primary" onClick={() => go('rfq-create')}>{Icons.plus} สร้าง RFQ ใหม่</button>
        </div>
      </div>

      {/* Single stat: docs waiting for supplier reply */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr', gap:0,
        borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)',
        padding:'24px 0', marginBottom:32,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:24 }}>
          <div>
            <div className="stat-label">รอ Supplier ตอบกลับ</div>
            <div className="stat-value" style={{ color: waiting > 0 ? 'var(--clay)' : 'var(--ink)' }}>
              {waiting} <span className="unit">ฉบับ</span>
            </div>
            <div className="stat-sub">ยังไม่ได้อัพโหลด Quote เข้าระบบ หรือยังไม่ได้ยืนยันราคา</div>
          </div>
          {waiting > 0 && (
            <div style={{
              marginLeft:'auto', display:'flex', gap:8, alignItems:'center',
              padding:'10px 16px', background:'var(--surface-2)',
              border:'1px solid var(--rule)', borderRadius:6,
              fontSize:12.5, color:'var(--ink-2)',
            }}>
              <span style={{ color:'var(--clay)' }}>{Icons.clock}</span>
              <span>
                <strong>{rfqRows.filter(r => r.status==='wait' && (r.dueWarn==='วันนี้' || r.dueWarn==='เกินกำหนด')).length}</strong> ใบ ใกล้ครบกำหนดหรือเกินกำหนดแล้ว
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4 }}>
          {['ทั้งหมด','Wait','Received'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className="btn sm" style={{
              background: filter === f ? 'var(--ink)' : 'transparent',
              color: filter === f ? 'var(--paper)' : 'var(--ink-2)',
              borderColor: filter === f ? 'var(--ink)' : 'var(--rule)',
              padding:'5px 12px',
            }}>{f}</button>
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
              <th>Supplier</th>
              <th>วันที่สร้างเอกสาร</th>
              <th>วันที่ครบกำหนด</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>ยังไม่มีข้อมูล</td></tr>
            ) : filtered.map((r, i) => (
              <tr key={i} onClick={() => r.status === 'received' ? go('rfq-confirm') : null}
                  style={{ cursor: r.status === 'received' ? 'pointer' : 'default' }}>
                <td>
                  <div className="font-mono" style={{ fontSize:12, color:'var(--ink-2)', fontWeight:500 }}>{r.no}</div>
                </td>
                <td>
                  <div style={{ fontWeight:500 }}>{r.title}</div>
                  <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:2 }}>{r.items} รายการ</div>
                </td>
                <td>
                  <span style={{ display:'inline-flex', gap:8, alignItems:'center' }}>
                    <Av initials={r.sup.slice(0,2)} kind={r.supkind} />
                    <span style={{ fontSize:12.5 }}>{r.sup}</span>
                  </span>
                </td>
                <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{r.created}</td>
                <td>
                  <div style={{ fontSize:12.5 }}>{r.due}</div>
                  {r.dueWarn && <div style={{ fontSize:11, color: r.dueWarn==='เกินกำหนด' ? 'var(--clay)' : 'var(--ochre)', marginTop:2 }}>{r.dueWarn}</div>}
                </td>
                <td>
                  {r.status === 'wait'
                    ? <span style={{
                        display:'inline-flex', alignItems:'center', gap:6,
                        fontSize:11, fontWeight:500, padding:'2px 10px', borderRadius:999,
                        background:'var(--ochre-soft)', color:'#6B5121',
                      }}>
                        <span style={{ width:6, height:6, borderRadius:999, background:'var(--ochre)' }} />
                        Wait
                      </span>
                    : <span style={{
                        display:'inline-flex', alignItems:'center', gap:6,
                        fontSize:11, fontWeight:500, padding:'2px 10px', borderRadius:999,
                        background:'var(--moss-soft)', color:'#2F4A1A',
                      }}>
                        <span style={{ width:6, height:6, borderRadius:999, background:'var(--moss)' }} />
                        Received
                      </span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =================== Post-quote confirm screen (kept as-is) =================== */

export function ScreenRFQConfirm({ go }) {
  const [items, setItems] = useState([]);

  const toggle = (id) => setItems(items.map(it => it.id === id ? { ...it, save: !it.save } : it));

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
            <Chip kind="recv">รับ Quote แล้ว</Chip>
          </div>
          <h1 className="h-display">ตรวจสอบก่อนบันทึก Price DB</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: '8px 0 0', maxWidth: 620 }}>
            เปรียบเทียบราคาใหม่จาก Supplier กับราคาเดิมในระบบ — ติ๊กเลือกรายการที่จะเก็บเข้า Price DB
          </p>
        </div>
      </div>

      {/* Main comparison panel */}
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
              <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>ยังไม่มีข้อมูล</td></tr>
            ) : items.map((it) => {
              const delta = it.oldP == null ? null : ((it.newP - it.oldP) / it.oldP) * 100;
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
                  <td className="num-col num" style={{ color: 'var(--ink-2)' }}>{it.qty.toLocaleString()} {it.unit}</td>
                  <td>
                    {it.oldP == null
                      ? <span style={{ fontSize:12, color:'var(--ink-4)' }}>— ไม่มีในระบบ</span>
                      : (<>
                          <span className="num">{money(it.oldP)}</span>
                          <div style={{ fontSize:11, color:'var(--ink-4)', marginTop:2 }}>{it.oldDate}</div>
                        </>)}
                  </td>
                  <td className="num-col">
                    <input type="text" defaultValue={it.newP.toLocaleString()} className="num"
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
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button className="btn ghost">ยกเลิก</button>
          <button className="btn">บันทึก RFQ แต่ไม่เข้า Price DB</button>
          <button className="btn primary" style={{ padding:'10px 20px' }}>
            {Icons.check} ยืนยันบันทึก Price DB
          </button>
        </div>
      </div>
    </div>
  );
}
