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
const SUPPLIER_DB = [
  { id:'SUP-00001', name:'เอเชียสตีล จำกัด',         kind:'aw',     categories:['งานโครงสร้าง'],
    items:42, quotes:96,  rfqs:18, wins:9,  winRate:50.0, avgResp:1.2, lastQuote:'17 พ.ค. 69', credit:'45 วัน',
    avgDelta:'+18.4%', avgDeltaDir:'up', spendYTD:1840000, statusBadge:'พรีเมียม' },
  { id:'SUP-00002', name:'รุ่งเรืองสตีล',             kind:'rr',     categories:['งานโครงสร้าง'],
    items:38, quotes:124, rfqs:24, wins:14, winRate:58.3, avgResp:0.8, lastQuote:'15 พ.ค. 69', credit:'30 วัน',
    avgDelta:'+12.0%', avgDeltaDir:'up', spendYTD:1395000, statusBadge:'ใช้บ่อย' },
  { id:'SUP-00003', name:'SCG Distribution',          kind:'sc',     categories:['งานโครงสร้าง','งานหลังคา'],
    items:124,quotes:208, rfqs:42, wins:18, winRate:42.9, avgResp:1.8, lastQuote:'12 พ.ค. 69', credit:'60 วัน',
    avgDelta:'+1.9%',  avgDeltaDir:'up', spendYTD:1010000, statusBadge:'พรีเมียม' },
  { id:'SUP-00004', name:'TOA Distribution',          kind:'default',categories:['งานสี'],
    items:62, quotes:152, rfqs:18, wins:11, winRate:61.1, avgResp:0.6, lastQuote:'12 พ.ค. 69', credit:'30 วัน',
    avgDelta:'+2.6%',  avgDeltaDir:'up', spendYTD:986000,  statusBadge:'ใช้บ่อย' },
  { id:'SUP-00005', name:'COTTO Wholesale',           kind:'default',categories:['งานสุขภัณฑ์'],
    items:88, quotes:74,  rfqs:12, wins:8,  winRate:66.7, avgResp:1.4, lastQuote:'8 พ.ค. 69',  credit:'45 วัน',
    avgDelta:'+0.5%',  avgDeltaDir:'up', spendYTD:684000,  statusBadge:'พรีเมียม' },
  { id:'SUP-00006', name:'CPAC Roof',                 kind:'sc',     categories:['งานหลังคา'],
    items:24, quotes:48,  rfqs:8,  wins:5,  winRate:62.5, avgResp:1.0, lastQuote:'10 พ.ค. 69', credit:'45 วัน',
    avgDelta:'+0.5%',  avgDeltaDir:'flat', spendYTD:248000, statusBadge:null },
  { id:'SUP-00007', name:'Q-CON Direct',              kind:'default',categories:['งานก่ออิฐ-ฉาบปูน'],
    items:18, quotes:36,  rfqs:6,  wins:4,  winRate:66.7, avgResp:1.5, lastQuote:'12 พ.ค. 69', credit:'30 วัน',
    avgDelta:'0.0%',   avgDeltaDir:'flat', spendYTD:184000, statusBadge:null },
  { id:'SUP-00008', name:'ไทยเซรามิค',                kind:'default',categories:['งานพื้น-ผนัง'],
    items:96, quotes:88,  rfqs:14, wins:7,  winRate:50.0, avgResp:1.6, lastQuote:'14 พ.ค. 69', credit:'30 วัน',
    avgDelta:'−4.2%',  avgDeltaDir:'down', spendYTD:285000, statusBadge:null },
  { id:'SUP-00009', name:'BCC Electric',              kind:'default',categories:['งานระบบไฟฟ้า'],
    items:54, quotes:62,  rfqs:10, wins:6,  winRate:60.0, avgResp:1.1, lastQuote:'7 พ.ค. 69',  credit:'30 วัน',
    avgDelta:'+3.8%',  avgDeltaDir:'up', spendYTD:148000,  statusBadge:null },
  { id:'SUP-00010', name:'หจก. กระเบื้องช่าง',         kind:'default',categories:['งานพื้น-ผนัง','งานก่ออิฐ-ฉาบปูน'],
    items:6,  quotes:42,  rfqs:14, wins:9,  winRate:64.3, avgResp:0.5, lastQuote:'17 พ.ค. 69', credit:'งวด',
    avgDelta:'+0.0%',  avgDeltaDir:'flat', spendYTD:524000, statusBadge:null },
  { id:'SUP-00011', name:'หจก. ช่างไทย',              kind:'default',categories:['งานก่ออิฐ-ฉาบปูน','งานสี'],
    items:8,  quotes:64,  rfqs:22, wins:15, winRate:68.2, avgResp:0.4, lastQuote:'16 พ.ค. 69', credit:'งวด',
    avgDelta:'+0.0%',  avgDeltaDir:'flat', spendYTD:1240000, statusBadge:'ใช้บ่อย' },
  { id:'SUP-00012', name:'พี.ที. คอนสตรัคชั่น',       kind:'default',categories:['งานโครงสร้าง'],
    items:12, quotes:54,  rfqs:18, wins:11, winRate:61.1, avgResp:0.6, lastQuote:'14 พ.ค. 69', credit:'งวด',
    avgDelta:'+1.4%',  avgDeltaDir:'up', spendYTD:1850000, statusBadge:'ใช้บ่อย' },
];

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
  const avgWin        = (SUPPLIER_DB.reduce((a,s) => a + s.winRate, 0) / SUPPLIER_DB.length).toFixed(1);
  const avgResp       = (SUPPLIER_DB.reduce((a,s) => a + s.avgResp, 0) / SUPPLIER_DB.length).toFixed(1);

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
          { label:'รายการที่ขาย',       value: totalItems.toLocaleString(), sub:'รายการเฉลี่ย/เจ้า ' + Math.round(totalItems/SUPPLIER_DB.length) },
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
            {filtered.map(s => (
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

  const s = SUPPLIER_DB[1]; // รุ่งเรืองสตีล as example

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => go('supplierdb')} style={{ marginBottom:20, marginLeft:-8 }}>
        {Icons.back} กลับไป Supplier Database
      </button>

      <div className="page-head" style={{ alignItems:'flex-start' }}>
        <div className="page-title">
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
            <span className="font-mono" style={{ fontSize:12, color:'var(--ink-3)' }}>{s.id}</span>
            <Chip kind="active">{s.statusBadge || 'Active'}</Chip>
            <span style={{ fontSize:12, color:'var(--ink-3)' }}>· เข้าระบบเมื่อ 2 ส.ค. 2564</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <Av initials={s.name.slice(0,2)} kind={s.kind} />
            <h1 className="h-display" style={{ margin:0 }}>{s.name}</h1>
          </div>
          <div style={{ display:'flex', gap:24, marginTop:12, fontSize:13, color:'var(--ink-3)', flexWrap:'wrap' }}>
            <span>หมวด <strong style={{ color:'var(--ink-2)' }}>{s.categories.join(', ')}</strong></span>
            <span>เครดิตเทอม <strong style={{ color:'var(--ink-2)' }}>{s.credit}</strong></span>
            <span>ผู้ติดต่อ <strong style={{ color:'var(--ink-2)' }}>คุณสมชาย ใจดี · 089-555-1212</strong></span>
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
          { label:'รายการที่ขาย',     value: s.items,        sub:'ใน Material/SubContract' },
          { label:'ใบเสนอราคา 12 ด.', value: s.quotes,       sub:`เฉลี่ย ${(s.quotes/12).toFixed(1)} ใบ/เดือน` },
          { label:'RFQ ที่ได้รับ',     value: s.rfqs,         sub:`ชนะ ${s.wins} · ${s.winRate.toFixed(1)}%` },
          { label:'ตอบกลับเฉลี่ย',     value: `${s.avgResp} วัน`, sub:'หลังส่ง RFQ' },
          { label:'ยอดสั่งซื้อ YTD',    value: money(s.spendYTD), sub:'12 เดือนล่าสุด' },
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

      {tab === 'ภาพรวม' && <OverviewTab supplier={s} />}
      {tab === 'รายการที่ขาย' && <ProductsTab />}
      {tab === 'ประวัติการเสนอราคา' && <QuoteHistoryTab />}
      {tab === 'RFQ ที่เกี่ยวข้อง' && <RFQRelatedTab />}
    </div>
  );
}

