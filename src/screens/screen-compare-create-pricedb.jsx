'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Icons, Chip, Av, money } from '../lib/shell';
import { SettingsSearchBox } from '../lib/settings-shared';

/*
  Compare Create — Mode A: From Price Database
  Flow: Source (MAT/SUB) → pick Items → pick Suppliers (≥2) → live compare
*/

// Auto comparison number — first free CMP-YYYY-#### slot from the existing
// comparisons (mirrors the RFQ numbering). Time-derived fallback if the
// list can't be fetched.
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
export const NEXT_CMP_NO = '';

// Synthetic per-supplier price data — for demo, generated from base price
export function pricesForItem(itemCode, basePrice, supplierIds) {
  // Deterministic spread per supplier
  const spread = (sId, base) => {
    const hash = [...sId].reduce((s,c) => s + c.charCodeAt(0), 0);
    const pct = ((hash % 11) - 5) / 100; // -5%..+5%
    return Math.round(base * (1 + pct));
  };
  const out = {};
  supplierIds.forEach(id => {
    out[id] = basePrice ? spread(id, basePrice) : null;
  });
  return out;
}

// Kept as exported placeholders for backwards-compat with any consumers.
// Real data is fetched at runtime inside ScreenCompareCreatePriceDB.
export const PRICEDB_SUPPLIERS = [];
export const BASE_PRICES = {};

