'use client';
import React, { useState, useMemo, useEffect } from 'react';
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

// Running CMP number CMP-YYYY-#### — first free slot for the current year
// based on the existing comparisons (same approach as RFQ numbers). Falls
// back to a time-derived suffix if the list can't be fetched.
async function makeCmpNo() {
  const y = new Date().getFullYear();
  const prefix = `CMP-${y}-`;
  try {
    const r = await fetch('/api/comparisons');
    if (r.ok) {
      const d = await r.json();
      const used = new Set();
      for (const c of (d.items || [])) {
        const no = String(c?.no || '').trim();
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

export function ScreenCompareCreateRFQ({ go }) {
  const [picked, setPicked] = useState([]); // RFQ no's
  const [generated, setGenerated] = useState(false);
  const [generatedNo, setGeneratedNo] = useState('');

  // Live data
  const [rfqs, setRfqs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr]   = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true); setLoadErr('');
      try {
        // RFQ rows keep their payload (supplier + items) as a JSON string in
        // `notes` — there are no supplier_id/items_json columns. Quoted prices
        // live in price_points (written by the RFQ-confirm save flow with
        // source='RFQ', source_id=<rfq.no>), so join those in by material code.
        const [r, rPx, rM] = await Promise.all([
          fetch('/api/rfqs'), fetch('/api/prices'), fetch('/api/materials'),
        ]);
        const d = await r.json();
        if (!r.ok) { setLoadErr(d.error || 'โหลดข้อมูลไม่สำเร็จ'); setLoading(false); return; }
        let pricePoints = [], materials = [];
        if (rPx.ok) { try { pricePoints = (await rPx.json()).items || []; } catch {} }
        if (rM.ok)  { try { materials   = (await rM.json()).items  || []; } catch {} }
        const matIdByCode = new Map(materials.map(m => [m.code, m.id]));

        // Latest price per (material_id, source_id) — pricePoints come
        // ordered captured_at desc, so first match wins.
        const byRfq = new Map();    // `${material_id}|${source_id}` → price
        for (const p of pricePoints) {
          const k = `${p.material_id}|${p.source_id || ''}`;
          if (!byRfq.has(k)) byRfq.set(k, Number(p.price));
        }

        // Include both 'received' and 'closed' RFQs — saving prices closes
        // the RFQ, and closed RFQs are exactly the ones with quoted prices.
        const list = (d.items || [])
          .filter(x => x.status === 'received' || x.status === 'closed')
          .map(x => {
            let parsed = null;
            try { parsed = JSON.parse(x.notes); } catch {}
            const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
            const items = rawItems.map(it => {
              const matId = matIdByCode.get(it.itemCode);
              // Only the price recorded for THIS RFQ counts — falling back to
              // "latest from any supplier" would attribute someone else's
              // price to this supplier on an approval document.
              const price = matId != null
                ? (byRfq.get(`${matId}|${x.no || ''}`) ?? null)
                : null;
              return {
                code: it.itemCode,
                name: it.name || it.itemCode,
                spec: '',
                unit: it.unit || '',
                qty:  Number(it.qty) || 0,
                price,
              };
            });
            return {
              no: x.no || x.id,
              // Fall back to the RFQ id (unique) so two RFQs without a
              // supplier_id never collide under the same '' key.
              supplierId: parsed?.supplier_id || `rfq_${x.id}`,
              supName:    parsed?.supplier_name || x.title || x.no || '—',
              supKind:    'company',
              // The supplier's actual quoted conditions (parsed/edited on
              // the RFQ-confirm screen) — shown on the Compare PDF.
              terms:      parsed?.conditions || null,
              category:   x.project_id || 'ทั่วไป',
              project:    x.project_id || '',
              credit:     '—',
              received:   x.created_at || '',
              items,
            };
          });
        setRfqs(list);
      } catch {
        setLoadErr('เครือข่ายขัดข้อง');
      }
      setLoading(false);
    })();
  }, []);

  const ELIGIBLE_RFQS = rfqs;
  // Memoised — O(1) lookup table + single pass to resolve `picked` to objects
  const rfqByNo = useMemo(() => {
    const m = new Map();
    for (const r of ELIGIBLE_RFQS) m.set(r.no, r);
    return m;
  }, [ELIGIBLE_RFQS]);
  const pickedRfqs = useMemo(
    () => picked.map(no => rfqByNo.get(no)).filter(Boolean),
    [picked, rfqByNo]
  );

  // Validate: must share same category
  const categories = useMemo(
    () => [...new Set(pickedRfqs.map(r => r.category))],
    [pickedRfqs]
  );
  const categoryConflict = categories.length > 1;

  // Merge items across RFQs by code — dep was `picked` (stale on rfq fetch);
  // pickedRfqs already memoised so depend on that
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
  }, [pickedRfqs]);

  const supplierIds = useMemo(() => pickedRfqs.map(r => r.supplierId), [pickedRfqs]);

  // Totals — same stale-dep fix
  const totals = useMemo(() => {
    const t = {};
    pickedRfqs.forEach(r => {
      // Items with no recorded price contribute 0 instead of poisoning the
      // whole total with NaN.
      t[r.supplierId] = r.items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
    });
    return t;
  }, [pickedRfqs]);

  // AI best
  const aiBest = useMemo(() => {
    if (Object.keys(totals).length < 2) return null;
    const entries = Object.entries(totals);
    entries.sort((a,b) => a[1] - b[1]);
    const best = entries[0], worst = entries[entries.length - 1];
    return { winnerId: best[0], winnerTotal: best[1], worstTotal: worst[1], savings: worst[1] - best[1] };
  }, [totals]);

  const canCompare = picked.length >= 2 && !categoryConflict;

  async function submitComparison() {
    setSubmitErr('');
    setSubmitting(true);
    const cmpNo = await makeCmpNo();
    const totalVals = Object.values(totals).filter(v => v > 0);
    const total_low  = totalVals.length ? Math.min(...totalVals) : 0;
    const total_high = totalVals.length ? Math.max(...totalVals) : 0;
    const payload = {
      no: cmpNo,
      title: `เปรียบเทียบราคา RFQ · ${categories[0] || ''} · ${mergedItems.length} รายการ`,
      status: 'draft',
      items_json: mergedItems.map(it => ({
        code: it.code, name: it.name, spec: it.spec || '', unit: it.unit || '',
        qty: Number(it.qty) || 1, prices: it.prices,
      })),
      suppliers_json: {
        mode: 'RFQ',
        category: categories[0] || '',
        rfqNos: picked,
        list: pickedRfqs.map(r => ({ id: r.supplierId, name: r.supName, kind: r.supKind, rfqNo: r.no, terms: r.terms || null })),
        selectedSupplier: aiBest ? (pickedRfqs.find(r => r.supplierId === aiBest.winnerId)?.supName || '') : '',
      },
      total_low, total_high,
      notes: '',
    };
    try {
      const res = await fetch('/api/comparisons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitErr(data.error || 'บันทึกไม่สำเร็จ'); setSubmitting(false); return; }
      setGeneratedNo(cmpNo);
      setGenerated(true);
    } catch {
      setSubmitErr('เครือข่ายขัดข้อง');
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="page">
        <button className="btn ghost sm" onClick={() => go('compare')} style={{ marginBottom:20, marginLeft:-8 }}>
          {Icons.back} กลับไป Compare
        </button>
        <div style={{ padding:40, textAlign:'center', color:'var(--ink-3)' }}>กำลังโหลด…</div>
      </div>
    );
  }

  if (generated) {
    return <GeneratedCompare go={go} rfqMode={true}
      source={categories[0] || 'RFQ'}
      items={mergedItems}
      suppliers={supplierIds}
      supplierObjs={pickedRfqs.map(r => ({ id:r.supplierId, name:r.supName, kind:r.supKind, terms:r.terms || null }))}
      totals={totals}
      aiBest={aiBest}
      cmpNo={generatedNo} />;
  }

  return (
    <div className="page" style={{ paddingBottom:200 }}>
      <button className="btn ghost sm" onClick={() => go('compare')} style={{ marginBottom:20, marginLeft:-8 }}>
        {Icons.back} กลับไป Compare
      </button>
      {loadErr && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{loadErr}</div>
      )}
      {submitErr && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{submitErr}</div>
      )}

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
              {ELIGIBLE_RFQS.length === 0 ? (
                <div style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>ยังไม่มีข้อมูล</div>
              ) : ELIGIBLE_RFQS.map(r => {
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
          <button className="btn primary" disabled={!canCompare || submitting || generated}
            onClick={submitComparison}
            style={{ padding:'10px 20px', opacity: (canCompare && !submitting) ? 1 : 0.5, cursor: (canCompare && !submitting) ? 'pointer' : 'not-allowed' }}>
            {Icons.check} {submitting ? 'กำลังบันทึก…' : 'Compare & สร้างเอกสาร'}
          </button>
        </div>
      </div>
    </div>
  );
}