function OverviewTab({ supplier }) {
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
          <div style={{ padding:24 }}>
            <QuoteBarsChart />
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
              {[
                { code:'MAT-STR-00003', name:'เหล็กเส้น DB12', n:18, avg:233, spark:[200,202,205,212,224,232,248] },
                { code:'MAT-STR-00004', name:'เหล็กเส้น DB16', n:14, avg:312, spark:[270,278,285,294,302,310,318] },
                { code:'MAT-STR-00005', name:'เหล็กเส้น DB20', n:11, avg:494, spark:[460,468,474,482,488,496,506] },
                { code:'MAT-STR-00007', name:'ลวดผูกเหล็ก เบอร์ 22', n:8, avg:62, spark:[58,58,60,60,62,62,65] },
              ].map(r => (
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
            8.2<span style={{ fontSize:18, color:'var(--ink-3)', marginLeft:6 }}>/ 10</span>
          </div>
          <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { label:'ตรงเวลา',        score:9.0 },
              { label:'ราคา',           score:7.5 },
              { label:'คุณภาพสินค้า',     score:8.4 },
              { label:'การตอบกลับ',     score:9.2 },
              { label:'หลังการขาย',      score:7.0 },
            ].map(r => (
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
        </div>

        <div className="card">
          <div className="eyebrow" style={{ marginBottom:10 }}>กิจกรรมล่าสุด</div>
          {[
            { d:'17 พ.ค.', what:'ส่งใบเสนอราคา RFQ-2026-019', tone:'teal' },
            { d:'14 พ.ค.', what:'อัพเดทเครดิตเทอม 30 → 45 วัน', tone:'ink' },
            { d:'12 พ.ค.', what:'ชนะ RFQ-2026-017 · มูลค่า ฿624K', tone:'moss' },
            { d:'8 พ.ค.',  what:'ส่งใบเสนอราคา RFQ-2026-014', tone:'teal' },
          ].map((a, i) => (
            <div key={i} style={{ display:'flex', gap:10, padding:'10px 0', borderBottom: i < 3 ? '1px solid var(--rule)' : 'none' }}>
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
  const products = [
    { code:'MAT-STR-00001', name:'ปูนซีเมนต์ ตราช้าง',     spec:'ปอร์ตแลนด์ ประเภท 1',         unit:'ถุง 50 กก.', lastP:166, n:8,  lastDate:'15 พ.ค.' },
    { code:'MAT-STR-00003', name:'เหล็กเส้น DB12',          spec:'มอก. · ⌀12mm × 10m',          unit:'เส้น',       lastP:248, n:18, lastDate:'15 พ.ค.' },
    { code:'MAT-STR-00004', name:'เหล็กเส้น DB16',          spec:'มอก. · ⌀16mm × 10m',          unit:'เส้น',       lastP:318, n:14, lastDate:'14 พ.ค.' },
    { code:'MAT-STR-00005', name:'เหล็กเส้น DB20',          spec:'มอก. · ⌀20mm × 10m',          unit:'เส้น',       lastP:506, n:11, lastDate:'10 พ.ค.' },
    { code:'MAT-STR-00006', name:'เหล็กเส้น DB25',          spec:'มอก. · ⌀25mm × 10m',          unit:'เส้น',       lastP:795, n:6,  lastDate:'4 พ.ค.' },
    { code:'MAT-STR-00007', name:'ลวดผูกเหล็ก เบอร์ 22',    spec:'ลวดอบดำ',                     unit:'กก.',        lastP:65,  n:8,  lastDate:'2 พ.ค.' },
    { code:'MAT-STR-00008', name:'เหล็กรูปพรรณ H-Beam 200', spec:'200×200 × 12m',               unit:'เส้น',       lastP:18460,n:3,  lastDate:'18 เม.ย.' },
  ];
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
          {products.map(p => (
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
  const quotes = [
    { date:'2026-05-15', rfq:'RFQ-2026-019', item:'เหล็กเส้น DB12', qty:2000, unit:'เส้น', price:248, result:'pending' },
    { date:'2026-05-14', rfq:'RFQ-2026-018', item:'เหล็กเส้น DB16', qty:1500, unit:'เส้น', price:318, result:'pending' },
    { date:'2026-05-10', rfq:'RFQ-2026-017', item:'เหล็กเส้น DB20', qty:400,  unit:'เส้น', price:506, result:'won' },
    { date:'2026-05-04', rfq:'RFQ-2026-013', item:'เหล็กเส้น DB25', qty:200,  unit:'เส้น', price:795, result:'lost' },
    { date:'2026-04-28', rfq:'RFQ-2026-008', item:'เหล็กเส้น DB12', qty:1800, unit:'เส้น', price:232, result:'won' },
    { date:'2026-04-22', rfq:'RFQ-2026-005', item:'เหล็กเส้น DB16', qty:1200, unit:'เส้น', price:302, result:'won' },
    { date:'2026-04-15', rfq:'RFQ-2026-002', item:'เหล็กรูปพรรณ H-Beam', qty:14, unit:'เส้น', price:18420, result:'lost' },
    { date:'2026-04-08', rfq:'RFQ-2026-001', item:'เหล็กเส้น DB12', qty:2400, unit:'เส้น', price:225, result:'won' },
  ];
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
          {quotes.map(q => {
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
  const rfqs = [
    { no:'RFQ-2026-019', date:'15 พ.ค.', items:3,  total:610000,  status:'wait' },
    { no:'RFQ-2026-018', date:'14 พ.ค.', items:2,  total:944000,  status:'wait' },
    { no:'RFQ-2026-017', date:'10 พ.ค.', items:1,  total:202400,  status:'received' },
    { no:'RFQ-2026-013', date:'4 พ.ค.',  items:1,  total:159000,  status:'received' },
    { no:'RFQ-2026-008', date:'28 เม.ย.', items:1, total:417600,  status:'received' },
  ];
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
          {rfqs.map(r => (
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

/* =================== Quote bars chart =================== */
function QuoteBarsChart() {
  const months = ['มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.'];
  const won  = [2, 1, 2, 1, 2, 1, 3, 1, 2, 2, 2, 1];
  const lost = [1, 2, 1, 1, 0, 2, 1, 2, 1, 1, 0, 0];
  const sent = [3, 5, 4, 4, 3, 4, 5, 4, 4, 4, 3, 2]; // total

  const W = 760, H = 200, PT = 24, PB = 28, PL = 36, PR = 16;
  const max = Math.max(...sent) + 1;
  const bw = (W - PL - PR) / months.length;
  const y = v => PT + (1 - v / max) * (H - PT - PB);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block' }}>
      {/* gridlines */}
      {[0, Math.floor(max/2), max].map((t,i) => (
        <g key={i}>
          <line x1={PL} x2={W-PR} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth="1" />
          <text x={PL-6} y={y(t)+3.5} textAnchor="end" fontSize="9.5" fill="var(--ink-3)" fontFamily="var(--font-mono)">{t}</text>
        </g>
      ))}
      {months.map((m, i) => {
        const x0 = PL + i * bw + 4;
        const innerW = bw - 8;
        const wonH  = (H - PT - PB) * (won[i]  / max);
        const lostH = (H - PT - PB) * (lost[i] / max);
        return (
          <g key={i}>
            {/* lost bar (stacked above won) */}
            <rect x={x0} y={y(won[i] + lost[i])} width={innerW} height={lostH}
                  fill="var(--clay-soft)" />
            {/* won bar */}
            <rect x={x0} y={y(won[i])} width={innerW} height={wonH}
                  fill="var(--teal)" />
            <text x={x0 + innerW/2} y={H-10} textAnchor="middle" fontSize="10" fill="var(--ink-3)">{m}</text>
          </g>
        );
      })}
      {/* legend */}
      <g transform={`translate(${PL}, ${PT-12})`}>
        <rect x="0" y="-7" width="9" height="9" fill="var(--teal)" />
        <text x="14" y="1" fontSize="10" fill="var(--ink-3)">ชนะ</text>
        <rect x="56" y="-7" width="9" height="9" fill="var(--clay-soft)" />
        <text x="70" y="1" fontSize="10" fill="var(--ink-3)">แพ้</text>
      </g>
    </svg>
  );
}
