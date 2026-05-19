'use client';
import React, { useState } from 'react';
import { Icons, Chip, Av, Delta, Spark, money } from '../lib/shell';
import { SettingsSearchBox } from '../lib/settings-shared';
/*
  Supplier Database — Module 5
  Concept: see what each Supplier sells and their quotation statistics.

  Routes:
    #supplierdb        → list (matrix of all suppliers + summary stats)
    #supplierdb-detail → one supplier's "card": products sold + quote history + KPIs
*/

/* =================== Synthetic supplier roster + stats =================== */
const SUPPLIER_DB = [];

/* =================== List screen =================== */
export function ScreenSupplierDB({ go }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('ทั้งหมด');

  const cats = ['ทั้งหมด','งานโครงสร้าง','งานก่ออิฐ-ฉาบปูน','งานหลังคา','งานพื้น-ผนัง','งานสุขภัณฑ์','งานสี','งานระบบไฟฟ้า'];

  const filtered = SUPPLIER_DB.filter(s => {
    if (cat !== 'ทั้งหมด' && !s.categories.includes(cat)) return false;
    if (q) {
      const v = q.toLowerCase();
      if (!(s.name.toLowerCase().includes(v) || s.id.toLowerCase().includes(v) || s.categories.some(c => c.includes(q)))) return false;
    }
    return true;
  });

  const totalItems    = SUPPLIER_DB.reduce((a,s) => a + s.items, 0);
  const totalQuotes30 = SUPPLIER_DB.reduce((a,s) => a + s.quotes, 0);
  const avgWin        = SUPPLIER_DB.length ? (SUPPLIER_DB.reduce((a,s) => a + s.winRate, 0) / SUPPLIER_DB.length).toFixed(1) : '0.0';
  const avgResp       = SUPPLIER_DB.length ? (SUPPLIER_DB.reduce((a,s) => a + s.avgResp, 0) / SUPPLIER_DB.length).toFixed(1) : '0.0';

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Module 5 · Supplier Intelligence</div>
          <h1 className="h-display">Supplier Database</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:640 }}>
            สำรวจดูว่า Supplier แต่ละเจ้าขายอะไรบ้าง · เคยเสนอราคามาแล้วกี่ครั้ง ·
            อัตราชนะ RFQ · เวลาตอบกลับเฉลี่ย — ใช้ประกอบการตัดสินใจ
          </p>
        </div>
      </div>

      {/* Top stats */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:0,
        borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)',
        padding:'24px 0', marginBottom:32,
      }}>
        {[
          { label:'Supplier ทั้งหมด',  value: SUPPLIER_DB.length, sub:'ในระบบและพร้อมใช้' },
          { label:'รายการที่ขาย',       value: totalItems.toLocaleString(), sub: SUPPLIER_DB.length ? ('รายการเฉลี่ย/เจ้า ' + Math.round(totalItems/SUPPLIER_DB.length)) : 'ยังไม่มีข้อมูล' },
          { label:'ใบเสนอราคา 12 ด.',   value: totalQuotes30.toLocaleString(), sub:'จากทุก Supplier' },
          { label:'อัตราชนะเฉลี่ย',      value: avgWin + '%', sub:'การชนะ RFQ ที่ส่งให้' },
          { label:'ตอบกลับเฉลี่ย',       value: avgResp + ' วัน', sub:'หลังส่ง RFQ' },
        ].map((s, i) => (
          <div key={i} style={{ paddingLeft: i === 0 ? 0 : 28, borderLeft: i === 0 ? 'none' : '1px solid var(--rule)' }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)} className="btn sm" style={{
              background: cat === c ? 'var(--ink)' : 'transparent',
              color: cat === c ? 'var(--paper)' : 'var(--ink-2)',
              borderColor: cat === c ? 'var(--ink)' : 'var(--rule)',
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

      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:'10%' }}>รหัส</th>
              <th>Supplier · หมวด</th>
              <th className="num-col">รายการที่ขาย</th>
              <th className="num-col">ใบเสนอราคา 12 ด.</th>
              <th className="num-col">Win Rate</th>
              <th className="num-col">ตอบกลับ</th>
              <th>เครดิตเทอม</th>
              <th>ราคา MoM</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล
              </td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} onClick={() => go('supplierdb-detail')} style={{ cursor:'pointer' }}>
                <td className="font-mono" style={{ fontSize:11.5, color:'var(--ink-2)', fontWeight:500 }}>{s.id}</td>
                <td>
                  <div style={{ display:'inline-flex', gap:10, alignItems:'center' }}>
                    <Av initials={s.name.slice(0,2)} kind={s.kind} />
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontWeight:500 }}>{s.name}</span>
                        {s.statusBadge && (
                          <span style={{
                            display:'inline-block', padding:'1px 7px', borderRadius:3,
                            background: s.statusBadge === 'พรีเมียม' ? 'var(--teal-soft)' : 'var(--paper-2)',
                            color: s.statusBadge === 'พรีเมียม' ? 'var(--teal-ink)' : 'var(--ink-2)',
                            fontSize:10, fontWeight:600, letterSpacing:0.04,
                          }}>{s.statusBadge}</span>
                        )}
                      </div>
                      <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>{s.categories.join(' · ')}</div>
                    </div>
                  </div>
                </td>
                <td className="num-col num" style={{ color:'var(--ink-2)' }}>{s.items}</td>
                <td className="num-col">
                  <div className="num" style={{ color:'var(--ink-2)' }}>{s.quotes}</div>
                  <div style={{ fontSize:10.5, color:'var(--ink-3)', marginTop:2 }}>RFQ {s.rfqs} · ชนะ {s.wins}</div>
                </td>
                <td className="num-col">
                  <div style={{ display:'inline-flex', alignItems:'center', gap:6, justifyContent:'flex-end' }}>
                    <div style={{ width:54, height:5, background:'var(--rule)', borderRadius:999, overflow:'hidden' }}>
                      <div style={{ width:`${s.winRate}%`, height:'100%', background:'var(--teal)' }} />
                    </div>
                    <span className="num" style={{ fontSize:12, fontWeight:500, minWidth:42 }}>{s.winRate.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="num-col num" style={{ color: s.avgResp < 1 ? 'var(--moss)' : s.avgResp > 1.5 ? 'var(--ochre)' : 'var(--ink-2)' }}>
                  {s.avgResp} วัน
                </td>
                <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{s.credit}</td>
                <td><Delta pct={s.avgDelta} dir={s.avgDeltaDir} /></td>
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
  const tabs = ['ภาพรวม','รายการที่ขาย','ประวัติการเสนอราคา','RFQ ที่เกี่ยวข้อง'];
  const [tab, setTab] = useState('ภาพรวม');

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => go('supplierdb')} style={{ marginBottom:20, marginLeft:-8 }}>
        {Icons.back} กลับไป Supplier Database
      </button>

      <div className="page-head" style={{ alignItems:'flex-start' }}>
        <div className="page-title">
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
            <span className="font-mono" style={{ fontSize:12, color:'var(--ink-3)' }}>—</span>
            <Chip kind="active">Active</Chip>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <h1 className="h-display" style={{ margin:0 }}>ยังไม่มีข้อมูล</h1>
          </div>
          <div style={{ display:'flex', gap:24, marginTop:12, fontSize:13, color:'var(--ink-3)', flexWrap:'wrap' }}>
            <span>หมวด <strong style={{ color:'var(--ink-2)' }}>—</strong></span>
            <span>เครดิตเทอม <strong style={{ color:'var(--ink-2)' }}>—</strong></span>
            <span>ผู้ติดต่อ <strong style={{ color:'var(--ink-2)' }}>—</strong></span>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn">{Icons.edit} แก้ไขข้อมูล Master</button>
          <button className="btn primary" onClick={() => go('rfq-create')}>สร้าง RFQ ให้ Supplier นี้</button>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:0,
        borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)',
        padding:'24px 0', marginBottom:32,
      }}>
        {[
          { label:'รายการที่ขาย',     value: 0,        sub:'ใน Material/SubContract' },
          { label:'ใบเสนอราคา 12 ด.', value: 0,        sub:'ยังไม่มีข้อมูล' },
          { label:'RFQ ที่ได้รับ',     value: 0,        sub:'ยังไม่มีข้อมูล' },
          { label:'ตอบกลับเฉลี่ย',     value: '— วัน',  sub:'หลังส่ง RFQ' },
          { label:'ยอดสั่งซื้อ YTD',    value: money(0), sub:'12 เดือนล่าสุด' },
        ].map((stat, i) => (
          <div key={i} style={{ paddingLeft: i === 0 ? 0 : 28, borderLeft: i === 0 ? 'none' : '1px solid var(--rule)' }}>
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-sub">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="tabs" style={{ marginBottom:24 }}>
        {tabs.map(t => (
          <div key={t} className={"tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>{t}</div>
        ))}
      </div>

      {tab === 'ภาพรวม' && <OverviewTab />}
      {tab === 'รายการที่ขาย' && <ProductsTab />}
      {tab === 'ประวัติการเสนอราคา' && <QuoteHistoryTab />}
      {tab === 'RFQ ที่เกี่ยวข้อง' && <RFQRelatedTab />}
    </div>
  );
}

function OverviewTab() {
  const topItems = [];
  const performance = [];
  const activities = [];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:32 }}>
      <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

        {/* Quote frequency chart */}
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)', display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
            <div>
              <h3 className="h-card">การเสนอราคาย้อนหลัง 12 เดือน</h3>
              <p style={{ fontSize:11.5, color:'var(--ink-3)', margin:'4px 0 0' }}>จำนวนใบเสนอราคา · แยกเป็นที่ชนะและไม่ชนะ</p>
            </div>
          </div>
          <div style={{ padding:40, textAlign:'center', color:'var(--ink-3)', fontSize:13 }}>
            ยังไม่มีข้อมูล
          </div>
        </div>

        {/* Top items */}
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)' }}>
            <h3 className="h-card">รายการที่เสนอบ่อยที่สุด</h3>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width:'16%' }}>รหัส</th>
                <th>รายการ</th>
                <th className="num-col">จำนวนครั้ง</th>
                <th className="num-col">ราคาเฉลี่ย</th>
                <th>เทรนด์ 6 ด.</th>
              </tr>
            </thead>
            <tbody>
              {topItems.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                  ยังไม่มีข้อมูล
                </td></tr>
              ) : topItems.map(r => (
                <tr key={r.code}>
                  <td className="font-mono" style={{ fontSize:11.5, color:'var(--ink-2)' }}>{r.code}</td>
                  <td style={{ fontWeight:500 }}>{r.name}</td>
                  <td className="num-col num" style={{ color:'var(--ink-2)' }}>{r.n}</td>
                  <td className="num-col num" style={{ fontWeight:500 }}>{money(r.avg)}</td>
                  <td><Spark data={r.spark} w={120} h={26} color="var(--clay)" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right rail */}
      <aside style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div className="card">
          <div className="eyebrow" style={{ marginBottom:12 }}>Performance Score</div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:42, lineHeight:1, color:'var(--teal-ink)' }}>
            —<span style={{ fontSize:18, color:'var(--ink-3)', marginLeft:6 }}>/ 10</span>
          </div>
          {performance.length === 0 ? (
            <div style={{ marginTop:14, fontSize:12, color:'var(--ink-3)', textAlign:'center', padding:'12px 0' }}>
              ยังไม่มีข้อมูล
            </div>
          ) : (
            <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:10 }}>
              {performance.map(r => (
                <div key={r.label}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11.5, marginBottom:4 }}>
                    <span style={{ color:'var(--ink-3)' }}>{r.label}</span>
                    <span className="num" style={{ fontWeight:500 }}>{r.score.toFixed(1)}</span>
                  </div>
                  <div style={{ height:4, background:'var(--rule)', borderRadius:999, overflow:'hidden' }}>
                    <div style={{ width:`${r.score*10}%`, height:'100%', background:'var(--teal)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="eyebrow" style={{ marginBottom:10 }}>กิจกรรมล่าสุด</div>
          {activities.length === 0 ? (
            <div style={{ textAlign:'center', padding:20, color:'var(--ink-3)', fontSize:12 }}>
              ยังไม่มีข้อมูล
            </div>
          ) : activities.map((a, i) => (
            <div key={i} style={{ display:'flex', gap:10, padding:'10px 0', borderBottom: i < activities.length - 1 ? '1px solid var(--rule)' : 'none' }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:10.5, color:'var(--ink-3)', minWidth:50 }}>{a.d}</span>
              <span style={{ fontSize:12, color:a.tone === 'moss' ? 'var(--moss)' : 'var(--ink-2)', lineHeight:1.5 }}>{a.what}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function ProductsTab() {
  const products = [];
  return (
    <div className="card" style={{ padding:0 }}>
      <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--rule)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h3 className="h-card">รายการที่ Supplier เคยขาย / เสนอราคา</h3>
          <p style={{ fontSize:11.5, color:'var(--ink-3)', margin:'4px 0 0' }}>ราคาแสดงเป็น net · ไม่รวม VAT/Overhead</p>
        </div>
        <span style={{ fontSize:12.5, color:'var(--ink-3)' }}>
          <strong style={{ color:'var(--ink)' }}>{products.length}</strong> รายการ
        </span>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width:'16%' }}>รหัส</th>
            <th>รายการ</th>
            <th>หน่วย</th>
            <th className="num-col">เสนอมาแล้ว</th>
            <th className="num-col">ราคาล่าสุด (net)</th>
            <th>วันที่เสนอ</th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
              ยังไม่มีข้อมูล
            </td></tr>
          ) : products.map(p => (
            <tr key={p.code}>
              <td className="font-mono" style={{ fontSize:11.5, color:'var(--ink-2)' }}>{p.code}</td>
              <td>
                <div style={{ fontWeight:500 }}>{p.name}</div>
                <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>{p.spec}</div>
              </td>
              <td style={{ fontSize:12.5, color:'var(--ink-3)' }}>{p.unit}</td>
              <td className="num-col num" style={{ color:'var(--ink-2)' }}>{p.n} ครั้ง</td>
              <td className="num-col num" style={{ fontWeight:500 }}>{money(p.lastP)}</td>
              <td style={{ fontSize:12, color:'var(--ink-3)' }}>{p.lastDate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuoteHistoryTab() {
  const quotes = [];
  const RES_PILL = {
    won:     { bg:'var(--moss-soft)',    fg:'#2F4A1A',        dot:'var(--moss)', label:'ชนะ' },
    lost:    { bg:'var(--clay-soft)',    fg:'#6B2D1A',        dot:'var(--clay)', label:'แพ้' },
    pending: { bg:'var(--chip-recv-bg)', fg:'var(--chip-recv-fg)', dot:'var(--ochre)', label:'รอผล' },
  };
  return (
    <div className="card" style={{ padding:0 }}>
      <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--rule)' }}>
        <h3 className="h-card">ประวัติการเสนอราคา</h3>
        <p style={{ fontSize:11.5, color:'var(--ink-3)', margin:'4px 0 0' }}>ทุกใบเสนอราคาที่ Supplier เคยตอบกลับ RFQ ของเรา</p>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>วันที่เสนอ</th>
            <th>RFQ</th>
            <th>รายการ</th>
            <th className="num-col">จำนวน</th>
            <th className="num-col">ราคา (net)</th>
            <th className="num-col">มูลค่ารวม</th>
            <th>ผลการตัดสิน</th>
          </tr>
        </thead>
        <tbody>
          {quotes.length === 0 ? (
            <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
              ยังไม่มีข้อมูล
            </td></tr>
          ) : quotes.map(q => {
            const p = RES_PILL[q.result];
            return (
              <tr key={q.rfq + q.item}>
                <td style={{ fontSize:12, color:'var(--ink-2)' }}>{q.date}</td>
                <td className="font-mono" style={{ fontSize:11.5, color:'var(--ink-2)' }}>{q.rfq}</td>
                <td>{q.item}</td>
                <td className="num-col num" style={{ color:'var(--ink-3)' }}>{q.qty.toLocaleString()} {q.unit}</td>
                <td className="num-col num">{money(q.price)}</td>
                <td className="num-col num" style={{ fontWeight:500 }}>{money(q.qty * q.price)}</td>
                <td>
                  <span style={{
                    display:'inline-flex', alignItems:'center', gap:6,
                    fontSize:11, fontWeight:500, padding:'2px 10px', borderRadius:999,
                    background: p.bg, color: p.fg,
                  }}>
                    <span style={{ width:6, height:6, borderRadius:999, background: p.dot }} />
                    {p.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RFQRelatedTab() {
  const rfqs = [];
  return (
    <div className="card" style={{ padding:0 }}>
      <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--rule)' }}>
        <h3 className="h-card">RFQ ที่เกี่ยวข้องกับ Supplier นี้</h3>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>RFQ No.</th>
            <th>วันที่ส่ง</th>
            <th className="num-col">รายการ</th>
            <th className="num-col">มูลค่ารวม</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {rfqs.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
              ยังไม่มีข้อมูล
            </td></tr>
          ) : rfqs.map(r => (
            <tr key={r.no}>
              <td className="font-mono" style={{ fontSize:12, color:'var(--ink-2)', fontWeight:500 }}>{r.no}</td>
              <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{r.date}</td>
              <td className="num-col num" style={{ color:'var(--ink-2)' }}>{r.items}</td>
              <td className="num-col num" style={{ fontWeight:500 }}>{money(r.total)}</td>
              <td>
                {r.status === 'wait'
                  ? <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, fontWeight:500, padding:'2px 10px', borderRadius:999, background:'var(--ochre-soft)', color:'#6B5121' }}>
                      <span style={{ width:6, height:6, borderRadius:999, background:'var(--ochre)' }} />Wait
                    </span>
                  : <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, fontWeight:500, padding:'2px 10px', borderRadius:999, background:'var(--moss-soft)', color:'#2F4A1A' }}>
                      <span style={{ width:6, height:6, borderRadius:999, background:'var(--moss)' }} />Received
                    </span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