export function ScreenCompareCreatePriceDB({ go }) {
  const [source, setSource] = useState('Material'); // Material | SubContract

  // suppliersData : [{ id, name, kind, items: [{ code, name, spec, unit, qty, price }] }]
  // — each Supplier has their OWN list of items (per-Supplier shopping basket)
  const [suppliersData, setSuppliersData] = useState([]);
  const [picker, setPicker] = useState(null);            // { supplierId } when item picker is open
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [generatedNo, setGeneratedNo] = useState('');

  // Live data
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [priceRows, setPriceRows] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading]    = useState(true);
  const [loadErr, setLoadErr]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr]   = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true); setLoadErr('');
      try {
        const [sR, mR, pR, uR] = await Promise.all([
          fetch('/api/suppliers').then(r => r.json()),
          fetch('/api/materials').then(r => r.json()),
          fetch('/api/prices').then(r => r.json()),
          fetch('/api/units').then(r => r.json()),
        ]);
        setSuppliers(sR.items || []);
        setMaterials(mR.items || []);
        setPriceRows(pR.items || []);
        setUnits(uR.items || []);
      } catch {
        setLoadErr('โหลดข้อมูลไม่สำเร็จ');
      }
      setLoading(false);
    })();
  }, []);

  // Latest price per (material_id, supplier_id) — prices come back sorted captured_at desc
  const priceLookup = useMemo(() => {
    const map = new Map();
    for (const p of priceRows) {
      const k = `${p.material_id}::${p.supplier_id}`;
      if (!map.has(k)) map.set(k, p);
    }
    return map;
  }, [priceRows]);

  // Resolve unit_id → readable code (falls back to name, then blank) so the
  // picker/PDF never shows a raw "unit_..." id.
  const unitLabelById = useMemo(() => {
    const m = new Map();
    for (const u of units) m.set(u.id, u.code || u.name || '');
    return m;
  }, [units]);

  // Categories derived from materials in DB
  const categories = useMemo(() => {
    const byCat = new Map();
    for (const m of materials) {
      const catName = m.category || 'ไม่ระบุ';
      if (!byCat.has(catName)) byCat.set(catName, { name: catName, short: catName.slice(0,4).toUpperCase(), items: [] });
      byCat.get(catName).items.push({
        code: m.code || m.id,
        name: m.name,
        spec: m.spec || '',
        unit: unitLabelById.get(m.unit_id) || '',
        id:   m.id,
      });
    }
    return [...byCat.values()];
  }, [materials, unitLabelById]);

  // Suppliers that can be added (with kind hint based on type)
  const supplierOptions = useMemo(() =>
    suppliers.filter(s => s.active !== false).map(s => ({
      id: s.id, name: s.name, kind: s.type || 'company', cats: [s.type || ''],
    })),
  [suppliers]);

  // --- helpers --------------------------------------------------------------
  const addSupplier = (s) => {
    if (suppliersData.find(x => x.id === s.id)) return;
    setSuppliersData([...suppliersData, { id:s.id, name:s.name, kind:s.kind, items:[] }]);
  };
  const removeSupplier = (sid) => setSuppliersData(suppliersData.filter(s => s.id !== sid));
  const setItemsFor = (sid, fn) => setSuppliersData(suppliersData.map(s =>
    s.id === sid ? { ...s, items: fn(s.items) } : s
  ));
  const addItemsTo = (sid, items) => {
    setItemsFor(sid, list => {
      const existing = new Set(list.map(i => i.code));
      const fresh = items.filter(i => !existing.has(i.code))
        .map(i => {
          // Real price lookup from /api/prices: latest captured_at for (material_id, supplier_id)
          const matId = i.id || i.code;
          const p = priceLookup.get(`${matId}::${sid}`);
          const price = p ? Number(p.price) : null;
          return { ...i, materialId: matId, qty: 1, price };
        });
      return [...list, ...fresh];
    });
  };
  const removeItemFrom = (sid, code) =>
    setItemsFor(sid, list => list.filter(i => i.code !== code));
  const updateQtyFor = (sid, code, qty) =>
    setItemsFor(sid, list => list.map(i => i.code === code ? { ...i, qty } : i));

  // --- derived: build merged item grid ---------------------------------------
  // Each unique item code becomes a row; cells = price from each supplier (or null)
  const grid = useMemo(() => {
    const codeMap = new Map();
    suppliersData.forEach(s => {
      s.items.forEach(it => {
        if (!codeMap.has(it.code)) {
          codeMap.set(it.code, { code:it.code, name:it.name, spec:it.spec, unit:it.unit, qty:it.qty, prices:{} });
        }
        const row = codeMap.get(it.code);
        row.prices[s.id] = it.price;
        // qty: use the largest qty across suppliers for that item (so the row reflects total need)
        if (Number(it.qty) > Number(row.qty || 0)) row.qty = it.qty;
      });
    });
    return [...codeMap.values()];
  }, [suppliersData]);

  // --- per-supplier totals (sum of THEIR items only) -------------------------
  const totals = useMemo(() => {
    const t = {};
    suppliersData.forEach(s => {
      t[s.id] = s.items.reduce((sum, it) => sum + (it.price || 0) * (Number(it.qty) || 1), 0);
    });
    return t;
  }, [suppliersData]);

  // --- AI suggestion ---------------------------------------------------------
  // Operate on the INTERSECTION of items (items every supplier has) for fair comparison.
  // If no intersection, fall back to full totals.
  const { aiBest, fairTotals, fairMode } = useMemo(() => {
    if (suppliersData.length < 2) return { aiBest:null, fairTotals:{}, fairMode:'full' };
    const intersectCodes = grid
      .filter(row => suppliersData.every(s => row.prices[s.id] != null))
      .map(row => row.code);

    const useFair = intersectCodes.length > 0;
    const fair = {};
    suppliersData.forEach(s => {
      fair[s.id] = s.items
        .filter(it => !useFair || intersectCodes.includes(it.code))
        .reduce((sum, it) => sum + (it.price || 0) * (Number(it.qty) || 1), 0);
    });
    if (Object.values(fair).some(v => v === 0)) {
      // can't compute a fair best — use full totals
      const entries = Object.entries(totals).filter(([_, v]) => v > 0);
      if (entries.length < 2) return { aiBest:null, fairTotals:totals, fairMode:'full' };
      entries.sort((a,b) => a[1] - b[1]);
      return {
        aiBest:{ winnerId:entries[0][0], winnerTotal:entries[0][1], worstTotal:entries[entries.length-1][1], savings:entries[entries.length-1][1] - entries[0][1] },
        fairTotals:totals, fairMode:'full',
      };
    }
    const entries = Object.entries(fair);
    entries.sort((a,b) => a[1] - b[1]);
    const best = entries[0], worst = entries[entries.length - 1];
    return {
      aiBest:{ winnerId:best[0], winnerTotal:best[1], worstTotal:worst[1], savings:worst[1] - best[1] },
      fairTotals:fair,
      fairMode: useFair ? 'intersection' : 'full',
    };
  }, [grid, suppliersData, totals]);

  // --- validation -----------------------------------------------------------
  const hasMinSuppliers = suppliersData.length >= 2;
  const allHaveItems    = suppliersData.length > 0 && suppliersData.every(s => s.items.length > 0);
  const canCompare      = hasMinSuppliers && allHaveItems;

  /* ===================== Submit handler ===================== */
  async function submitComparison() {
    setSubmitErr('');
    setSubmitting(true);
    const cmpNo = await makeCmpNo();
    // Compute total_low / total_high from per-supplier totals
    const totalVals = Object.values(totals).filter(v => v > 0);
    const total_low  = totalVals.length ? Math.min(...totalVals) : 0;
    const total_high = totalVals.length ? Math.max(...totalVals) : 0;
    const payload = {
      no: cmpNo,
      title: `เปรียบเทียบราคา ${source} · ${grid.length} รายการ`,
      status: 'draft',
      items_json: grid.map(it => ({
        code: it.code, name: it.name, spec: it.spec || '', unit: it.unit || '',
        qty: Number(it.qty) || 1, prices: it.prices,
      })),
      suppliers_json: {
        mode: 'PriceDB',
        source,
        list: suppliersData.map(s => ({ id: s.id, name: s.name, kind: s.kind })),
        selectedSupplier: aiBest ? (suppliersData.find(s => s.id === aiBest.winnerId)?.name || '') : '',
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

  /* ===================== Success ===================== */
  if (generated) {
    return <GeneratedCompare
      go={go} rfqMode={false}
      source={source}
      items={grid}
      suppliers={suppliersData.map(s => s.id)}
      supplierObjs={suppliersData}
      totals={totals}
      aiBest={aiBest}
      cmpNo={generatedNo}
    />;
  }

  /* ===================== Main builder UI ===================== */
  // Suppliers eligible to add (haven't been added yet, filtered to source-relevant categories)
  // Memoised — was rebuilt on every render (incl. while typing in any input)
  const addable = useMemo(() => {
    const already = new Set(suppliersData.map(s => s.id));
    return supplierOptions.filter(s => !already.has(s.id));
  }, [suppliersData, supplierOptions]);

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
              {NEXT_CMP_NO || 'CMP-YYYY-XXXX'}
              <span style={{ fontSize:9, color:'var(--ink-3)', fontWeight:400, letterSpacing:0.06, textTransform:'uppercase' }}>auto</span>
            </span>
            <span style={{
              display:'inline-block', padding:'2px 10px', borderRadius:4,
              background:'#F0E4C5', color:'#6B5121',
              fontSize:11, fontWeight:500,
            }}>โหมด A · จาก Price Database</span>
          </div>
          <h1 className="h-display">สร้างเอกสารเปรียบเทียบ</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'8px 0 0', maxWidth:640 }}>
            เลือก Supplier ขั้นต่ำ <strong style={{ color:'var(--ink-2)' }}>2 ราย</strong> —
            แต่ละรายเลือกรายการของตัวเอง — ระบบจะดึงราคาล่าสุดจาก Price DB มาเทียบให้
          </p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:32, alignItems:'flex-start' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

          {/* Step 1: Source */}
          <SectionCard step="1" label="เลือก Source" desc="แหล่งข้อมูลที่จะใช้เปรียบเทียบ">
            <div style={{ display:'flex', gap:0, border:'1px solid var(--rule-2)', borderRadius:6, overflow:'hidden', width:'fit-content' }}>
              {['Material','SubContract'].map(s => (
                <button key={s} type="button"
                  onClick={() => { setSource(s); setSuppliersData([]); }}
                  style={{
                    padding:'10px 20px', fontSize:13, fontFamily:'inherit',
                    background: source === s ? 'var(--ink)' : 'var(--surface)',
                    color: source === s ? 'var(--paper)' : 'var(--ink-2)',
                    border:'none', cursor:'pointer',
                    borderRight: s === 'Material' ? '1px solid var(--rule-2)' : 'none',
                  }}>{s}</button>
              ))}
            </div>
          </SectionCard>

          {/* Step 2: Suppliers + their per-supplier item lists */}
          <SectionCard step="2" label="เลือก Supplier และรายการของแต่ละเจ้า"
            desc={`ขั้นต่ำ 2 Supplier · แต่ละเจ้าเลือกรายการของตัวเอง — ตอนนี้มี ${suppliersData.length} Supplier`}>

            {suppliersData.length === 0 ? (
              <div style={{
                padding:'32px 24px', textAlign:'center',
                background:'var(--surface-2)', borderRadius:8,
                border:'1px dashed var(--rule-2)',
              }}>
                <div style={{ fontSize:13, color:'var(--ink-3)', marginBottom:12 }}>ยังไม่มี Supplier — เริ่มได้โดยกดปุ่มด้านล่าง</div>
                <button className="btn primary" onClick={() => setSupplierPickerOpen(true)}>
                  {Icons.plus} เพิ่ม Supplier รายแรก
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {suppliersData.map((s, idx) => (
                  <SupplierBasket
                    key={s.id}
                    letter={String.fromCharCode(65 + idx)}
                    supplier={s}
                    onRemove={() => removeSupplier(s.id)}
                    onAddItems={() => setPicker({ supplierId: s.id })}
                    onRemoveItem={(code) => removeItemFrom(s.id, code)}
                    onUpdateQty={(code, qty) => updateQtyFor(s.id, code, qty)}
                  />
                ))}
                <button className="btn sm" onClick={() => setSupplierPickerOpen(true)}
                  disabled={addable.length === 0}
                  style={{ alignSelf:'flex-start' }}>
                  {Icons.plus} เพิ่ม Supplier {suppliersData.length >= 1 ? `(รายที่ ${suppliersData.length + 1})` : ''}
                </button>
              </div>
            )}
          </SectionCard>

          {/* Step 3: Live preview */}
          {canCompare && (
            <SectionCard step="3" label="ตัวอย่างการเปรียบเทียบ"
              desc={`รวม ${grid.length} รายการ · รายที่ Supplier ไม่มีราคาจะขึ้น "—"`}>
              <ComparePreviewTable
                items={grid}
                suppliers={suppliersData.map(s => ({ id:s.id, name:s.name, kind:s.kind }))}
                totals={totals}
              />
              {fairMode === 'intersection' && (
                <div style={{
                  marginTop:14, padding:'10px 14px',
                  background:'var(--surface-2)', borderRadius:6,
                  border:'1px solid var(--rule)', fontSize:11.5, color:'var(--ink-2)',
                  display:'flex', gap:10, alignItems:'flex-start',
                }}>
                  <span style={{ color:'var(--teal)' }}>{Icons.sparkles}</span>
                  <span>
                    AI ใช้ <strong>รายการร่วม ({grid.filter(row => suppliersData.every(s => row.prices[s.id] != null)).length} รายการ)</strong> สำหรับเปรียบเทียบอย่างยุติธรรม
                    — รายการที่มีเฉพาะบางรายยังแสดงในตาราง แต่ไม่ถูกคิดรวมในยอด AI Recommendation
                  </span>
                </div>
              )}
              <AISuggestionPanel
                items={grid}
                suppliers={suppliersData.map(s => ({ id:s.id, name:s.name, kind:s.kind }))}
                totals={fairTotals}
                aiBest={aiBest}
              />
            </SectionCard>
          )}
        </div>

        {/* Right rail summary */}
        <div style={{ display:'flex', flexDirection:'column', gap:16, position:'sticky', top:80 }}>
          <CreateSummary
            rfqNo={NEXT_CMP_NO}
            mode="โหมด A · Price DB"
            source={source}
            itemsCount={grid.length}
            suppliersCount={suppliersData.length}
            canCompare={canCompare}
            aiBest={aiBest}
            suppliers={suppliersData.map(s => ({ id:s.id, name:s.name }))}
          />
          {!canCompare && suppliersData.length > 0 && (
            <div className="card" style={{ padding:14, background:'var(--surface-2)' }}>
              <div className="eyebrow" style={{ marginBottom:6 }}>สิ่งที่ต้องทำ</div>
              <ul style={{ margin:0, paddingLeft:18, fontSize:12, color:'var(--ink-2)', lineHeight:1.7 }}>
                {!hasMinSuppliers && <li>เลือก Supplier อย่างน้อย 2 ราย (ตอนนี้ {suppliersData.length})</li>}
                {hasMinSuppliers && !allHaveItems && (
                  <li>
                    เพิ่มรายการให้ Supplier ที่ยังว่าง — {suppliersData.filter(s=>s.items.length===0).map(s=>s.name).join(', ')}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Sticky footer */}
      <div style={{
        position:'fixed', left:240, right:0, bottom:0,
        background:'var(--surface)', borderTop:'1px solid var(--rule)',
        padding:'16px 48px', display:'flex', alignItems:'center', gap:24,
        boxShadow:'0 -8px 24px -12px rgba(20,18,14,0.10)', zIndex:10,
      }}>
        <div style={{ display:'flex', gap:32 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom:2 }}>เอกสาร</div>
            <div className="font-mono" style={{ fontSize:16, lineHeight:1, marginTop:2 }}>{NEXT_CMP_NO || 'CMP-YYYY-XXXX'}</div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom:2 }}>Supplier</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:22, lineHeight:1 }}>
              {suppliersData.length} <span style={{ fontSize:13, color:'var(--ink-3)' }}>ราย</span>
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom:2 }}>รายการ (รวม)</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:22, lineHeight:1 }}>
              {grid.length}
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
          <button className="btn" disabled={!canCompare || submitting}
            onClick={submitComparison}>บันทึกร่าง</button>
          <button className="btn primary" disabled={!canCompare || submitting}
            onClick={submitComparison}
            style={{ padding:'10px 20px', opacity: (canCompare && !submitting) ? 1 : 0.5, cursor: (canCompare && !submitting) ? 'pointer' : 'not-allowed' }}>
            {Icons.check} {submitting ? 'กำลังบันทึก…' : 'Compare & สร้างเอกสาร'}
          </button>
        </div>
      </div>

      {/* Supplier picker modal */}
      {supplierPickerOpen && (
        <SupplierPickerModal
          addable={addable}
          onClose={() => setSupplierPickerOpen(false)}
          onPick={(s) => { addSupplier(s); setSupplierPickerOpen(false); }}
        />
      )}

      {/* Item picker modal (per supplier) */}
      {picker && (
        <ItemPickerModal
          categories={categories} source={source}
          targetSupplier={suppliersData.find(s => s.id === picker.supplierId)}
          alreadyPicked={new Set((suppliersData.find(s => s.id === picker.supplierId)?.items || []).map(i => i.code))}
          priceLookup={priceLookup}
          supplierId={picker.supplierId}
          onClose={() => setPicker(null)}
          onAdd={(items) => { addItemsTo(picker.supplierId, items); setPicker(null); }} />
      )}
    </div>
  );
}

