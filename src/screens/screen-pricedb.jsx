'use client';
import React, { useState, useMemo } from 'react';
import { Icons, Chip, Stat, Spark, Delta, Av, money } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsSearchBox } from '../lib/settings-shared';

/*
  Price DB — list + detail.

  Concept: keep prices ever quoted by Suppliers.
  Two entry methods:
    1. Manual — fields: Supplier, Category, Item, Description?, unit price, unit, quote date, age (days)
    2. Pull from RFQ — pick received RFQs and import their line items
  Prices stored are NET — exclude VAT and Overhead.
*/

/* =================== Synthetic RFQ pool for "pull from RFQ" =================== */
const RECEIVED_RFQS_FOR_PRICEDB = [
  {
    no:'RFQ-2025-019', supplier:'เอเชียสตีล',         supKind:'aw',     quoteDate:'2025-05-16', category:'งานโครงสร้าง', project:'IE-LV04',
    items:[
      { code:'MAT-STR-00003', name:'เหล็กเส้น DB12',  unit:'เส้น', desc:'มอก. · ⌀12mm × 10m', price:245 },
      { code:'MAT-STR-00004', name:'เหล็กเส้น DB16',  unit:'เส้น', desc:'มอก. · ⌀16mm × 10m', price:325 },
      { code:'MAT-STR-00005', name:'เหล็กเส้น DB20',  unit:'เส้น', desc:'มอก. · ⌀20mm × 10m', price:512 },
    ],
  },
  {
    no:'RFQ-2025-018', supplier:'รุ่งเรืองสตีล',       supKind:'rr',     quoteDate:'2025-05-14', category:'งานโครงสร้าง', project:'IE-LV04',
    items:[
      { code:'MAT-STR-00003', name:'เหล็กเส้น DB12',  unit:'เส้น', desc:'มอก. · ⌀12mm × 10m', price:248 },
      { code:'MAT-STR-00004', name:'เหล็กเส้น DB16',  unit:'เส้น', desc:'มอก. · ⌀16mm × 10m', price:318 },
    ],
  },
  {
    no:'RFQ-2025-017', supplier:'SCG Distribution',   supKind:'sc',     quoteDate:'2025-05-15', category:'งานโครงสร้าง', project:'IE-LV04',
    items:[
      { code:'MAT-STR-00001', name:'ปูนซีเมนต์ ตราช้าง', unit:'ถุง 50 กก.', desc:'ปอร์ตแลนด์ ประเภท 1', price:166 },
      { code:'MAT-STR-00003', name:'เหล็กเส้น DB12',     unit:'เส้น',       desc:'มอก. · ⌀12mm × 10m',  price:252 },
    ],
  },
  {
    no:'RFQ-2025-016', supplier:'CPAC Roof',          supKind:'sc',     quoteDate:'2025-05-10', category:'งานหลังคา', project:'IE-VL02',
    items:[
      { code:'MAT-ROF-00001', name:'กระเบื้องหลังคา CPAC โมเนียร์', unit:'แผ่น', desc:'33×42 cm · สีเทา', price:42 },
    ],
  },
];

/* =================== List =================== */

