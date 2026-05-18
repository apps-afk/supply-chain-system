'use client';
import React, { useState, useMemo } from 'react';
import { Icons, Av, money } from '../lib/shell';
import {
  NEXT_CMP_NO,
  SectionCard,
  ComparePreviewTable,
  AISuggestionPanel,
  CreateSummary,
  GeneratedCompare,
} from './screen-compare-create-pricedb';

/*
  Compare Create — Mode B: From existing RFQs
  Flow: Pick ≥2 received RFQs (same category) → merge items → live compare with terms
*/

// Synthetic RFQ data — only "received" RFQs are eligible
const ELIGIBLE_RFQS = [
  {
    no:'RFQ-2025-020', supplierId:'SUP-00004', supName:'TOA Distribution',     supKind:'default',
    category:'งานสี',           project:'IE-LV01', received:'15 พ.ค. 68', credit:'30 วัน',
    items:[
      { code:'MAT-PNT-00001', name:'สีน้ำพลาสติก TOA SuperShield', spec:'ภายนอก · กึ่งเงา', unit:'แกลลอน', qty:120, price:1180 },
      { code:'MAT-PNT-00002', name:'สีน้ำพลาสติก TOA Beyond',      spec:'ภายใน · ด้าน',      unit:'แกลลอน', qty:80,  price:980 },
      { code:'MAT-PNT-00003', name:'สีรองพื้นปูน',                  spec:'อะคริลิค',          unit:'แกลลอน', qty:40,  price:520 },
    ],
  },
  {
    no:'RFQ-2025-019', supplierId:'SUP-00001', supName:'เอเชียสตีล',           supKind:'aw',
    category:'งานโครงสร้าง',    project:'IE-LV04', received:'14 พ.ค. 68', credit:'45 วัน',
    items:[
      { code:'MAT-STR-00003', name:'เหล็กเส้น DB12', spec:'มอก. · ⌀12mm × 10m', unit:'เส้น', qty:2000, price:245 },
      { code:'MAT-STR-00004', name:'เหล็กเส้น DB16', spec:'มอก. · ⌀16mm × 10m', unit:'เส้น', qty:1500, price:325 },
      { code:'MAT-STR-00005', name:'เหล็กเส้น DB20', spec:'มอก. · ⌀20mm × 10m', unit:'เส้น', qty:400,  price:512 },
    ],
  },
  {
    no:'RFQ-2025-018', supplierId:'SUP-00002', supName:'รุ่งเรืองสตีล',         supKind:'rr',
    category:'งานโครงสร้าง',    project:'IE-LV04', received:'14 พ.ค. 68', credit:'30 วัน',
    items:[
      { code:'MAT-STR-00003', name:'เหล็กเส้น DB12', spec:'มอก. · ⌀12mm × 10m', unit:'เส้น', qty:2000, price:248 },
      { code:'MAT-STR-00004', name:'เหล็กเส้น DB16', spec:'มอก. · ⌀16mm × 10m', unit:'เส้น', qty:1500, price:318 },
      { code:'MAT-STR-00005', name:'เหล็กเส้น DB20', spec:'มอก. · ⌀20mm × 10m', unit:'เส้น', qty:400,  price:506 },
    ],
  },
  {
    no:'RFQ-2025-017', supplierId:'SUP-00003', supName:'SCG Distribution',     supKind:'sc',
    category:'งานโครงสร้าง',    project:'IE-LV04', received:'15 พ.ค. 68', credit:'60 วัน',
    items:[
      { code:'MAT-STR-00003', name:'เหล็กเส้น DB12', spec:'มอก. · ⌀12mm × 10m', unit:'เส้น', qty:2000, price:252 },
      { code:'MAT-STR-00004', name:'เหล็กเส้น DB16', spec:'มอก. · ⌀16mm × 10m', unit:'เส้น', qty:1500, price:330 },
      { code:'MAT-STR-00005', name:'เหล็กเส้น DB20', spec:'มอก. · ⌀20mm × 10m', unit:'เส้น', qty:400,  price:520 },
    ],
  },
  {
    no:'RFQ-2025-016', supplierId:'SUP-00006', supName:'CPAC Roof',             supKind:'sc',
    category:'งานหลังคา',       project:'IE-VL02', received:'10 พ.ค. 68', credit:'45 วัน',
    items:[
      { code:'MAT-ROF-00001', name:'กระเบื้องหลังคา CPAC โมเนียร์', spec:'33×42 cm · สีเทา', unit:'แผ่น', qty:1800, price:42 },
      { code:'MAT-ROF-00002', name:'กระเบื้องหลังคา CPAC ExcellaPro', spec:'33×42 cm · สีแดง', unit:'แผ่น', qty:600, price:56 },
    ],
  },
];