/* =================== Per-supplier basket card =================== */
function SupplierBasket({ letter, supplier, onRemove, onAddItems, onRemoveItem, onUpdateQty }) {
  const total = supplier.items.reduce((s,i) => s + (i.price || 0) * (Number(i.qty) || 1), 0);
  return (
    <div style={{
      border:'1px solid var(--rule)', borderRadius:8, overflow:'hidden',
      background:'var(--surface)',
    }}>
      <div style={{
        padding:'12px 16px', borderBottom:'1px solid var(--rule)',
        background:'var(--surface-2)',
        display:'flex', alignItems:'center', gap:12,
      }}>
        <span style={{
          width:28, height:28, borderRadius:6,
          background:'var(--teal)', color:'var(--paper)',
          display:'inline-grid', placeItems:'center',
          fontSize:13, fontWeight:600, fontFamily:'var(--font-serif)',
          flexShrink:0,
        }}>{letter}</span>
        <Av initials={supplier.name.slice(0,2)} kind={supplier.kind} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:500 }}>{supplier.name}</div>
          <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2, display:'inline-flex', alignItems:'center', gap:10 }}>
            <span className="font-mono">{supplier.id}</span>
            <span>{supplier.items.length} รายการ</span>
            {total > 0 && <span>· รวม <span className="num" style={{ color:'var(--ink-2)', fontWeight:500 }}>{money(total)}</span></span>}
          </div>
        </div>
        <button className="btn sm" onClick={onRemove} style={{ color:'var(--ink-3)' }}>○ ลบ Supplier</button>
      </div>

      {supplier.items.length === 0 ? (
        <div style={{ padding:'24px 24px', textAlign:'center' }}>
          <div style={{ fontSize:12.5, color:'var(--ink-3)', marginBottom:10 }}>ยังไม่มีรายการสำหรับ Supplier นี้</div>
          <button className="btn sm" onClick={onAddItems}
            style={{ background:'var(--teal)', color:'var(--paper)', borderColor:'var(--teal)' }}>
            {Icons.plus} เลือกรายการ
          </button>
        </div>
      ) : (
        <>
          <table className="tbl" style={{ background:'transparent' }}>
            <thead>
              <tr>
                <th style={{ width:'14%' }}>รหัส</th>
                <th>รายการ</th>
                <th style={{ width:100 }} className="num-col">จำนวน</th>
                <th style={{ width:70 }}>หน่วย</th>
                <th className="num-col" style={{ width:'15%' }}>ราคา (จาก DB)</th>
                <th className="num-col" style={{ width:'15%' }}>รวม</th>
                <th style={{ width:36 }}></th>
              </tr>
            </thead>
            <tbody>
              {supplier.items.map(it => (
                <tr key={it.code}>
                  <td className="font-mono" style={{ fontSize:11, color:'var(--ink-2)' }}>{it.code}</td>
                  <td>
                    <div style={{ fontWeight:500 }}>{it.name}</div>
                    {it.spec && <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>{it.spec}</div>}
                  </td>
                  <td className="num-col">
                    <input type="number" value={it.qty}
                      onChange={e => onUpdateQty(it.code, e.target.value)}
                      placeholder="1" className="num"
                      style={{ width:72, padding:'4px 8px', fontSize:12.5, border:'1px solid var(--rule)', borderRadius:4, textAlign:'right', background:'var(--paper)' }} />
                  </td>
                  <td style={{ fontSize:12.5, color:'var(--ink-3)' }}>{it.unit}</td>
                  <td className="num-col num" style={{ color:'var(--ink-2)' }}>{it.price ? money(it.price) : '—'}</td>
                  <td className="num-col num" style={{ color:'var(--ink-2)' }}>
                    {it.price ? money(it.price * (Number(it.qty) || 1)) : '—'}
                  </td>
                  <td>
                    <button className="btn ghost sm" onClick={() => onRemoveItem(it.code)}
                      style={{ padding:'2px 6px', color:'var(--ink-4)' }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding:'10px 16px', borderTop:'1px solid var(--rule)', background:'var(--surface-2)' }}>
            <button className="btn sm" onClick={onAddItems}>{Icons.plus} เพิ่มรายการให้ Supplier นี้</button>
          </div>
        </>
      )}
    </div>
  );
}