export function ScreenPriceDB({ go }) {
  const [cat, setCat] = useState('ทั้งหมด');
  const [sourceFilter, setSourceFilter] = useState('ทั้งหมด'); // ทั้งหมด | Manual | RFQ
  const [q, setQ] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [rfqPullOpen, setRfqPullOpen] = useState(false);

  const cats = ['ทั้งหมด','งานโครงสร้าง','งานก่ออิฐ-ฉาบปูน','งานหลังคา','งานพื้น-ผนัง','งานสุขภัณฑ์','งานสี','งานระบบไฟฟ้า'];

  const filtered = pdbRows.filter(r => {
    if (cat !== 'ทั้งหมด' && r.cat !== cat) return false;
    if (sourceFilter !== 'ทั้งหมด' && r.source !== sourceFilter) return false;
    if (q) {
      const v = q.toLowerCase();
      if (!(r.name.includes(q) || r.code.toLowerCase().includes(v) || (r.sup||'').includes(q))) return false;
    }
    return true;
  });

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Module 3 · หัวใจของระบบ</div>
          <h1 className="h-display">Price Database</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:640 }}>
            ราคาที่เคยขอจาก Supplier — เก็บไว้เป็นฐานราคาอ้างอิง
            · <strong style={{ color:'var(--ink-2)' }}>ราคาที่บันทึกเป็นราคาสุทธิ ไม่รวม VAT และ Overhead</strong>
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" onClick={() => setRfqPullOpen(true)}>{Icons.upload} ดึงจาก RFQ</button>
          <button className="btn primary" onClick={() => setManualOpen(true)}>{Icons.plus} เพิ่ม Manual</button>
          <button className="btn">{Icons.download} Export</button>
        </div>
      </div>

      {/* Top-line stats */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:0,
        borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)',
        padding:'24px 0', marginBottom:32,
      }}>
        {[
          { label:'รายการในระบบ',     value:'1,284', sub:'อัพเดทล่าสุด 17 พ.ค. 16:42' },
          { label:'Supplier ใช้งาน',    value:'142',   sub:'38 รายส่งราคา 30 วันล่าสุด' },
          { label:'เพิ่มเข้าระบบ 30 วัน', value:'218',   sub:'156 จาก RFQ · 62 Manual' },
          { label:'ขาขึ้น (YoY)',       value:'64',    sub:'รายการที่ขึ้น > 10%' },
          { label:'ค้างไม่อัพเดท',       value:'47',    sub:'รายการ > 6 เดือน' },
        ].map((s, i) => (
          <div key={i} style={{ paddingLeft: i === 0 ? 0 : 28, borderLeft: i === 0 ? 'none' : '1px solid var(--rule)' }}>
            <Stat {...s} />
          </div>
        ))}
      </div>

      {/* Category filter chips */}
      <div style={{ display:'flex', alignItems:'center', gap:24, flexWrap:'wrap', marginBottom:16 }}>
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
        <span style={{ width:1, height:20, background:'var(--rule)' }} />
        <div style={{ display:'flex', gap:4 }}>
          {[
            { v:'ทั้งหมด', label:'ทุกแหล่ง' },
            { v:'RFQ',     label:'จาก RFQ' },
            { v:'Manual',  label:'Manual' },
          ].map(o => (
            <button key={o.v} onClick={() => setSourceFilter(o.v)} className="btn sm" style={{
              background: sourceFilter === o.v ? 'var(--ink-2)' : 'transparent',
              color: sourceFilter === o.v ? 'var(--paper)' : 'var(--ink-3)',
              borderColor: sourceFilter === o.v ? 'var(--ink-2)' : 'var(--rule)',
              padding:'4px 10px', fontSize:11.5,
            }}>{o.label}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12 }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหาวัสดุ / Supplier…" />
          <span style={{ fontSize:12.5, color:'var(--ink-3)' }}>แสดง <strong style={{ color:'var(--ink)' }}>{filtered.length}</strong> รายการ</span>
        </div>
      </div>

      {/* Main table */}
      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:'5%' }}>รหัส</th>
              <th style={{ width:'22%' }}>วัสดุ / Item</th>
              <th>หมวด</th>
              <th>หน่วย</th>
              <th>Supplier · ราคาต่ำสุด</th>
              <th className="num-col">ราคาล่าสุด<br/><span style={{ fontSize:9, color:'var(--ink-4)', textTransform:'none', letterSpacing:0 }}>(net · ไม่รวม VAT/OH)</span></th>
              <th className="num-col">Δ MoM</th>
              <th className="num-col">Δ YoY</th>
              <th>เทรนด์ 6 ด.</th>
              <th>อัพเดท · อายุ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} onClick={() => go('pricedb-detail')} style={{ cursor:'pointer' }} className={r.flag ? `row-flag-${r.flag}` : ''}>
                <td style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink-4)' }}>{r.code}</td>
                <td>
                  <div style={{ fontWeight:500, display:'inline-flex', alignItems:'center', gap:8 }}>
                    {r.name}
                    <span style={{
                      display:'inline-block', padding:'1px 7px', borderRadius:3,
                      background: r.source === 'RFQ' ? '#DCE6E1' : '#F0E4C5',
                      color: r.source === 'RFQ' ? 'var(--teal-ink)' : '#6B5121',
                      fontSize:9.5, fontWeight:600, letterSpacing:0.04,
                    }}>{r.source === 'RFQ' ? `จาก ${r.sourceRef}` : 'Manual'}</span>
                  </div>
                  <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:2 }}>{r.spec}</div>
                </td>
                <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{r.cat}</td>
                <td style={{ fontSize:12.5, color:'var(--ink-3)' }}>{r.unit}</td>
                <td>
                  <span style={{ display:'inline-flex', gap:8, alignItems:'center' }}>
                    <Av initials={r.sup.slice(0,2)} kind={r.supkind} />
                    <span style={{ fontSize:12.5 }}>{r.sup}</span>
                  </span>
                </td>
                <td className="num-col num" style={{ fontWeight:500 }}>{money(r.price)}</td>
                <td className="num-col"><Delta pct={r.mom} dir={r.momDir} /></td>
                <td className="num-col"><Delta pct={r.yoy} dir={r.yoyDir} /></td>
                <td><Spark data={r.spark} w={100} h={26}
                       color={r.momDir==='down'?'var(--moss)':r.momDir==='up'?'var(--clay)':'var(--ink-4)'} /></td>
                <td>
                  <div style={{ fontSize:12, color:'var(--ink-2)' }}>{r.date}</div>
                  <div style={{ fontSize:11, color: r.age > 180 ? 'var(--clay)' : r.age > 60 ? 'var(--ochre)' : 'var(--ink-3)', marginTop:2 }}>
                    {r.age} วันที่แล้ว
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between',
                      borderTop:'1px solid var(--rule)', fontSize:12, color:'var(--ink-3)' }}>
          <span>แสดง 1–{filtered.length} จาก 248 รายการ</span>
          <div style={{ display:'flex', gap:6 }}>
            <button className="btn sm" disabled>ก่อนหน้า</button>
            <button className="btn sm">ถัดไป {Icons.chevronR}</button>
          </div>
        </div>
      </div>

      {manualOpen  && <ManualPriceModal  onClose={() => setManualOpen(false)} />}
      {rfqPullOpen && <PullFromRFQModal onClose={() => setRfqPullOpen(false)} />}
    </div>
  );
}