export function ScreenCompareCreateRFQ({ go }) {
  const [picked, setPicked] = useState([]); // RFQ no's
  const [generated, setGenerated] = useState(false);

  const pickedRfqs = picked.map(no => ELIGIBLE_RFQS.find(r => r.no === no));

  // Validate: must share same category
  const categories = [...new Set(pickedRfqs.map(r => r.category))];
  const categoryConflict = categories.length > 1;

  // Merge items across RFQs by code
  const mergedItems = useMemo(() => {
    const map = new Map();
    pickedRfqs.forEach(r => {
      r.items.forEach(it => {
        if (!map.has(it.code)) {
          map.set(it.code, { code:it.code, name:it.name, spec:it.spec, unit:it.unit, qty:it.qty, prices:{} });
        }
        map.get(it.code).prices[r.supplierId] = it.price;
      });
    });
    return [...map.values()];
  }, [picked]);

  const supplierIds = pickedRfqs.map(r => r.supplierId);

  // Totals
  const totals = useMemo(() => {
    const t = {};
    pickedRfqs.forEach(r => {
      t[r.supplierId] = r.items.reduce((s, it) => s + it.price * it.qty, 0);
    });
    return t;
  }, [picked]);

  // AI best
  const aiBest = useMemo(() => {
    if (Object.keys(totals).length < 2) return null;
    const entries = Object.entries(totals);
    entries.sort((a,b) => a[1] - b[1]);
    const best = entries[0], worst = entries[entries.length - 1];
    return { winnerId: best[0], winnerTotal: best[1], worstTotal: worst[1], savings: worst[1] - best[1] };
  }, [totals]);

  const canCompare = picked.length >= 2 && !categoryConflict;

  if (generated) {
    return <GeneratedCompare go={go} rfqMode={true}
      source={categories[0] || 'RFQ'}
      items={mergedItems}
      suppliers={supplierIds}
      totals={totals}
      aiBest={aiBest} />;
  }

  return (
    <div className="page" style={{ paddingBottom:200 }}>
      <button className="btn ghost sm" onClick={() => go('compare')} style={{ marginBottom:20, marginLeft:-8 }}>
        {Icons.back} กลับไป Compare
      </button>

      <div className="page-head" style={{ alignItems:'flex-start' }}>
        <div className="page-title">
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:8,
              padding:'4px 12px', borderRadius:4,
              background:'var(--teal-soft)', color:'var(--teal-ink)',
              fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600,
            }}>
              {NEXT_CMP_NO}
              <span style={{ fontSize:9, color:'var(--ink-3)', fontWeight:400, letterSpacing:0.06, textTransform:'uppercase' }}>auto</span>
            </span>
            <span style={{
              display:'inline-block', padding:'2px 10px', borderRadius:4,
              background:'#DCE6E1', color:'var(--teal-ink)',
              fontSize:11, fontWeight:500,
            }}>โหมด B · จาก RFQ ที่จัดทำ</span>
          </div>
          <h1 className="h-display">สร้างเอกสารเปรียบเทียบ</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'8px 0 0', maxWidth:620 }}>
            นำใบเสนอราคาที่ Supplier ตอบกลับมาเทียบกัน — มีเงื่อนไขจริงจาก Supplier บนเอกสาร
          </p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:32, alignItems:'flex-start' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

          {/* Step 1: pick RFQs */}
          <SectionCard step="1" label="เลือก RFQ ที่จะเปรียบเทียบ"
            desc={`เลือก ≥ 2 ใบ (สถานะ Received) ที่อยู่ในหมวดเดียวกัน · พบ ${ELIGIBLE_RFQS.length} ใบ`}>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {ELIGIBLE_RFQS.map(r => {
                const on = picked.includes(r.no);
                const conflict = on && categoryConflict;
                return (
                  <label key={r.no} style={{
                    display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
                    border:'1px solid', borderColor: conflict ? 'var(--clay)' : on ? 'var(--teal)' : 'var(--rule-2)',
                    background: conflict ? 'var(--clay-soft)' : on ? 'var(--teal-soft)' : 'var(--paper)',
                    borderRadius:6, cursor:'pointer',
                  }}>
                    <input type="checkbox" checked={on}
                      onChange={() => setPicked(on ? picked.filter(n => n !== r.no) : [...picked, r.no])}
                      style={{ width:16, height:16, accentColor:'var(--teal)', cursor:'pointer' }} />
                    <Av initials={r.supName.slice(0,2)} kind={r.supKind} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span className="font-mono" style={{ fontSize:11.5, color:'var(--ink-2)', fontWeight:500 }}>{r.no}</span>
                        <span style={{ fontSize:14, fontWeight:500 }}>{r.supName}</span>
                        <span style={{
                          display:'inline-flex', alignItems:'center', gap:6,
                          fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:999,
                          background:'var(--moss-soft)', color:'#2F4A1A',
                        }}>
                          <span style={{ width:5, height:5, borderRadius:999, background:'var(--moss)' }} />
                          Received
                        </span>
                      </div>
                      <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:4 }}>
                        {r.category} · {r.project} · {r.items.length} รายการ · เครดิต {r.credit} · รับ {r.received}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {categoryConflict && (
              <div style={{
                marginTop:14, padding:'12px 14px',
                background:'var(--clay-soft)', border:'1px solid var(--clay)',
                borderRadius:6, fontSize:12.5, color:'#6B2D1A',
                display:'flex', gap:10, alignItems:'flex-start',
              }}>
                <span style={{ color:'var(--clay)' }}>{Icons.alert}</span>
                <div>
                  <strong>RFQ ที่เลือกมาจากต่างหมวดกัน</strong> ({categories.join(', ')}) —
                  ระบบไม่สามารถเปรียบเทียบข้ามหมวดได้ กรุณาเลือก RFQ ในหมวดเดียวกัน
                </div>
              </div>
            )}
          </SectionCard>

          {/* Step 2: live preview */}
          {canCompare && (
            <SectionCard step="2" label="ตัวอย่างการเปรียบเทียบ"
              desc={`${pickedRfqs.length} Supplier · ${mergedItems.length} รายการ · ในหมวด ${categories[0]}`}>
              <ComparePreviewTable items={mergedItems}
                suppliers={pickedRfqs.map(r => ({ id:r.supplierId, name:r.supName, kind:r.supKind }))}
                totals={totals} />

              {/* Terms comparison */}
              <div style={{ marginTop:20 }}>
                <div className="eyebrow" style={{ marginBottom:10 }}>เงื่อนไขจาก Supplier (ดึงจาก RFQ)</div>
                <div style={{ overflowX:'auto', borderRadius:6, border:'1px solid var(--rule)' }}>
                  <table className="tbl" style={{ background:'transparent' }}>
                    <thead>
                      <tr>
                        <th style={{ width:200 }}>เงื่อนไข</th>
                        {pickedRfqs.map(r => (
                          <th key={r.no} className="num-col">{r.supName}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>เครดิตเทอม</td>
                        {pickedRfqs.map(r => {
                          const longest = Math.max(...pickedRfqs.map(x => parseInt(x.credit) || 0));
                          const days = parseInt(r.credit) || 0;
                          const best = days === longest && days > 0;
                          return (
                            <td key={r.no} className="num-col" style={{
                              background: best ? 'var(--teal-soft)' : 'transparent',
                              fontWeight: best ? 500 : 400, fontSize:12.5,
                              color: best ? 'var(--teal-ink)' : 'var(--ink-2)',
                            }}>{r.credit}</td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>วันที่ Supplier ส่งกลับ</td>
                        {pickedRfqs.map(r => (
                          <td key={r.no} className="num-col" style={{ fontSize:12.5, color:'var(--ink-2)' }}>{r.received}</td>
                        ))}
                      </tr>
                      <tr>
                        <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>การรับประกัน</td>
                        {pickedRfqs.map(r => (
                          <td key={r.no} className="num-col" style={{ fontSize:11.5, color:'var(--ink-3)', fontStyle:'italic' }}>
                            ระบุในใบเสนอราคา
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <AISuggestionPanel
                items={mergedItems}
                suppliers={pickedRfqs.map(r => ({ id:r.supplierId, name:r.supName, kind:r.supKind }))}
                totals={totals}
                aiBest={aiBest}
              />
            </SectionCard>
          )}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:16, position:'sticky', top:80 }}>
          <CreateSummary
            rfqNo={NEXT_CMP_NO}
            mode="โหมด B · จาก RFQ"
            itemsCount={mergedItems.length}
            suppliersCount={pickedRfqs.length}
            canCompare={canCompare}
            aiBest={aiBest}
            suppliers={pickedRfqs.map(r => ({ id:r.supplierId, name:r.supName }))}
          />
          {pickedRfqs.length > 0 && (
            <div className="card" style={{ padding:16, background:'var(--surface-2)' }}>
              <div className="eyebrow" style={{ marginBottom:10 }}>RFQ ที่เลือก</div>
              {pickedRfqs.map(r => (
                <div key={r.no} style={{ display:'flex', gap:10, fontSize:11.5, marginBottom:8, alignItems:'flex-start' }}>
                  <span className="font-mono" style={{ color:'var(--ink-3)', flexShrink:0 }}>{r.no}</span>
                  <span style={{ color:'var(--ink-2)' }}>{r.supName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position:'fixed', left:240, right:0, bottom:0,
        background:'var(--surface)', borderTop:'1px solid var(--rule)',
        padding:'16px 48px', display:'flex', alignItems:'center', gap:24,
        boxShadow:'0 -8px 24px -12px rgba(20,18,14,0.10)', zIndex:10,
      }}>
        <div style={{ display:'flex', gap:32 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom:2 }}>เอกสาร</div>
            <div className="font-mono" style={{ fontSize:16, lineHeight:1, marginTop:2 }}>{NEXT_CMP_NO}</div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom:2 }}>RFQ ที่เลือก</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:22, lineHeight:1 }}>
              {picked.length} <span style={{ fontSize:13, color:'var(--ink-3)' }}>ใบ</span>
            </div>
          </div>
          {aiBest && (
            <div>
              <div className="eyebrow" style={{ marginBottom:2 }}>AI คาดประหยัด</div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:22, lineHeight:1, color:'var(--moss)' }}>
                {money(aiBest.savings)}
              </div>
            </div>
          )}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button className="btn ghost" onClick={() => go('compare')}>ยกเลิก</button>
          <button className="btn" disabled={!canCompare}>บันทึกร่าง</button>
          <button className="btn primary" disabled={!canCompare}
            onClick={() => setGenerated(true)}
            style={{ padding:'10px 20px', opacity: canCompare ? 1 : 0.5, cursor: canCompare ? 'pointer' : 'not-allowed' }}>
            {Icons.check} Compare & สร้างเอกสาร
          </button>
        </div>
      </div>
    </div>
  );
}