/* =================== Supplier picker modal =================== */
function SupplierPickerModal({ addable, onClose, onPick }) {
  const [q, setQ] = useState('');
  const filtered = addable.filter(s => !q || s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(20,18,14,0.32)',
      display:'grid', placeItems:'center', zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} className="card"
           style={{ width:560, padding:0, boxShadow:'var(--sh-pop)', display:'flex', flexDirection:'column', maxHeight:'80vh' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom:4 }}>เพิ่ม Supplier เข้าเปรียบเทียบ</div>
            <h3 className="h-section">เลือก Supplier</h3>
          </div>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหา…" />
        </div>
        <div style={{ overflowY:'auto' }}>
          <table className="tbl" style={{ background:'var(--paper)' }}>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => onPick(s)} style={{ cursor:'pointer' }}>
                  <td style={{ padding:'12px 16px', width:36 }}>
                    <Av initials={s.name.slice(0,2)} kind={s.kind} />
                  </td>
                  <td style={{ padding:'12px 8px' }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{s.name}</div>
                    <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:3 }}>{s.cats.join(' · ')}</div>
                  </td>
                  <td style={{ padding:'12px 16px', textAlign:'right' }}>
                    <button className="btn sm" style={{ background:'var(--teal)', color:'var(--paper)', borderColor:'var(--teal)' }}>
                      เลือก
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={3} style={{ padding:28, textAlign:'center', fontSize:13, color:'var(--ink-3)' }}>
                  {addable.length === 0 ? 'เลือก Supplier ครบทุกรายแล้ว' : 'ไม่พบ Supplier'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding:'12px 24px', borderTop:'1px solid var(--rule)', background:'var(--surface-2)', display:'flex', justifyContent:'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
        </div>
      </div>
    </div>
  );
}