const pdbRows = [
  { code:'STR-STL-12', name:'เหล็กเส้น DB12',                spec:'มอก. 24-2559 · ข้ออ้อย ⌀12mm', cat:'งานโครงสร้าง', unit:'เส้น',
    sup:'เอเชียสตีล', supkind:'aw', price:245, mom:'+18.4%', momDir:'up',  yoy:'+22.1%', yoyDir:'up',
    spark:[140,148,151,150,165,172,180,195,210,228,240,245], date:'17 พ.ค.', age:1, source:'RFQ', sourceRef:'RFQ-2025-019', flag:'err' },
  { code:'STR-CEM-01', name:'ปูนซีเมนต์ ตราช้าง',           spec:'ปอร์ตแลนด์ ประเภท 1', cat:'งานโครงสร้าง', unit:'ถุง 50 กก.',
    sup:'SCG Distribution', supkind:'sc', price:165, mom:'+1.9%', momDir:'up', yoy:'+3.2%', yoyDir:'up',
    spark:[155,158,159,160,160,161,162,162,163,164,164,165], date:'15 พ.ค.', age:3, source:'RFQ', sourceRef:'RFQ-2025-017' },
  { code:'STR-STL-16', name:'เหล็กเส้น DB16',                spec:'มอก. 24-2559 · ข้ออ้อย ⌀16mm', cat:'งานโครงสร้าง', unit:'เส้น',
    sup:'รุ่งเรืองสตีล', supkind:'rr', price:325, mom:'+12.0%', momDir:'up', yoy:'+18.6%', yoyDir:'up',
    spark:[245,250,253,260,270,280,290,300,308,316,320,325], date:'15 พ.ค.', age:3, source:'RFQ', sourceRef:'RFQ-2025-018', flag:'warn' },
  { code:'TIL-CER-66', name:'กระเบื้องเซรามิค 60×60 cm',     spec:'Grade A · ผิวด้าน', cat:'งานพื้น-ผนัง', unit:'ตร.ม.',
    sup:'ไทยเซรามิค', supkind:'default', price:285, mom:'−4.2%', momDir:'down', yoy:'−1.1%', yoyDir:'down',
    spark:[298,302,300,298,295,294,292,290,290,288,287,285], date:'14 พ.ค.', age:4, source:'Manual' },
  { code:'BRK-QCN-75', name:'อิฐมวลเบา Q-CON',              spec:'7.5×20×60 cm · มอก. 1505', cat:'งานก่ออิฐ-ฉาบปูน', unit:'ก้อน',
    sup:'Q-CON Direct', supkind:'default', price:28, mom:'0.0%', momDir:'flat', yoy:'+5.2%', yoyDir:'up',
    spark:[26.6,26.8,27,27.2,27.5,27.8,28,28,28,28,28,28], date:'12 พ.ค.', age:6, source:'Manual' },
  { code:'PNT-TOA-EX', name:'สีน้ำพลาสติก TOA SuperShield',  spec:'ภายนอก · กึ่งเงา', cat:'งานสี', unit:'แกลลอน',
    sup:'TOA Distribution', supkind:'default', price:1180, mom:'+2.6%', momDir:'up', yoy:'+8.7%', yoyDir:'up',
    spark:[1085,1100,1110,1115,1130,1140,1145,1150,1155,1165,1170,1180], date:'12 พ.ค.', age:6, source:'RFQ', sourceRef:'RFQ-2025-020' },
  { code:'ROF-CPC-MN', name:'กระเบื้องหลังคา CPAC โมเนียร์',   spec:'33×42 cm · สีเทา', cat:'งานหลังคา', unit:'แผ่น',
    sup:'CPAC Roof',  supkind:'sc', price:42, mom:'+0.5%', momDir:'up', yoy:'+2.1%', yoyDir:'up',
    spark:[40.5,40.8,41,41.2,41.5,41.6,41.8,41.8,41.9,42,42,42], date:'9 ธ.ค. 67', age:218, source:'Manual' },
  { code:'SAN-COT-01', name:'โถสุขภัณฑ์ COTTO Simply',       spec:'C13017 · 1 ชิ้น 4.5L', cat:'งานสุขภัณฑ์', unit:'ชุด',
    sup:'COTTO Wholesale', supkind:'default', price:3850, mom:'+0.0%', momDir:'flat', yoy:'+1.6%', yoyDir:'up',
    spark:[3790,3810,3820,3830,3840,3845,3850,3850,3850,3850,3850,3850], date:'8 พ.ค.', age:10, source:'RFQ', sourceRef:'RFQ-2025-022' },
  { code:'ELE-THW-25', name:'สายไฟ THW 2.5 sq.mm.',         spec:'BCC ทองแดง · ม้วน 100 ม.', cat:'งานระบบไฟฟ้า', unit:'ม้วน',
    sup:'BCC Electric', supkind:'default', price:1620, mom:'+3.8%', momDir:'up', yoy:'+11.2%', yoyDir:'up',
    spark:[1440,1450,1470,1490,1510,1530,1545,1560,1570,1585,1605,1620], date:'7 พ.ค.', age:11, source:'RFQ', sourceRef:'RFQ-2025-015' },
  { code:'BRK-QCN-10', name:'อิฐมวลเบา Q-CON 10 cm',         spec:'10×20×60 cm · มอก. 1505', cat:'งานก่ออิฐ-ฉาบปูน', unit:'ก้อน',
    sup:'Q-CON Direct', supkind:'default', price:35, mom:'+1.4%', momDir:'up', yoy:'+4.8%', yoyDir:'up',
    spark:[33,33.2,33.5,34,34.2,34.5,34.5,34.8,34.8,35,35,35], date:'24 ม.ค.', age:114, source:'Manual' },
];

/* =================== Manual entry modal =================== */
function ManualPriceModal({ onClose }) {
  const [form, setForm] = useState({
    supplier:'', category:'งานโครงสร้าง', itemCode:'', itemName:'',
    description:'', price:'', unit:'', quoteDate:'', ageHint:'',
  });
  const set = (k,v) => setForm({ ...form, [k]:v });

  // Compute age if quoteDate provided
  const computedAge = useMemo(() => {
    if (!form.quoteDate) return null;
    const today = new Date('2025-05-17');
    const d = new Date(form.quoteDate);
    if (isNaN(d)) return null;
    return Math.max(0, Math.round((today - d) / 86400000));
  }, [form.quoteDate]);

  const cats = ['งานโครงสร้าง','งานก่ออิฐ-ฉาบปูน','งานหลังคา','งานพื้น-ผนัง','งานสุขภัณฑ์','งานสี','งานระบบไฟฟ้า'];
  const units = ['ถุง 50 กก.','เส้น','ก้อน','แผ่น','ตร.ม.','ลบ.ม.','ม.','กก.','ตัน','ลิตร','แกลลอน','ม้วน','ชุด','ชิ้น','ตัว'];
  const suppliers = ['เอเชียสตีล','รุ่งเรืองสตีล','SCG Distribution','TOA Distribution','COTTO Wholesale','CPAC Roof','Q-CON Direct','ไทยเซรามิค','BCC Electric'];

  return (
    <SettingsModal eyebrow="บันทึกราคาเข้าระบบ" title="เพิ่มราคา · Manual" onClose={onClose} width={680}>
      <div style={{
        padding:'12px 14px', background:'var(--surface-2)',
        border:'1px solid var(--rule)', borderRadius:6, marginBottom:20,
        display:'flex', gap:10, alignItems:'flex-start',
      }}>
        <span style={{ color:'var(--ink-3)' }}>{Icons.alert}</span>
        <div style={{ fontSize:11.5, color:'var(--ink-2)', lineHeight:1.6 }}>
          กรอก <strong>ราคาสุทธิ (net)</strong> เท่านั้น — <span style={{ color:'var(--ink-3)' }}>ไม่รวม VAT และ Overhead</span> ·
          ระบบจะคำนวณราคา Final ตอนใช้อ้างอิงในเอกสารอื่น
        </div>
      </div>

      <div className="eyebrow" style={{ marginBottom:10 }}>ข้อมูล Supplier และวัสดุ</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
        <SettingsField label="Supplier" required>
          <select value={form.supplier} onChange={e => set('supplier', e.target.value)} style={settingsInputStyle}>
            <option value="">— เลือก —</option>
            {suppliers.map(s => <option key={s}>{s}</option>)}
          </select>
        </SettingsField>
        <SettingsField label="หมวด (Category)" required>
          <select value={form.category} onChange={e => set('category', e.target.value)} style={settingsInputStyle}>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
        </SettingsField>
        <SettingsField label="รหัส Item" hint="ดึงจาก Material/SubContract master">
          <input value={form.itemCode} onChange={e => set('itemCode', e.target.value)}
            placeholder="เช่น MAT-STR-00003"
            style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
        </SettingsField>
        <SettingsField label="ชื่อ Item" required>
          <input value={form.itemName} onChange={e => set('itemName', e.target.value)}
            placeholder="เช่น เหล็กเส้น DB12" style={settingsInputStyle} />
        </SettingsField>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="Description (ถ้ามี)" hint="รายละเอียดเพิ่มเติม เช่น Spec, มอก., ขนาด">
            <input value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="เช่น มอก. 24-2559 · ข้ออ้อย ⌀12mm × 10m" style={settingsInputStyle} />
          </SettingsField>
        </div>
      </div>

      <div className="eyebrow" style={{ marginBottom:10 }}>ราคาและช่วงเวลา</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <SettingsField label="ราคาต่อหน่วย (บาท · net)" required hint="ไม่รวม VAT และ Overhead">
          <input type="number" value={form.price} onChange={e => set('price', e.target.value)}
            placeholder="0" className="num"
            style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)', textAlign:'right' }} />
        </SettingsField>
        <SettingsField label="หน่วย" required>
          <select value={form.unit} onChange={e => set('unit', e.target.value)} style={settingsInputStyle}>
            <option value="">— เลือก —</option>
            {units.map(u => <option key={u}>{u}</option>)}
          </select>
        </SettingsField>
        <SettingsField label="วันที่เสนอราคา" required>
          <input type="date" value={form.quoteDate} onChange={e => set('quoteDate', e.target.value)}
            style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="ราคานี้ขอมาแล้วกี่วัน" hint={computedAge != null ? `auto-คำนวณจากวันที่เสนอราคา = ${computedAge} วัน` : 'หากไม่ระบุวันที่ ระบุได้เอง'}>
          <input
            type="number"
            value={computedAge != null ? computedAge : form.ageHint}
            onChange={e => set('ageHint', e.target.value)}
            placeholder="0"
            readOnly={computedAge != null}
            style={{
              ...settingsInputStyle, fontFamily:'var(--font-mono)', textAlign:'right',
              background: computedAge != null ? 'var(--surface-2)' : 'var(--paper)',
              color: computedAge != null ? 'var(--ink-3)' : 'var(--ink)',
            }} />
        </SettingsField>
      </div>
    </SettingsModal>
  );
}