/* =================== Item picker modal =================== */
function ItemPickerModal({ categories, source, targetSupplier, alreadyPicked = new Set(), priceLookup, supplierId, onClose, onAdd }) {
  const [selectedCat, setSelectedCat] = useState(categories[0]?.short || '');
  const [picked, setPicked] = useState(new Set());
  const [q, setQ] = useState('');

  // Memoised so the per-row IIFE price lookup doesn't trigger full re-filter
  // (matters: each category can have hundreds of items).
  const cat = useMemo(
    () => categories.find(c => c.short === selectedCat),
    [categories, selectedCat]
  );
  const items = useMemo(() => {
    if (!q) return cat?.items || [];
    const v = q.toLowerCase();
    return (cat?.items || []).filter(it =>
      it.name.toLowerCase().includes(v) || it.code.toLowerCase().includes(v)
    );
  }, [cat, q]);

  const toggle = (code) => {
    const next = new Set(picked);
    next.has(code) ? next.delete(code) : next.add(code);
    setPicked(next);
  };

  const onConfirm = () => {
    const out = [];
    categories.forEach(c => {
      c.items.forEach(it => {
        if (picked.has(it.code)) out.push({ ...it, cat:c.name, catShort:c.short });
      });
    });
    onAdd(out);
  };

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(20,18,14,0.32)',
      display:'grid', placeItems:'center', zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} className="card"
           style={{ width:920, height:560, padding:0, boxShadow:'var(--sh-pop)', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom:4 }}>
              เลือก {source} เพิ่มให้ Supplier
              {targetSupplier && <span style={{ color:'var(--teal-ink)', fontWeight:600, marginLeft:6 }}>· {targetSupplier.name}</span>}
            </div>
            <h3 className="h-section">เลือกรายการ</h3>
          </div>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหา…" />
        </div>

        <div style={{ flex:1, display:'grid', gridTemplateColumns:'240px 1fr', overflow:'hidden' }}>
          <div style={{ borderRight:'1px solid var(--rule)', background:'var(--surface-2)', overflowY:'auto' }}>
            {categories.map(c => {
              const sel = c.short === selectedCat;
              return (
                <div key={c.short} onClick={() => setSelectedCat(c.short)}
                  style={{
                    padding:'12px 16px', cursor:'pointer',
                    background: sel ? 'var(--surface)' : 'transparent',
                    borderLeft: sel ? '3px solid var(--teal)' : '3px solid transparent',
                    borderBottom:'1px solid var(--rule)',
                  }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{
                      display:'inline-block', padding:'2px 6px', borderRadius:3,
                      background: sel ? 'var(--teal)' : 'var(--paper-2)',
                      color: sel ? 'var(--paper)' : 'var(--ink-2)',
                      fontFamily:'var(--font-mono)', fontSize:10, fontWeight:600,
                    }}>{c.short}</span>
                    <span style={{ fontSize:12.5, fontWeight: sel ? 500 : 400 }}>{c.name}</span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:4 }}>{c.items.length} รายการ</div>
                </div>
              );
            })}
          </div>
          <div style={{ overflowY:'auto' }}>
            <table className="tbl">
              <thead style={{ position:'sticky', top:0, background:'var(--surface)', zIndex:1 }}>
                <tr>
                  <th style={{ width:40 }}></th>
                  <th style={{ width:'18%' }}>รหัส</th>
                  <th>รายการ</th>
                  <th>หน่วย</th>
                  <th className="num-col" style={{ width:'18%' }}>ราคาอ้างอิงล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => {
                  const dis = alreadyPicked.has(it.code);
                  return (
                    <tr key={it.code} style={dis ? { opacity:0.5 } : null}>
                      <td>
                        <input type="checkbox" checked={picked.has(it.code) || dis} disabled={dis} onChange={() => toggle(it.code)}
                          style={{ width:14, height:14, accentColor:'var(--teal)', cursor: dis ? 'not-allowed' : 'pointer' }} />
                      </td>
                      <td className="font-mono" style={{ fontSize:11, color:'var(--ink-2)' }}>{it.code}</td>
                      <td>
                        <div style={{ fontWeight:500 }}>{it.name}</div>
                        <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>{it.spec}</div>
                      </td>
                      <td style={{ fontSize:12.5, color:'var(--ink-3)' }}>{it.unit}</td>
                      <td className="num-col num" style={{ color:'var(--ink-2)' }}>
                        {(() => {
                          const p = priceLookup && supplierId ? priceLookup.get(`${it.id || it.code}::${supplierId}`) : null;
                          return p ? money(Number(p.price)) : '—';
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--surface-2)' }}>
          <div style={{ fontSize:12.5, color:'var(--ink-3)' }}>เลือกแล้ว <strong style={{ color:'var(--ink)' }}>{picked.size}</strong> รายการ</div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
            <button className="btn primary" disabled={picked.size === 0} onClick={onConfirm} style={{ opacity: picked.size === 0 ? 0.5 : 1 }}>
              {Icons.check} เพิ่ม {picked.size} รายการ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================== Helpers exposed for both Mode A and Mode B =================== */
export function SectionCard({ step, label, desc, children }) {
  return (
    <div className="card" style={{ padding:'20px 24px 24px' }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:16 }}>
        <span style={{
          width:22, height:22, borderRadius:999, background:'var(--paper-2)',
          color:'var(--ink-2)', display:'inline-grid', placeItems:'center',
          fontSize:11, fontWeight:600, fontFamily:'var(--font-mono)',
          alignSelf:'center', flexShrink:0,
        }}>{step}</span>
        <div style={{ flex:1 }}>
          <h3 className="h-card" style={{ marginBottom:2 }}>{label}</h3>
          {desc && <p style={{ fontSize:12, color:'var(--ink-3)', margin:0 }}>{desc}</p>}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function ComparePreviewTable({ items, suppliers, totals }) {
  return (
    <div style={{ overflowX:'auto' }}>
      <table className="tbl" style={{ minWidth:'100%' }}>
        <thead>
          <tr>
            <th>รายการ</th>
            <th className="num-col" style={{ width:90 }}>จำนวน</th>
            {suppliers.map(s => (
              <th key={s.id} className="num-col" style={{ minWidth:120 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6 }}>
                  <span style={{ fontSize:12 }}>{s.name}</span>
                  <Av initials={s.name.slice(0,2)} kind={s.kind} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(it => {
            const vals = suppliers.map(s => it.prices[s.id]).filter(v => v != null);
            const min = vals.length ? Math.min(...vals) : null;
            return (
              <tr key={it.code}>
                <td>
                  <div style={{ fontWeight:500 }}>{it.name}</div>
                  <div className="font-mono" style={{ fontSize:11, color:'var(--ink-4)', marginTop:2 }}>{it.code}</div>
                </td>
                <td className="num-col num" style={{ color:'var(--ink-2)' }}>{Number(it.qty || 1).toLocaleString()} {it.unit}</td>
                {suppliers.map(s => {
                  const p = it.prices[s.id];
                  const isMin = p != null && p === min;
                  return (
                    <td key={s.id} className="num-col" style={{
                      background: isMin ? 'var(--teal-soft)' : 'transparent',
                    }}>
                      <div className="num" style={{ fontSize:13, fontWeight: isMin ? 600 : 500 }}>
                        {p != null ? money(p) : <span style={{ color:'var(--ink-4)', fontStyle:'italic', fontWeight:400 }}>—</span>}
                      </div>
                      {p != null && (
                        <div style={{ fontSize:10, color:'var(--ink-3)', marginTop:2 }}>
                          รวม <span className="num">{money(p * (Number(it.qty) || 1))}</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr style={{ background:'var(--surface-2)', fontWeight:500 }}>
            <td colSpan={2} style={{ textAlign:'right' }}>รวมทั้งสิ้น</td>
            {suppliers.map(s => {
              const t = totals[s.id];
              const min = Math.min(...Object.values(totals));
              const isMin = t === min;
              return (
                <td key={s.id} className="num-col" style={{ background: isMin ? 'var(--teal-soft)' : 'transparent' }}>
                  <div className="num font-serif" style={{ fontSize:16, color: isMin ? 'var(--teal-ink)' : 'var(--ink)' }}>
                    {money(t)}
                  </div>
                  {isMin && <div style={{ fontSize:10, color:'var(--teal)', marginTop:2, fontWeight:500 }}>ต่ำสุด</div>}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* =================== AI Suggestion Panel =================== */
export function AISuggestionPanel({ items, suppliers, totals, aiBest }) {
  if (!aiBest) return null;
  const winner = suppliers.find(s => s.id === aiBest.winnerId);
  const savingsPct = aiBest.worstTotal ? ((aiBest.savings / aiBest.worstTotal) * 100).toFixed(1) : 0;

  // Per-item insight
  const itemsLowestBySupplier = {};
  suppliers.forEach(s => { itemsLowestBySupplier[s.id] = 0; });
  items.forEach(it => {
    const vals = suppliers.map(s => ({ id:s.id, p: it.prices[s.id] })).filter(v => v.p != null);
    const min = Math.min(...vals.map(v => v.p));
    vals.filter(v => v.p === min).forEach(v => itemsLowestBySupplier[v.id]++);
  });

  return (
    <div style={{
      marginTop:20, padding:'20px 22px',
      background:'linear-gradient(135deg, var(--teal-soft) 0%, #F1ECDB 100%)',
      border:'1px solid var(--teal)', borderRadius:8,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:14 }}>
        <span style={{
          width:32, height:32, borderRadius:999, background:'var(--teal)',
          color:'var(--paper)', display:'inline-grid', placeItems:'center',
          fontSize:14, fontWeight:600, flexShrink:0,
        }}>AI</span>
        <div style={{ flex:1 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span className="eyebrow" style={{ color:'var(--teal-ink)' }}>AI Suggestion</span>
            <span style={{ fontSize:10, padding:'1px 6px', borderRadius:3, background:'var(--paper)', color:'var(--teal-ink)', fontWeight:600, letterSpacing:0.06 }}>BETA</span>
          </div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:24, lineHeight:1.3, color:'var(--teal-ink)' }}>
            แนะนำให้เลือก <strong>{winner?.name}</strong> · ประหยัด <span style={{ color:'var(--moss)' }}>{money(aiBest.savings)}</span> <span style={{ fontSize:14, color:'var(--ink-3)' }}>({savingsPct}%)</span>
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14, marginTop:14 }}>
        <div>
          <div className="eyebrow" style={{ fontSize:9.5, marginBottom:4 }}>ราคารวมต่ำสุด</div>
          <div className="font-serif" style={{ fontSize:18, color:'var(--teal-ink)' }}>{money(aiBest.winnerTotal)}</div>
          <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>เทียบกับสูงสุด {money(aiBest.worstTotal)}</div>
        </div>
        <div>
          <div className="eyebrow" style={{ fontSize:9.5, marginBottom:4 }}>รายการที่ชนะ</div>
          <div className="font-serif" style={{ fontSize:18, color:'var(--teal-ink)' }}>
            {itemsLowestBySupplier[aiBest.winnerId]} <span style={{ fontSize:12, color:'var(--ink-3)' }}>/ {items.length}</span>
          </div>
          <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>ราคาต่ำสุดจากรายการทั้งหมด</div>
        </div>
        <div>
          <div className="eyebrow" style={{ fontSize:9.5, marginBottom:4 }}>ระดับความเชื่อมั่น</div>
          <div className="font-serif" style={{ fontSize:18, color:'var(--teal-ink)' }}>{savingsPct > 5 ? 'สูง' : savingsPct > 2 ? 'ปานกลาง' : 'ต่ำ'}</div>
          <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>อิงจากส่วนต่างราคา {savingsPct}%</div>
        </div>
      </div>

      <p style={{ marginTop:14, fontSize:12.5, color:'var(--ink-2)', lineHeight:1.7, padding:'12px 14px', background:'var(--paper)', borderRadius:6 }}>
        <strong style={{ color:'var(--teal-ink)' }}>💡 บทวิเคราะห์:</strong> {winner?.name} ให้ราคารวมต่ำสุดในชุดนี้
        ({money(aiBest.winnerTotal)}) ประหยัดจากการเลือกราคาสูงสุดได้ {money(aiBest.savings)} ({savingsPct}%) ·
        ชนะ {itemsLowestBySupplier[aiBest.winnerId]} จาก {items.length} รายการ ·
        แนะนำให้พิจารณาเงื่อนไขอื่นเพิ่มเติม เช่น เครดิตเทอม และเวลาส่งมอบ ก่อนตัดสินใจขั้นสุดท้าย
      </p>
    </div>
  );
}

export function CreateSummary({ rfqNo, mode, source, itemsCount, suppliersCount, canCompare, aiBest, suppliers }) {
  return (
    <div className="card" style={{ padding:20 }}>
      <div className="eyebrow" style={{ marginBottom:12 }}>สรุปก่อน Compare</div>
      <Row label="เลขที่"   value={<span className="font-mono">{rfqNo}</span>} />
      <Row label="โหมด"     value={mode} />
      {source && <Row label="Source" value={source} />}
      <Row label="รายการ"   value={`${itemsCount} รายการ`} />
      <Row label="Supplier" value={`${suppliersCount} ราย`} />
      {aiBest && suppliers && (
        <Row label="AI แนะนำ" value={<span style={{ color:'var(--teal)', fontWeight:500 }}>{suppliers.find(s=>s.id===aiBest.winnerId)?.name}</span>} last />
      )}
      {!aiBest && <Row label="AI" value={<em style={{ color:'var(--ink-4)' }}>{canCompare ? 'กำลังคำนวณ…' : 'รอข้อมูลครบ'}</em>} last />}
    </div>
  );
}

export function Row({ label, value, last }) {
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start',
      padding:'8px 0', borderBottom: last ? 'none' : '1px solid var(--rule)',
    }}>
      <span style={{ fontSize:11.5, color:'var(--ink-3)', flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:12.5, color:'var(--ink)', textAlign:'right', fontWeight:450 }}>{value}</span>
    </div>
  );
}

/* =================== Generated success view (shared by Mode A + Mode B) =================== */
// Browser print-to-PDF: hide everything except the .print-area, open the
// print dialog (user picks "Save as PDF"), then restore. Reliable Thai
// rendering with zero PDF-library weight.
export function printDoc(title) {
  const prev = document.title;
  if (title) document.title = title;
  document.body.classList.add('print-doc-mode');
  const cleanup = () => {
    document.body.classList.remove('print-doc-mode');
    document.title = prev;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(cleanup, 2000); // fallback for browsers that skip afterprint
}

export function GeneratedCompare({ go, rfqMode, source, items, suppliers, supplierObjs, totals, aiBest, cmpNo }) {
  // supplierObjs: provided when caller has full supplier rows ({id,name,kind}); fallback to ID-only stubs
  const suppObjs = Array.isArray(supplierObjs) && supplierObjs.length
    ? supplierObjs
    : suppliers.map(id => ({ id, name: id, kind: 'company' }));
  const winner = suppObjs.find(s => s.id === aiBest?.winnerId);
  const displayNo = cmpNo || NEXT_CMP_NO || 'CMP-YYYY-XXXX';

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => go('compare')} style={{ marginBottom:20, marginLeft:-8 }}>
        {Icons.back} กลับไป Compare
      </button>

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:32, marginBottom:32, alignItems:'flex-start' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
            <span className="font-mono" style={{ fontSize:12, color:'var(--ink-3)' }}>{displayNo}</span>
            <Chip kind="active">{Icons.check} สร้างสำเร็จ</Chip>
            <span style={{ fontSize:12, color:'var(--ink-3)' }}>· พร้อมดาวน์โหลด PDF</span>
          </div>
          <h1 className="h-display" style={{ marginBottom:8 }}>เปรียบเทียบราคา {source || 'RFQ'}</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', maxWidth:560, lineHeight:1.6 }}>
            เอกสารเปรียบเทียบสร้างเรียบร้อย — สามารถดาวน์โหลด PDF เพื่อนำไปอนุมัติในระบบภายนอก แล้วกลับมา Upload Ref เป็นหลักฐานในระบบ
          </p>

          <div style={{ display:'flex', gap:8, marginTop:24, flexWrap:'wrap' }}>
            <button className="btn primary" onClick={() => printDoc(`${displayNo}_Compare`)}>
              {Icons.download} ดาวน์โหลด PDF
            </button>
            <button className="btn" onClick={() => go('compare-upload-ref')}>{Icons.upload} Upload Ref เอกสาร</button>
            <button className="btn ghost" onClick={() => go('compare')}>ดูเอกสารทั้งหมด</button>
          </div>
        </div>

        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--rule)' }}>
            <span className="eyebrow">PDF · เอกสารเปรียบเทียบราคา</span>
          </div>
          <div style={{ padding:'20px', display:'flex', gap:14, alignItems:'flex-start' }}>
            <div style={{
              width:48, height:60, background:'var(--clay)', color:'#fff',
              borderRadius:4, display:'grid', placeItems:'center',
              fontSize:11, fontWeight:600, letterSpacing:0.5, flexShrink:0,
            }}>PDF</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:500 }}>{displayNo}_Compare.pdf</div>
              <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:4 }}>18 KB · พร้อมเซ็นอนุมัติ</div>
              <div style={{ marginTop:14, fontSize:11.5, color:'var(--ink-3)', lineHeight:1.7 }}>
                <div>📋 ตารางเปรียบเทียบ {items.length} รายการ × {suppliers.length} Supplier</div>
                <div>🤖 บทวิเคราะห์จาก AI พร้อมเหตุผล</div>
                <div>✍️ ช่องเซ็นอนุมัติ 3 ระดับ</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <h3 className="h-section" style={{ marginBottom:16 }}>ตัวอย่างเอกสาร PDF</h3>
      <div className="print-area">
        <ComparePDFPreview items={items} suppliers={suppObjs} totals={totals} aiBest={aiBest} winner={winner} mode={rfqMode ? 'RFQ' : 'PriceDB'} cmpNo={displayNo} />
      </div>
    </div>
  );
}

/* =================== PDF doc preview (success page) =================== */
export function ComparePDFPreview({ items, suppliers, totals, aiBest, winner, mode, cmpNo }) {
  const savingsPct = aiBest?.worstTotal ? ((aiBest.savings / aiBest.worstTotal) * 100).toFixed(1) : 0;
  const displayNo = cmpNo || NEXT_CMP_NO || 'CMP-YYYY-XXXX';
  // Sign-off slots come from the approval_roles master. The old
  // getActiveApprovalRoles() import was an empty stub, so configured roles
  // never appeared on the PDF.
  const [signRoles, setSignRoles] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/approval-roles');
        if (!r.ok) return;
        const d = await r.json();
        setSignRoles((d.items || []).filter(x => x.active).sort((a, b) => (a.level || 0) - (b.level || 0)));
      } catch { /* keep placeholder slots */ }
    })();
  }, []);

  return (
    <div className="card" style={{ padding:0, overflow:'hidden', boxShadow:'0 8px 32px -16px rgba(20,18,14,0.18)' }}>
      <div style={{
        padding:'8px 14px', background:'#F3F1EA', borderBottom:'1px solid #D6CFBC',
        fontSize:11, color:'var(--ink-3)', display:'flex', alignItems:'center', gap:12, fontFamily:'var(--font-mono)',
      }}>
        <span style={{ background:'var(--clay)', color:'#fff', padding:'2px 6px', borderRadius:2, fontSize:9.5, fontWeight:600 }}>PDF</span>
        <span>{displayNo}_Compare.pdf</span>
      </div>

      <div style={{ padding:'36px 48px', background:'#FFFFFF', minHeight:600 }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, paddingBottom:16, borderBottom:'2px solid #15130E' }}>
          <div>
            <div style={{ fontSize:11, letterSpacing:0.16, textTransform:'uppercase', color:'var(--ink-3)' }}>Initial Estate Co., Ltd.</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:28, lineHeight:1.1, marginTop:6 }}>ตารางเปรียบเทียบราคา</div>
            <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:4 }}>Price Comparison · {mode === 'RFQ' ? 'จากใบเสนอราคา (RFQ)' : 'จากฐานข้อมูลราคา (Price DB)'}</div>
          </div>
          <div style={{ textAlign:'right', fontSize:11.5, lineHeight:1.7 }}>
            <div><span style={{ color:'var(--ink-3)' }}>เลขที่:</span> <span className="font-mono" style={{ fontWeight:500 }}>{displayNo}</span></div>
            <div><span style={{ color:'var(--ink-3)' }}>วันที่:</span> —</div>
          </div>
        </div>

        {/* AI box */}
        <div style={{ padding:'16px 18px', background:'#F1ECDB', border:'1px solid var(--teal)', borderRadius:6, marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <span style={{ padding:'2px 8px', background:'var(--teal)', color:'var(--paper)', fontSize:10, fontWeight:600, borderRadius:3, letterSpacing:0.06 }}>AI SUGGESTION</span>
            <span style={{ fontSize:11, color:'var(--ink-3)' }}>ระบบวิเคราะห์อัตโนมัติ</span>
          </div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:18, lineHeight:1.4 }}>
            แนะนำให้เลือก <strong style={{ color:'var(--teal-ink)' }}>{winner?.name}</strong> ·
            ประหยัด <span style={{ color:'var(--moss)' }}>{money(aiBest?.savings || 0)} ({savingsPct}%)</span>
          </div>
        </div>

        {/* Items table */}
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
          <thead>
            <tr style={{ background:'#15130E', color:'#FFFFFF' }}>
              <th style={{ padding:'8px 10px', textAlign:'left', fontWeight:500 }}>รายการ</th>
              <th style={{ padding:'8px 10px', textAlign:'right', fontWeight:500, width:80 }}>จำนวน</th>
              {suppliers.map(s => (
                <th key={s.id} style={{ padding:'8px 10px', textAlign:'right', fontWeight:500,
                    background: s.id === aiBest?.winnerId ? '#1F4D40' : 'transparent' }}>
                  {s.name}{s.id === aiBest?.winnerId && <span style={{ marginLeft:6, fontSize:9, color:'#DCE6E1' }}>✓ AI</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(it => {
              const vals = suppliers.map(s => it.prices[s.id]).filter(v => v != null);
              const min = Math.min(...vals);
              return (
                <tr key={it.code} style={{ borderBottom:'1px solid #E5DFD0' }}>
                  <td style={{ padding:'10px' }}>
                    <div style={{ fontWeight:500 }}>{it.name}</div>
                    <div className="font-mono" style={{ fontSize:10, color:'var(--ink-3)', marginTop:2 }}>{it.code}</div>
                  </td>
                  <td style={{ padding:'10px', textAlign:'right', fontFamily:'var(--font-mono)' }}>{Number(it.qty || 1).toLocaleString()} {it.unit}</td>
                  {suppliers.map(s => {
                    const p = it.prices[s.id];
                    const isMin = p === min;
                    return (
                      <td key={s.id} style={{
                        padding:'10px', textAlign:'right',
                        background: isMin ? '#DCE6E1' : 'transparent',
                      }}>
                        <div className="num" style={{ fontWeight: isMin ? 600 : 500 }}>{p != null ? money(p) : '—'}</div>
                        <div style={{ fontSize:10, color:'var(--ink-3)', marginTop:2 }}>{p != null ? money(p * (Number(it.qty)||1)) : ''}</div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr style={{ background:'#15130E', color:'#FFFFFF' }}>
              <td colSpan={2} style={{ padding:'12px 10px', textAlign:'right', fontWeight:500 }}>มูลค่ารวมสุทธิ</td>
              {suppliers.map(s => {
                const t = totals[s.id];
                const isMin = s.id === aiBest?.winnerId;
                return (
                  <td key={s.id} style={{
                    padding:'12px 10px', textAlign:'right',
                    background: isMin ? '#1F4D40' : 'transparent',
                  }}>
                    <div className="num font-serif" style={{ fontSize:16, fontWeight:500 }}>{money(t)}</div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>

        {/* Conditions to consider — text from Supplier's quote; checkboxes pick which Supplier to order from */}
        <div style={{ marginTop:32 }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:11, letterSpacing:0.12, textTransform:'uppercase', color:'var(--ink-3)', fontWeight:600 }}>
              เงื่อนไขประกอบการพิจารณา (Conditions to Consider)
            </div>
            <div style={{ fontSize:10.5, color:'var(--ink-3)', fontStyle:'italic' }}>
              ข้อความที่ Supplier แต่ละเจ้าเขียนมาในใบเสนอราคา
            </div>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11, border:'1px solid #D6CFBC' }}>
            <thead>
              <tr style={{ background:'#F6F2E9' }}>
                <th style={{ padding:'8px 10px', textAlign:'left', fontWeight:500, color:'var(--ink-2)', borderRight:'1px solid #D6CFBC', width:'18%' }}>เงื่อนไข</th>
                {suppliers.map(s => (
                  <th key={s.id} style={{
                    padding:'8px 10px', textAlign:'left', fontWeight:500,
                    color: s.id === aiBest?.winnerId ? 'var(--teal-ink)' : 'var(--ink-2)',
                    background: s.id === aiBest?.winnerId ? '#DCE6E1' : 'transparent',
                    borderRight:'1px solid #D6CFBC',
                  }}>{s.name}</th>
                ))}
              </tr>
              {/* "Select this Supplier" row — single checkbox per column */}
              <tr style={{ background:'#FFFFFF' }}>
                <td style={{
                  padding:'10px', borderTop:'1px solid #D6CFBC', borderRight:'1px solid #D6CFBC',
                  fontSize:10.5, color:'var(--ink-3)', fontStyle:'italic', verticalAlign:'middle',
                }}>
                  ☐ เลือกสั่งกับ Supplier เจ้านี้
                </td>
                {suppliers.map(s => (
                  <td key={s.id} style={{
                    padding:'10px', borderTop:'1px solid #D6CFBC', borderRight:'1px solid #D6CFBC',
                    background: s.id === aiBest?.winnerId ? 'rgba(220,230,225,0.4)' : 'transparent',
                    textAlign:'center', verticalAlign:'middle',
                  }}>
                    <span style={{
                      display:'inline-block', width:22, height:22,
                      border:'1.6px solid var(--ink-2)', borderRadius:3,
                      background:'#FFFFFF',
                    }} />
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Real quoted terms only — parsed from the supplier's Excel
                // (or typed in on the RFQ-confirm screen) and carried on the
                // supplier object as `terms`. Never fabricate text in an
                // approval document; missing answers render as —.
                const conds = [
                  { icon:'💳', label:'การชำระเงิน', pick: (s) => s.terms?.payment },
                  { icon:'🚚', label:'การจัดส่ง',   pick: (s) => s.terms?.delivery },
                  { icon:'⏱',  label:'การยืนราคา',  pick: (s) => s.terms?.validity },
                  { icon:'🛡️', label:'การรับประกัน', pick: (s) => s.terms?.warranty },
                  { icon:'📦', label:'Lead Time',   pick: (s) => s.terms?.leadtime },
                ];
                return conds.map((c, ci) => (
                  <tr key={c.label} style={{
                    borderTop:'1px solid #E5DFD0',
                    background: ci % 2 ? '#FCFAF5' : 'transparent',
                  }}>
                    <td style={{
                      padding:'10px', verticalAlign:'top',
                      borderRight:'1px solid #E5DFD0',
                      fontWeight:500, color:'var(--ink-2)',
                    }}>
                      <span style={{ marginRight:6 }}>{c.icon}</span>{c.label}
                    </td>
                    {suppliers.map(s => {
                      const isWinner = s.id === aiBest?.winnerId;
                      return (
                        <td key={s.id} style={{
                          padding:'10px', verticalAlign:'top',
                          borderRight:'1px solid #E5DFD0',
                          background: isWinner ? 'rgba(220,230,225,0.4)' : 'transparent',
                          color:'var(--ink-2)', lineHeight:1.6, fontSize:11,
                        }}>
                          {c.pick(s) || <span style={{ color:'var(--ink-4)', fontStyle:'italic' }}>— ไม่ได้ระบุในใบเสนอราคา —</span>}
                        </td>
                      );
                    })}
                  </tr>
                ));
              })()}
            </tbody>
          </table>
          <div style={{ marginTop:8, fontSize:10.5, color:'var(--ink-3)', fontStyle:'italic' }}>
            * ข้อความเงื่อนไขในตารางนี้ Supplier เป็นผู้เขียนเองในใบเสนอราคา ·
            ผู้อนุมัติติ๊ก ☐ ที่ด้านบนคอลัมน์ของ Supplier <strong style={{ color:'var(--ink-2)' }}>เจ้าที่ต้องการเลือกสั่งซื้อ</strong>
          </div>
        </div>

        {/* Sign-off — slots driven by Approval Roles master data */}
        {(() => {
          const roles = signRoles;
          const cols = Math.max(roles.length, 3);
          return (
            <div style={{ marginTop:48, display:'grid', gridTemplateColumns:`repeat(${cols}, 1fr)`, gap:24 }}>
              {[...Array(cols)].map((_,i) => {
                const r = roles[i];
                return (
                  <div key={i} style={{
                    borderTop: r ? '1px solid var(--ink-3)' : '1px dashed var(--rule-2)',
                    paddingTop:8, fontSize:11,
                    color: r ? 'var(--ink-3)' : 'var(--ink-4)',
                    textAlign:'center',
                    fontStyle: r ? 'normal' : 'italic',
                  }}>
                    {r ? r.name : '(ยังไม่ระบุ)'}<br/>
                    <span style={{ color:'var(--ink-4)' }}>ลงนาม / วันที่</span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