/* =================== Pull from RFQ modal =================== */
function PullFromRFQModal({ onClose }) {
  const [picked, setPicked] = useState(new Set()); // composite keys "rfqNo::itemCode"
  const [q, setQ] = useState('');

  const filtered = RECEIVED_RFQS_FOR_PRICEDB.filter(r => {
    if (!q) return true;
    const v = q.toLowerCase();
    return r.no.toLowerCase().includes(v) || r.supplier.includes(q) || r.category.includes(q);
  });

  const toggle = (rfqNo, itemCode) => {
    const k = `${rfqNo}::${itemCode}`;
    const next = new Set(picked);
    next.has(k) ? next.delete(k) : next.add(k);
    setPicked(next);
  };

  const toggleAll = (rfqNo, items) => {
    const keys = items.map(it => `${rfqNo}::${it.code}`);
    const next = new Set(picked);
    const allOn = keys.every(k => next.has(k));
    if (allOn) keys.forEach(k => next.delete(k));
    else keys.forEach(k => next.add(k));
    setPicked(next);
  };

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(20,18,14,0.32)',
      display:'grid', placeItems:'center', zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} className="card"
           style={{ width:780, padding:0, boxShadow:'var(--sh-pop)', maxHeight:'88vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom:4 }}>ดึงราคาจาก RFQ ที่ได้รับใบเสนอราคาแล้ว</div>
            <h3 className="h-section">เลือก RFQ และรายการที่ต้องการบันทึก</h3>
          </div>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหา RFQ / Supplier…" />
        </div>

        <div style={{
          padding:'12px 24px', background:'var(--surface-2)',
          borderBottom:'1px solid var(--rule)',
          display:'flex', gap:10, alignItems:'flex-start',
        }}>
          <span style={{ color:'var(--ink-3)' }}>{Icons.alert}</span>
          <div style={{ fontSize:11.5, color:'var(--ink-2)', lineHeight:1.6 }}>
            ระบบจะบันทึก <strong>ราคาที่ Supplier เสนอ</strong> เป็นราคา net (ก่อน VAT, ก่อน Overhead) ตามที่กรอกในใบเสนอราคา
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'8px 8px' }}>
          {filtered.map(r => {
            const allKeys = r.items.map(it => `${r.no}::${it.code}`);
            const allOn = allKeys.every(k => picked.has(k));
            const someOn = !allOn && allKeys.some(k => picked.has(k));
            return (
              <div key={r.no} style={{
                margin:'8px 16px', border:'1px solid var(--rule)', borderRadius:6, overflow:'hidden',
              }}>
                <div style={{
                  padding:'12px 16px', background:'var(--surface-2)',
                  borderBottom:'1px solid var(--rule)',
                  display:'flex', alignItems:'center', gap:12,
                }}>
                  <input type="checkbox"
                    checked={allOn}
                    ref={el => { if (el) el.indeterminate = someOn; }}
                    onChange={() => toggleAll(r.no, r.items)}
                    style={{ width:14, height:14, accentColor:'var(--teal)', cursor:'pointer' }} />
                  <Av initials={r.supplier.slice(0,2)} kind={r.supKind} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span className="font-mono" style={{ fontSize:11.5, color:'var(--ink-2)', fontWeight:500 }}>{r.no}</span>
                      <span style={{ fontSize:13, fontWeight:500 }}>{r.supplier}</span>
                    </div>
                    <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:3 }}>
                      {r.category} · {r.project} · เสนอราคา {r.quoteDate} · {r.items.length} รายการ
                    </div>
                  </div>
                </div>
                <table className="tbl" style={{ background:'transparent' }}>
                  <thead>
                    <tr>
                      <th style={{ width:36 }}></th>
                      <th style={{ width:'16%' }}>รหัส</th>
                      <th>รายการ</th>
                      <th>หน่วย</th>
                      <th className="num-col">ราคา/หน่วย (net)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map(it => {
                      const k = `${r.no}::${it.code}`;
                      const on = picked.has(k);
                      return (
                        <tr key={it.code} style={{ background: on ? 'var(--teal-soft)' : 'transparent' }}>
                          <td>
                            <input type="checkbox" checked={on} onChange={() => toggle(r.no, it.code)}
                              style={{ width:14, height:14, accentColor:'var(--teal)', cursor:'pointer' }} />
                          </td>
                          <td className="font-mono" style={{ fontSize:11, color:'var(--ink-2)' }}>{it.code}</td>
                          <td>
                            <div style={{ fontSize:12.5, fontWeight:500 }}>{it.name}</div>
                            <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>{it.desc}</div>
                          </td>
                          <td style={{ fontSize:12.5, color:'var(--ink-3)' }}>{it.unit}</td>
                          <td className="num-col num" style={{ fontWeight:500 }}>{money(it.price)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', background:'var(--surface-2)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:12.5, color:'var(--ink-3)' }}>
            เลือกแล้ว <strong style={{ color:'var(--ink)' }}>{picked.size}</strong> รายการ
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
            <button className="btn primary" disabled={picked.size === 0} onClick={onClose}
              style={{ opacity: picked.size === 0 ? 0.5 : 1 }}>
              {Icons.check} บันทึก {picked.size} รายการ เข้า Price DB
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================== Detail =================== */

export function ScreenPriceDBDetail({ go }) {
  const tabs = ['ภาพรวม','ประวัติราคา','Supplier เปรียบเทียบ','RFQ ที่เกี่ยวข้อง'];
  const [tab, setTab] = useState('ภาพรวม');

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => go('pricedb')} style={{ marginBottom:20, marginLeft:-8 }}>
        {Icons.back} กลับไป Price Database
      </button>

      <div className="page-head" style={{ alignItems:'flex-start' }}>
        <div className="page-title">
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
            <span className="font-mono" style={{ fontSize:12, color:'var(--ink-3)' }}>MAT-STR-00003</span>
            <Chip kind="risk-high">ราคาผิดปกติ</Chip>
            <Chip kind="ai">AI MONITORED</Chip>
            <span style={{ fontSize:11, padding:'1px 8px', borderRadius:3, background:'var(--paper-2)', color:'var(--ink-3)' }}>
              ราคาทั้งหมดเป็น net · ไม่รวม VAT/Overhead
            </span>
          </div>
          <h1 className="h-display">เหล็กเส้น DB12</h1>
          <div style={{ display:'flex', gap:24, marginTop:12, fontSize:13, color:'var(--ink-3)' }}>
            <span>หมวด: <strong style={{ color:'var(--ink-2)' }}>งานโครงสร้าง</strong></span>
            <span>หน่วย: <strong style={{ color:'var(--ink-2)' }}>เส้น</strong></span>
            <span>Spec: <strong style={{ color:'var(--ink-2)' }}>มอก. 24-2559 · ข้ออ้อย ⌀12mm × 10m</strong></span>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn">{Icons.edit} แก้ไข Master</button>
          <button className="btn">{Icons.plus} เพิ่มราคา</button>
          <button className="btn primary" onClick={() => go('rfq-create')}>สร้าง RFQ รายการนี้</button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom:32 }}>
        {tabs.map(t => (
          <div key={t} className={"tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>{t}</div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:32 }}>
        <div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:48, marginBottom:8 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom:8 }}>
                ราคาล่าสุด · <span style={{ color:'var(--ink-2)' }}>17 พ.ค. 2568 (1 วันที่แล้ว)</span>
              </div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:72, lineHeight:1, letterSpacing:'-0.02em' }}>
                ฿245<span style={{ fontFamily:'var(--font-sans)', fontSize:18, color:'var(--ink-3)', marginLeft:8 }}>/ เส้น</span>
              </div>
              <div style={{ marginTop:12, display:'flex', gap:16, alignItems:'center' }}>
                <Delta pct="+18.4% MoM" dir="up" />
                <Delta pct="+22.1% YoY" dir="up" />
                <span style={{ fontSize:12, color:'var(--ink-3)' }}>เทียบ ฿207 (เม.ย.) · ฿201 (พ.ค. 67)</span>
              </div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:0, borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)', padding:'14px 0' }}>
                <Stat label="ต่ำสุด 90 วัน" value="฿207" sub="11 เม.ย." />
                <Stat label="สูงสุด 90 วัน" value="฿248" sub="14 พ.ค." />
                <Stat label="เฉลี่ย 90 วัน" value="฿224" sub="จาก 12 บันทึก" />
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop:32, padding:0 }}>
            <div style={{ padding:'20px 24px', display:'flex', alignItems:'baseline', justifyContent:'space-between', borderBottom:'1px solid var(--rule)' }}>
              <h3 className="h-card">ประวัติราคา · 18 เดือน</h3>
              <div style={{ display:'flex', gap:4 }}>
                {['3 ด.','6 ด.','12 ด.','18 ด.','ทั้งหมด'].map((p, i) => (
                  <button key={p} className="btn sm"
                          style={{ background: i === 3 ? 'var(--ink)' : 'transparent',
                                   color: i === 3 ? 'var(--paper)' : 'var(--ink-2)',
                                   borderColor: i === 3 ? 'var(--ink)' : 'var(--rule)',
                                   padding:'4px 10px' }}>{p}</button>
                ))}
              </div>
            </div>
            <div style={{ padding:24 }}>
              <PriceChart />
              <div style={{ display:'flex', gap:20, marginTop:16, fontSize:12, color:'var(--ink-3)' }}>
                <LegendDot color="#1F4D40" label="เอเชียสตีล" />
                <LegendDot color="#B08938" label="รุ่งเรืองสตีล" />
                <LegendDot color="#5B7A3A" label="SCG Distribution" />
                <LegendDot color="#A29A88" dash label="AI Forecast" />
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop:24, padding:0 }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--rule)' }}>
              <h3 className="h-card">Supplier ที่เคยขายรายการนี้</h3>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th className="num-col">ราคาล่าสุด (net)</th>
                  <th className="num-col">ราคาเฉลี่ย 90 วัน</th>
                  <th className="num-col">จำนวนครั้งที่เสนอ</th>
                  <th>ที่มา</th>
                  <th>เครดิตเทอม</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { sup:'เอเชียสตีล',       kind:'aw', last:245, lastDate:'17 พ.ค.', avg:228, n:8, source:'RFQ',    ct:'45 วัน' },
                  { sup:'รุ่งเรืองสตีล',     kind:'rr', last:248, lastDate:'14 พ.ค.', avg:233, n:6, source:'RFQ',    ct:'30 วัน' },
                  { sup:'SCG Distribution', kind:'sc', last:252, lastDate:'10 พ.ค.', avg:241, n:4, source:'Manual', ct:'60 วัน' },
                ].map((r, i) => (
                  <tr key={i}>
                    <td>
                      <span style={{ display:'inline-flex', gap:10, alignItems:'center' }}>
                        <Av initials={r.sup.slice(0,2)} kind={r.kind} />
                        <span style={{ fontWeight:500 }}>{r.sup}</span>
                      </span>
                    </td>
                    <td className="num-col">
                      <div className="num" style={{ fontWeight:500 }}>{money(r.last)}</div>
                      <div style={{ fontSize:11, color:'var(--ink-3)' }}>{r.lastDate}</div>
                    </td>
                    <td className="num-col num">{money(r.avg)}</td>
                    <td className="num-col num" style={{ color:'var(--ink-2)' }}>{r.n}</td>
                    <td>
                      <span style={{
                        display:'inline-block', padding:'2px 8px', borderRadius:3,
                        fontSize:10.5, fontWeight:500,
                        background: r.source === 'RFQ' ? '#DCE6E1' : '#F0E4C5',
                        color: r.source === 'RFQ' ? 'var(--teal-ink)' : '#6B5121',
                      }}>{r.source}</span>
                    </td>
                    <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{r.ct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="card" style={{ background:'var(--surface-2)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <span className="eyebrow">AI Forecast</span>
              <Chip kind="ai">3 เดือนข้างหน้า</Chip>
            </div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:26, letterSpacing:'-0.01em', lineHeight:1.2 }}>
              ฿258 – ฿272
            </div>
            <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:6 }}>ความเชื่อมั่น 72% · ขาขึ้นต่อเนื่อง</div>
            <hr className="hr" style={{ margin:'16px 0' }} />
            <p style={{ fontSize:12.5, color:'var(--ink-2)', lineHeight:1.6, margin:0 }}>
              ราคาเหล็กเส้นมีแนวโน้มปรับขึ้นต่อเนื่อง จากต้นทุนวัตถุดิบและอุปสงค์ในประเทศ —
              แนะนำให้ <strong>ล็อกราคา</strong> หรือ <strong>เร่งสั่งซื้อ</strong> ก่อนสิ้นเดือน มิ.ย.
            </p>
          </div>

          <div className="card">
            <h3 className="h-card" style={{ marginBottom:12 }}>กิจกรรมล่าสุด</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {[
                { who:'นวพร', kind:'np', what:'ดึงราคา ฿245 จาก RFQ-2025-019', when:'17 พ.ค. · 14:22' },
                { who:'System', kind:'default', what:'แจ้งเตือนราคาผิดปกติ (+18.4%)', when:'17 พ.ค. · 14:22' },
                { who:'นวพร', kind:'np', what:'บันทึกราคา ฿207 (Manual)', when:'11 เม.ย. · 10:08' },
                { who:'ภัทร', kind:'default', what:'อัพเดท Spec ใน Master', when:'2 เม.ย. · 16:55' },
              ].map((a, i) => (
                <div key={i} style={{ display:'flex', gap:10, fontSize:12.5 }}>
                  <Av initials={a.who === 'System' ? 'IE' : a.who.slice(0,1)} kind={a.kind} />
                  <div style={{ flex:1 }}>
                    <div style={{ color:'var(--ink-2)' }}><strong style={{ color:'var(--ink)' }}>{a.who}</strong> {a.what}</div>
                    <div style={{ color:'var(--ink-4)', fontSize:11, marginTop:2 }}>{a.when}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label, dash }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
      <svg width="20" height="6">
        <line x1="0" y1="3" x2="20" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dash ? "3 3" : ""} />
      </svg>
      {label}
    </span>
  );
}

function PriceChart() {
  const months = ['ธ.ค.66','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.67','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.68'];
  const asia = [195,197,199,202,201,201,205,210,215,212,208,205,207,212,218,224,235,245];
  const rung = [200,202,205,208,212,210,215,218,222,218,212,210,212,218,224,232,240,248];
  const scg  = [210,210,212,215,218,216,220,225,230,225,220,218,222,228,234,240,246,252];
  const forecastAsia = [245, 256, 264, 270];

  const W = 760, H = 240, PT = 30, PB = 30, PL = 44, PR = 16;
  const all = [...asia, ...rung, ...scg, ...forecastAsia];
  const ymin = Math.floor(Math.min(...all) / 10) * 10 - 5;
  const ymax = Math.ceil(Math.max(...all) / 10) * 10 + 5;

  const x = i => PL + (i / (months.length + 2)) * (W - PL - PR);
  const y = v => PT + (1 - (v - ymin) / (ymax - ymin)) * (H - PT - PB);

  const path = (data, startIdx = 0) =>
    data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i + startIdx).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  const ticks = [];
  for (let v = Math.ceil(ymin / 20) * 20; v <= ymax; v += 20) ticks.push(v);

  const forecastUpper = [245, 262, 272, 280];
  const forecastLower = [245, 250, 256, 260];
  const bandPath =
    forecastUpper.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i + asia.length - 1).toFixed(1)} ${y(v).toFixed(1)}`).join(' ') +
    ' ' +
    forecastLower.slice().reverse().map((v, i) => `L ${x(forecastLower.length - 1 - i + asia.length - 1).toFixed(1)} ${y(v).toFixed(1)}`).join(' ') +
    ' Z';

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth="1" />
          <text x={PL - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-3)" fontFamily="var(--font-mono)">{t}</text>
        </g>
      ))}
      {months.map((m, i) => {
        if (i % 3 !== 0 && i !== months.length - 1) return null;
        return <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--ink-3)">{m}</text>;
      })}
      <line x1={x(months.length - 1)} x2={x(months.length - 1)} y1={PT} y2={H - PB}
            stroke="var(--ink-4)" strokeDasharray="3 3" strokeWidth="1" />
      <text x={x(months.length - 1) + 6} y={PT + 12} fontSize="10" fill="var(--ink-3)">วันนี้</text>
      <path d={bandPath} fill="var(--teal)" opacity="0.08" />
      <path d={path(forecastAsia, asia.length - 1)} fill="none" stroke="#A29A88" strokeWidth="1.6" strokeDasharray="4 4" />
      <path d={path(scg)}  fill="none" stroke="#5B7A3A" strokeWidth="1.8" />
      <path d={path(rung)} fill="none" stroke="#B08938" strokeWidth="1.8" />
      <path d={path(asia)} fill="none" stroke="#1F4D40" strokeWidth="2.2" />
      <circle cx={x(asia.length - 1)} cy={y(asia[asia.length - 1])} r="3.5" fill="#1F4D40" />
    </svg>
  );
}
