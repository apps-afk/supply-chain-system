'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Icons, Chip, Stat, Spark, Delta, Av, money } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsSearchBox, UnitPicker } from '../lib/settings-shared';
import { usePermissions } from '../lib/use-permissions';
import { useTableView, Th, Pager, exportCSV } from '../lib/table-utils';

/*
  Price DB — list + detail.

  Backed by /api/prices (price_points table). Materials, suppliers, and units
  are pulled from their own master endpoints and joined client-side for display.
  Prices stored are NET — exclude VAT and Overhead.
*/

/* =================== List =================== */

export function ScreenPriceDB({ go }) {
  const perms = usePermissions();
  const [cat, setCat] = useState('ทั้งหมด');
  const [sourceFilter, setSourceFilter] = useState('ทั้งหมด'); // ทั้งหมด | Manual | RFQ
  const [q, setQ] = useState('');
  const [manualOpen, setManualOpen] = useState(false);

  // Live data
  const [prices, setPrices]       = useState([]);
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [units, setUnits]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState('');

  async function load() {
    setLoading(true); setErr('');
    try {
      const [pR, mR, sR, uR] = await Promise.all([
        fetch('/api/prices').then(r => r.json()),
        fetch('/api/materials').then(r => r.json()),
        fetch('/api/suppliers').then(r => r.json()),
        fetch('/api/units').then(r => r.json()),
      ]);
      setPrices(pR.items || []);
      setMaterials(mR.items || []);
      setSuppliers(sR.items || []);
      setUnits(uR.items || []);
    } catch {
      setErr('โหลดข้อมูลไม่สำเร็จ');
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Maps for joining
  const matById = useMemo(() => new Map(materials.map(m => [m.id, m])), [materials]);
  const supById = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);
  const unitById = useMemo(() => new Map(units.map(u => [u.id, u])), [units]);

  // Categories derived from materials
  const cats = useMemo(() => {
    const s = new Set();
    materials.forEach(m => { if (m.category) s.add(m.category); });
    return ['ทั้งหมด', ...[...s].sort()];
  }, [materials]);

  // Real per-material trends: one pass over `prices` builds a material → sorted
  // history map, then spark / Δ MoM / Δ YoY per material (any supplier).
  // null pct = "no comparison data" so the UI can distinguish from a flat 0.
  const trendByMat = useMemo(() => {
    const byMat = new Map();
    for (const p of prices) {
      if (!p.captured_at) continue;
      const t = new Date(p.captured_at).getTime();
      if (Number.isNaN(t)) continue;
      if (!byMat.has(p.material_id)) byMat.set(p.material_id, []);
      byMat.get(p.material_id).push({ t, price: Number(p.price) || 0 });
    }
    const now = Date.now();
    const sparkCutoff = now - 183 * 86400000; // ~6 เดือน
    const out = new Map();
    for (const [matId, pts] of byMat) {
      pts.sort((a, b) => a.t - b.t); // oldest → newest
      const sparkPts = pts.filter(p => p.t >= sparkCutoff);
      const spark = sparkPts.length >= 2 ? sparkPts.map(p => p.price) : [];
      const latest = pts[pts.length - 1];
      const deltaVs = (minDays) => {
        // closest point at least `minDays` older than the latest
        let older = null;
        for (let i = pts.length - 2; i >= 0; i--) {
          if (latest.t - pts[i].t >= minDays * 86400000) { older = pts[i]; break; }
        }
        if (!older || older.price <= 0) return { pct: null, dir: 'flat' };
        const pct = ((latest.price - older.price) / older.price) * 100;
        return { pct, dir: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat' };
      };
      const mom = deltaVs(25);
      const yoy = deltaVs(335);
      out.set(matId, { spark, mom: mom.pct, momDir: mom.dir, yoy: yoy.pct, yoyDir: yoy.dir });
    }
    return out;
  }, [prices]);

  // Build display rows
  const rows = useMemo(() => prices.map(p => {
    const m = matById.get(p.material_id) || {};
    const s = supById.get(p.supplier_id) || {};
    const u = unitById.get(p.unit_id || m.unit_id) || {};
    const captured = p.captured_at ? new Date(p.captured_at) : null;
    const ageDays = captured ? Math.max(0, Math.round((Date.now() - captured.getTime()) / 86400000)) : 0;
    const source = (p.source && p.source.toLowerCase().includes('rfq')) ? 'RFQ' : (p.source || 'Manual');
    const trend = trendByMat.get(p.material_id);
    return {
      id:        p.id,
      materialId: p.material_id,
      code:      m.code || p.material_id,
      name:      m.name || '—',
      spec:      m.spec || '',
      cat:       m.category || '',
      unit:      u.name || u.code || m.unit_id || '',
      sup:       s.name || '—',
      supkind:   s.type || 'company',
      price:     Number(p.price) || 0,
      mom:       trend ? trend.mom : null,
      momDir:    trend ? trend.momDir : 'flat',
      yoy:       trend ? trend.yoy : null,
      yoyDir:    trend ? trend.yoyDir : 'flat',
      spark:     trend ? trend.spark : [],
      date:      captured ? captured.toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' }) : '—',
      age:       ageDays,
      source,
      sourceRef: p.source_id || '',
      flag:      null,
    };
  }), [prices, matById, supById, unitById, trendByMat]);

  const filtered = useMemo(() => {
    const v = q.toLowerCase();
    return rows.filter(r => {
      if (cat !== 'ทั้งหมด' && r.cat !== cat) return false;
      if (sourceFilter !== 'ทั้งหมด' && r.source !== sourceFilter) return false;
      if (v) {
        // Match all text fields case-insensitively — Thai is mostly unaffected
        // but Latin product codes/supplier names were case-sensitive before.
        const name = (r.name || '').toLowerCase();
        const code = (r.code || '').toLowerCase();
        const sup  = (r.sup  || '').toLowerCase();
        if (!(name.includes(v) || code.includes(v) || sup.includes(v))) return false;
      }
      return true;
    });
  }, [rows, cat, sourceFilter, q]);

  // Client-side sort + pagination over the filtered rows (API order by default)
  const { view, page, pages, setPage, sortKey, sortDir, toggleSort, total } =
    useTableView(filtered, { pageSize: 25 });
  const sortProps = { activeKey: sortKey, dir: sortDir, onSort: toggleSort };

  // Stats — single pass, memoised so filter toggles don't recompute
  const { totalPoints, supplierCount, recent30, stale180 } = useMemo(() => {
    let recent = 0, stale = 0;
    const sups = new Set();
    for (const r of rows) {
      if (r.age <= 30) recent++;
      if (r.age > 180) stale++;
      if (r.sup && r.sup !== '—') sups.add(r.sup);
    }
    return { totalPoints: rows.length, supplierCount: sups.size, recent30: recent, stale180: stale };
  }, [rows]);

  // วัสดุที่ราคาปีนี้สูงกว่าปีก่อน (yoy > 0.5%) — นับต่อวัสดุ ไม่ใช่ต่อ price point
  const risingYoY = useMemo(() => {
    let n = 0;
    for (const t of trendByMat.values()) if (t.yoy != null && t.yoy > 0.5) n++;
    return n;
  }, [trendByMat]);

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
        {perms.canWrite && (
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn primary" onClick={() => setManualOpen(true)}>{Icons.plus} เพิ่มราคา</button>
            <button className="btn" onClick={() => exportCSV('price-database.csv', [
              { key:'code',      label:'รหัส' },
              { key:'name',      label:'วัสดุ' },
              { key:'spec',      label:'Spec' },
              { key:'cat',       label:'หมวด' },
              { key:'unit',      label:'หน่วย' },
              { key:'sup',       label:'Supplier' },
              { key:'price',     label:'ราคา (net)' },
              { key: r => r.mom == null ? '' : r.mom.toFixed(1), label:'Δ MoM %' },
              { key:'source',    label:'ที่มา' },
              { key:'sourceRef', label:'อ้างอิง' },
              { key:'date',      label:'วันที่บันทึก' },
            ], filtered)}>{Icons.download} Export</button>
          </div>
        )}
      </div>

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>
      )}

      {/* Top-line stats */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:0,
        borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)',
        padding:'24px 0', marginBottom:32,
      }}>
        {[
          { label:'รายการในระบบ',     value: String(totalPoints), sub: totalPoints ? 'price points ทั้งหมด' : 'ยังไม่มีข้อมูล' },
          { label:'Supplier ใช้งาน',    value: String(supplierCount), sub: supplierCount ? 'มีราคาบันทึกไว้' : 'ยังไม่มีข้อมูล' },
          { label:'เพิ่มเข้าระบบ 30 วัน', value: String(recent30), sub: recent30 ? 'ราคาที่อัพเดทล่าสุด' : 'ยังไม่มีข้อมูล' },
          { label:'ขาขึ้น (YoY)',       value: String(risingYoY),  sub: risingYoY ? 'วัสดุแพงขึ้นเทียบปีก่อน' : 'ไม่มีวัสดุขาขึ้น' },
          { label:'ค้างไม่อัพเดท',       value: String(stale180),   sub: stale180 ? 'เกิน 180 วัน' : 'ยังไม่มีข้อมูล' },
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
              <Th sortKey="code" {...sortProps} style={{ width:'5%' }}>รหัส</Th>
              <Th sortKey="name" {...sortProps} style={{ width:'22%' }}>วัสดุ / Item</Th>
              <Th sortKey="cat" {...sortProps}>หมวด</Th>
              <th>หน่วย</th>
              <Th sortKey="sup" {...sortProps}>Supplier · ราคาต่ำสุด</Th>
              <Th sortKey="price" {...sortProps} className="num-col">ราคาล่าสุด<br/><span style={{ fontSize:9, color:'var(--ink-4)', textTransform:'none', letterSpacing:0 }}>(net · ไม่รวม VAT/OH)</span></Th>
              <Th sortKey="mom" {...sortProps} className="num-col">Δ MoM</Th>
              <th className="num-col">Δ YoY</th>
              <th>เทรนด์ 6 ด.</th>
              <Th sortKey="age" {...sortProps}>อัพเดท · อายุ</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                กำลังโหลด…
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล — คลิก "เพิ่มราคา" เพื่อสร้างรายการแรก
              </td></tr>
            ) : view.map((r) => (
              <tr key={r.id} onClick={() => {
                try { localStorage.setItem('pricedb.currentMaterialId', r.materialId); } catch {}
                go('pricedb-detail');
              }} style={{ cursor:'pointer' }} className={r.flag ? `row-flag-${r.flag}` : ''}>
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
                <td className="num-col">
                  {r.mom == null
                    ? <span style={{ fontSize:12, color:'var(--ink-4)' }}>—</span>
                    : <Delta pct={`${r.mom > 0 ? '+' : ''}${r.mom.toFixed(1)}%`} dir={r.momDir} />}
                </td>
                <td className="num-col">
                  {r.yoy == null
                    ? <span style={{ fontSize:12, color:'var(--ink-4)' }}>—</span>
                    : <Delta pct={`${r.yoy > 0 ? '+' : ''}${r.yoy.toFixed(1)}%`} dir={r.yoyDir} />}
                </td>
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

        <Pager page={page} pages={pages} setPage={setPage} total={total} />
      </div>

      {manualOpen  && <ManualPriceModal
        materials={materials} suppliers={suppliers} units={units}
        onClose={() => setManualOpen(false)}
        onSaved={() => { setManualOpen(false); load(); }} />}
    </div>
  );
}

/* =================== Manual entry modal =================== */
function ManualPriceModal({ materials, suppliers, units, onClose, onSaved, initialMaterialId }) {
  const [form, setForm] = useState({
    materialId: initialMaterialId || '', supplierId:'', price:'', unitId:'', source:'Manual', sourceId:'',
  });
  const set = (k,v) => setForm(prev => ({ ...prev, [k]:v }));
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');

  const selectedMat = materials.find(m => m.id === form.materialId);

  // Auto-fill unit from material
  useEffect(() => {
    if (selectedMat && selectedMat.unit_id && !form.unitId) {
      setForm(f => ({ ...f, unitId: selectedMat.unit_id }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.materialId]);

  async function save() {
    setErr('');
    if (!form.materialId || !form.supplierId || !form.price) {
      setErr('กรุณาเลือก Material, Supplier และกรอกราคา'); return;
    }
    setBusy(true);
    const payload = {
      material_id: form.materialId,
      supplier_id: form.supplierId,
      price:       Number(form.price),
      unit_id:     form.unitId || selectedMat?.unit_id || null,
      source:      form.source || 'Manual',
      source_id:   form.sourceId || '',
    };
    try {
      const res = await fetch('/api/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'บันทึกไม่สำเร็จ'); setBusy(false); return; }
      setBusy(false);
      onSaved && onSaved();
    } catch {
      setErr('เครือข่ายขัดข้อง'); setBusy(false);
    }
  }

  return (
    <SettingsModal eyebrow="บันทึกราคาเข้าระบบ" title="เพิ่มราคา · Manual" onClose={onClose} onSave={save} width={680}>
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

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
      )}

      <div className="eyebrow" style={{ marginBottom:10 }}>ข้อมูล Material และ Supplier</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
        <SettingsField label="Material" required>
          <select value={form.materialId} onChange={e => set('materialId', e.target.value)} style={settingsInputStyle}>
            <option value="">— เลือก —</option>
            {materials.map(m => <option key={m.id} value={m.id}>{m.code ? `${m.code} · ` : ''}{m.name}</option>)}
          </select>
        </SettingsField>
        <SettingsField label="Supplier" required>
          <select value={form.supplierId} onChange={e => set('supplierId', e.target.value)} style={settingsInputStyle}>
            <option value="">— เลือก —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </SettingsField>
      </div>

      <div className="eyebrow" style={{ marginBottom:10 }}>ราคาและที่มา</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <SettingsField label="ราคาต่อหน่วย (บาท · net)" required hint="ไม่รวม VAT และ Overhead">
          <input type="number" value={form.price} onChange={e => set('price', e.target.value)}
            placeholder="0" className="num"
            style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)', textAlign:'right' }} />
        </SettingsField>
        <SettingsField label="หน่วย" hint={selectedMat?.unit_id ? `auto-fill จาก Material — เปลี่ยนได้` : 'เลือกจาก master หน่วยนับ'}>
          <UnitPicker units={units} value={form.unitId} onChange={(id)=>set('unitId', id)} placeholder="— ใช้หน่วยจาก Material —" />
        </SettingsField>
        <SettingsField label="ที่มา (Source)" hint='เช่น "Manual" หรือ "RFQ-2025-1234"'>
          <input value={form.source} onChange={e => set('source', e.target.value)}
            placeholder="Manual" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="รหัสที่มา (Source ID)" hint="(ไม่บังคับ)">
          <input value={form.sourceId} onChange={e => set('sourceId', e.target.value)}
            placeholder="" style={settingsInputStyle} />
        </SettingsField>
      </div>
      {busy && <div style={{ marginTop:12, fontSize:12, color:'var(--ink-3)' }}>กำลังบันทึก…</div>}
    </SettingsModal>
  );
}

/* =================== Detail =================== */


/*
  Real per-material price history (P2):
    - material picked from localStorage('pricedb.currentMaterialId') set by the
      list row click (falls back to the newest price point's material)
    - SVG line chart of captured price points with crosshair + tooltip
    - per-supplier latest/avg table, 90-day stats, activity feed
  Single-series chart → no legend; supplier identity lives in the tooltip
  and the table (never color-alone).
*/
const CHART_LINE = '#0D8A62'; // validated vs white card surface (dataviz checks)

function fmtThDate(d) {
  try { return new Date(d).toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' }); }
  catch { return '—'; }
}

function PriceChart({ points, unitLabel }) {
  const [hover, setHover] = useState(null);
  const W = 760, H = 260;
  const PAD = { l: 64, r: 20, t: 18, b: 30 };

  const { path, dots, yTicks, xTicks, yOf } = useMemo(() => {
    if (!points.length) return { path: '', dots: [], yTicks: [], xTicks: [], yOf: () => 0 };
    const ts = points.map(p => p.t);
    const ps = points.map(p => p.price);
    let tMin = Math.min(...ts), tMax = Math.max(...ts);
    if (tMin === tMax) { tMin -= 86400000; tMax += 86400000; } // single point → give it room
    let pMin = Math.min(...ps), pMax = Math.max(...ps);
    const padP = (pMax - pMin) * 0.08 || pMax * 0.05 || 1;
    pMin -= padP; pMax += padP;
    if (pMin < 0) pMin = 0;

    const xOf = t => PAD.l + ((t - tMin) / (tMax - tMin)) * (W - PAD.l - PAD.r);
    const yOf = p => H - PAD.b - ((p - pMin) / (pMax - pMin)) * (H - PAD.t - PAD.b);

    const dots = points.map((p, i) => ({ ...p, x: xOf(p.t), y: yOf(p.price), i }));
    const path = dots.map((d, i) => `${i ? 'L' : 'M'}${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(' ');

    const yTicks = [0, 1, 2, 3].map(i => {
      const v = pMin + ((pMax - pMin) * i) / 3;
      return { v, y: yOf(v) };
    });
    const nX = Math.min(points.length, 5);
    const xTicks = Array.from({ length: nX }, (_, i) => {
      const idx = Math.round((i * (points.length - 1)) / Math.max(nX - 1, 1));
      return { label: fmtThDate(points[idx].t), x: dots[idx].x };
    });
    return { path, dots, yTicks, xTicks, yOf };
  }, [points]);

  if (!points.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
        ยังไม่มีข้อมูลราคาในช่วงเวลานี้
      </div>
    );
  }

  const hv = hover != null ? dots[hover] : null;
  const last = dots[dots.length - 1];

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0, bd = Infinity;
    for (let i = 0; i < dots.length; i++) {
      const d = Math.abs(dots[i].x - px);
      if (d < bd) { bd = d; best = i; }
    }
    setHover(best);
  }

  return (
    <div style={{ position: 'relative', padding: '8px 8px 4px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {/* recessive grid + y labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="var(--rule)" strokeWidth="1" />
            <text x={PAD.l - 8} y={t.y + 3.5} textAnchor="end"
              style={{ fontSize: 10.5, fill: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
              {money(t.v)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} x={t.x} y={H - 8} textAnchor="middle"
            style={{ fontSize: 10.5, fill: 'var(--ink-3)' }}>{t.label}</text>
        ))}

        {/* crosshair */}
        {hv && (
          <line x1={hv.x} x2={hv.x} y1={PAD.t} y2={H - PAD.b}
            stroke="var(--rule-2)" strokeWidth="1" strokeDasharray="3 3" />
        )}

        {/* the series */}
        {dots.length > 1 && (
          <path d={path} fill="none" stroke={CHART_LINE} strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round" />
        )}
        {dots.map(d => (
          <circle key={d.i} cx={d.x} cy={d.y}
            r={hv && hv.i === d.i ? 5 : 3}
            fill={CHART_LINE} stroke="var(--surface)" strokeWidth="2" />
        ))}

        {/* selective direct label — latest point only */}
        <text x={last.x} y={last.y - 10} textAnchor={last.x > W - 120 ? 'end' : 'middle'}
          style={{ fontSize: 11, fontWeight: 600, fill: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>
          {money(last.price)}
        </text>
      </svg>

      {hv && (
        <div style={{
          position: 'absolute',
          left: `${(hv.x / W) * 100}%`,
          top: `${(hv.y / H) * 100}%`,
          transform: `translate(${hv.x > W * 0.72 ? '-100%' : '-50%'}, -120%)`,
          background: 'var(--ink)', color: 'var(--paper)', borderRadius: 6,
          padding: '7px 10px', fontSize: 11.5, lineHeight: 1.5, pointerEvents: 'none',
          whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(20,18,14,0.25)', zIndex: 5,
        }}>
          <div style={{ fontWeight: 600 }}>{money(hv.price)}{unitLabel ? ` / ${unitLabel}` : ''}</div>
          <div style={{ opacity: 0.85 }}>{hv.supName || '—'} · {hv.source}</div>
          <div style={{ opacity: 0.7 }}>{fmtThDate(hv.t)}</div>
        </div>
      )}
    </div>
  );
}

const RANGES = [
  { label: '3 ด.',    months: 3 },
  { label: '6 ด.',    months: 6 },
  { label: '12 ด.',   months: 12 },
  { label: 'ทั้งหมด', months: null },
];

export function ScreenPriceDBDetail({ go }) {
  const [prices, setPrices]       = useState([]);
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [units, setUnits]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [range, setRange]         = useState(12);
  const [manualOpen, setManualOpen] = useState(false);
  const { canWrite } = usePermissions();

  async function load() {
    setLoading(true);
    try {
      const [pR, mR, sR, uR] = await Promise.all([
        fetch('/api/prices').then(r => r.json()),
        fetch('/api/materials').then(r => r.json()),
        fetch('/api/suppliers').then(r => r.json()),
        fetch('/api/units').then(r => r.json()),
      ]);
      setPrices(pR.items || []);
      setMaterials(mR.items || []);
      setSuppliers(sR.items || []);
      setUnits(uR.items || []);
    } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const supById = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);

  // Selected material: stashed by the list row click; fall back to the
  // material of the newest price point so the page is never an empty shell.
  const material = useMemo(() => {
    if (!materials.length) return null;
    let id = null;
    try { id = localStorage.getItem('pricedb.currentMaterialId'); } catch {}
    return materials.find(m => m.id === id)
        || materials.find(m => m.id === prices[0]?.material_id)
        || materials[0];
  }, [materials, prices]);

  const unit = useMemo(
    () => units.find(u => u.id === material?.unit_id) || null,
    [units, material]
  );
  const unitLabel = unit?.name || unit?.code || '';

  // All points for this material, oldest → newest
  const allPoints = useMemo(() => {
    if (!material) return [];
    return prices
      .filter(p => p.material_id === material.id && p.captured_at)
      .map(p => ({
        t: new Date(p.captured_at).getTime(),
        price: Number(p.price) || 0,
        supId: p.supplier_id,
        supName: supById.get(p.supplier_id)?.name || '—',
        source: (p.source && p.source.toLowerCase().includes('rfq')) ? 'RFQ' : (p.source || 'Manual'),
        sourceRef: p.source_id || '',
      }))
      .sort((a, b) => a.t - b.t);
  }, [prices, material, supById]);

  const rangedPoints = useMemo(() => {
    if (range == null) return allPoints;
    const cutoff = Date.now() - range * 30.44 * 86400000;
    return allPoints.filter(p => p.t >= cutoff);
  }, [allPoints, range]);

  const latest = allPoints.length ? allPoints[allPoints.length - 1] : null;
  const prev   = allPoints.length > 1 ? allPoints[allPoints.length - 2] : null;
  const deltaPct = latest && prev && prev.price > 0
    ? ((latest.price - prev.price) / prev.price) * 100 : null;

  const stats90 = useMemo(() => {
    const cutoff = Date.now() - 90 * 86400000;
    const pts = allPoints.filter(p => p.t >= cutoff).map(p => p.price);
    if (!pts.length) return null;
    return {
      min: Math.min(...pts), max: Math.max(...pts),
      avg: pts.reduce((s, v) => s + v, 0) / pts.length, n: pts.length,
    };
  }, [allPoints]);

  // Per-supplier rollup: latest price/date, 90-day avg, count
  const supplierRows = useMemo(() => {
    const cutoff90 = Date.now() - 90 * 86400000;
    const bySup = new Map();
    for (const p of allPoints) {
      if (!bySup.has(p.supId)) bySup.set(p.supId, []);
      bySup.get(p.supId).push(p);
    }
    const rows = [...bySup.entries()].map(([supId, pts]) => {
      const last = pts[pts.length - 1];
      const recent = pts.filter(p => p.t >= cutoff90);
      const master = supById.get(supId);
      return {
        supId,
        sup: last.supName,
        kind: master?.type || 'company',
        last: last.price,
        lastDate: fmtThDate(last.t),
        avg: recent.length ? recent.reduce((s, p) => s + p.price, 0) / recent.length : null,
        n: pts.length,
        source: last.source,
        ct: master?.payment_terms || '—',
      };
    });
    rows.sort((a, b) => a.last - b.last);
    return rows;
  }, [allPoints, supById]);

  const activities = useMemo(
    () => [...allPoints].reverse().slice(0, 6),
    [allPoints]
  );

  if (loading) {
    return (
      <div className="page">
        <button className="btn ghost sm" onClick={() => go('pricedb')} style={{ marginBottom:20, marginLeft:-8 }}>
          {Icons.back} กลับไป Price Database
        </button>
        <div style={{ padding:40, textAlign:'center', color:'var(--ink-3)' }}>กำลังโหลด…</div>
      </div>
    );
  }

  if (!material) {
    return (
      <div className="page">
        <button className="btn ghost sm" onClick={() => go('pricedb')} style={{ marginBottom:20, marginLeft:-8 }}>
          {Icons.back} กลับไป Price Database
        </button>
        <div className="card" style={{ padding:40, textAlign:'center', color:'var(--ink-3)' }}>
          ยังไม่มีวัสดุในระบบ — เพิ่มได้ที่ ตั้งค่า → วัสดุ
        </div>
      </div>
    );
  }

  const cheapest = supplierRows.length ? supplierRows[0].supId : null;

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => go('pricedb')} style={{ marginBottom:20, marginLeft:-8 }}>
        {Icons.back} กลับไป Price Database
      </button>

      <div className="page-head" style={{ alignItems:'flex-start' }}>
        <div className="page-title">
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
            <span className="font-mono" style={{ fontSize:12, color:'var(--ink-3)' }}>{material.code || '—'}</span>
            <span style={{ fontSize:11, padding:'1px 8px', borderRadius:3, background:'var(--paper-2)', color:'var(--ink-3)' }}>
              ราคาทั้งหมดเป็น net · ไม่รวม VAT/Overhead
            </span>
          </div>
          <h1 className="h-display">{material.name}</h1>
          <div style={{ display:'flex', gap:24, marginTop:12, fontSize:13, color:'var(--ink-3)', flexWrap:'wrap' }}>
            <span>หมวด: <strong style={{ color:'var(--ink-2)' }}>{material.category || '—'}</strong></span>
            <span>หน่วย: <strong style={{ color:'var(--ink-2)' }}>{unitLabel || '—'}</strong></span>
            <span>Spec: <strong style={{ color:'var(--ink-2)' }}>{material.spec || '—'}</strong></span>
          </div>
        </div>
        {canWrite && (
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn" onClick={() => setManualOpen(true)}>{Icons.plus} เพิ่มราคา</button>
            <button className="btn primary" onClick={() => go('rfq-create')}>สร้าง RFQ รายการนี้</button>
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:32 }}>
        <div>
          {/* Hero number + 90-day stats */}
          <div style={{ display:'flex', alignItems:'flex-end', gap:48, marginBottom:8, flexWrap:'wrap' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom:8 }}>
                ราคาล่าสุด · <span style={{ color:'var(--ink-2)' }}>{latest ? fmtThDate(latest.t) : '—'}</span>
              </div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:72, lineHeight:1, letterSpacing:'-0.02em' }}>
                {latest ? money(latest.price) : '฿0'}
                <span style={{ fontFamily:'var(--font-sans)', fontSize:18, color:'var(--ink-3)', marginLeft:8 }}>
                  / {unitLabel || '—'}
                </span>
              </div>
              <div style={{ marginTop:12, display:'flex', gap:16, alignItems:'center' }}>
                {deltaPct != null ? (
                  <>
                    <Delta pct={Math.abs(deltaPct)} dir={deltaPct > 0.05 ? 'up' : deltaPct < -0.05 ? 'down' : 'flat'} />
                    <span style={{ fontSize:12, color:'var(--ink-3)' }}>
                      เทียบครั้งก่อน ({money(prev.price)} · {fmtThDate(prev.t)})
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize:12, color:'var(--ink-3)' }}>
                    {latest ? `จาก ${latest.supName} · ${latest.source}` : 'ยังไม่มีข้อมูลราคา'}
                  </span>
                )}
              </div>
            </div>
            <div style={{ flex:1, minWidth:260 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:0, borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)', padding:'14px 0' }}>
                <Stat label="ต่ำสุด 90 วัน" value={stats90 ? money(stats90.min) : '—'} sub={stats90 ? `${stats90.n} จุดข้อมูล` : 'ยังไม่มีข้อมูล'} />
                <Stat label="สูงสุด 90 วัน" value={stats90 ? money(stats90.max) : '—'} sub={stats90 ? 'ช่วง 90 วันล่าสุด' : 'ยังไม่มีข้อมูล'} />
                <Stat label="เฉลี่ย 90 วัน" value={stats90 ? money(stats90.avg) : '—'} sub={stats90 ? 'net ต่อหน่วย' : 'ยังไม่มีข้อมูล'} />
              </div>
            </div>
          </div>

          {/* History chart */}
          <div className="card" style={{ marginTop:32, padding:0 }}>
            <div style={{ padding:'20px 24px', display:'flex', alignItems:'baseline', justifyContent:'space-between', borderBottom:'1px solid var(--rule)' }}>
              <h3 className="h-card">ประวัติราคา · {rangedPoints.length} จุดข้อมูล</h3>
              <div style={{ display:'flex', gap:4 }}>
                {RANGES.map(r => (
                  <button key={r.label} className="btn sm" onClick={() => setRange(r.months)}
                    style={{ background: range === r.months ? 'var(--ink)' : 'transparent',
                             color: range === r.months ? 'var(--paper)' : 'var(--ink-2)',
                             borderColor: range === r.months ? 'var(--ink)' : 'var(--rule)',
                             padding:'4px 10px' }}>{r.label}</button>
                ))}
              </div>
            </div>
            <PriceChart points={rangedPoints} unitLabel={unitLabel} />
          </div>

          {/* Supplier rollup */}
          <div className="card" style={{ marginTop:24, padding:0, overflow:'auto' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--rule)' }}>
              <h3 className="h-card">Supplier ที่เคยขายรายการนี้ · {supplierRows.length} ราย</h3>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th className="num-col">ราคาล่าสุด (net)</th>
                  <th className="num-col">ราคาเฉลี่ย 90 วัน</th>
                  <th className="num-col">จำนวนครั้งที่เสนอ</th>
                  <th>ที่มาล่าสุด</th>
                  <th>เครดิตเทอม</th>
                </tr>
              </thead>
              <tbody>
                {supplierRows.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                    ยังไม่มีข้อมูล — เพิ่มราคาจากปุ่ม "เพิ่มราคา" หรือดึงจาก RFQ
                  </td></tr>
                ) : supplierRows.map(r => (
                  <tr key={r.supId} style={{ background: r.supId === cheapest && supplierRows.length > 1 ? 'var(--moss-soft)' : undefined }}>
                    <td>
                      <span style={{ display:'inline-flex', gap:10, alignItems:'center' }}>
                        <Av initials={r.sup.slice(0,2)} kind={r.kind} />
                        <span style={{ fontWeight:500 }}>{r.sup}</span>
                        {r.supId === cheapest && supplierRows.length > 1 && (
                          <span style={{ fontSize:10, fontWeight:600, color:'var(--moss)' }}>ราคาต่ำสุด</span>
                        )}
                      </span>
                    </td>
                    <td className="num-col">
                      <div className="num" style={{ fontWeight:500 }}>{money(r.last)}</div>
                      <div style={{ fontSize:11, color:'var(--ink-3)' }}>{r.lastDate}</div>
                    </td>
                    <td className="num-col num">{r.avg != null ? money(r.avg) : '—'}</td>
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

        {/* Side column */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="card" style={{ background:'var(--surface-2)' }}>
            <div className="eyebrow" style={{ marginBottom:12 }}>สรุปข้อมูลวัสดุนี้</div>
            {allPoints.length === 0 ? (
              <div style={{ fontSize:12.5, color:'var(--ink-3)' }}>ยังไม่มีข้อมูลราคา</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10, fontSize:12.5 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'var(--ink-3)' }}>จุดข้อมูลทั้งหมด</span>
                  <strong className="num">{allPoints.length}</strong>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'var(--ink-3)' }}>ช่วงราคาทั้งหมด</span>
                  <strong className="num">{money(Math.min(...allPoints.map(p => p.price)))} – {money(Math.max(...allPoints.map(p => p.price)))}</strong>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'var(--ink-3)' }}>Supplier</span>
                  <strong className="num">{supplierRows.length} ราย</strong>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'var(--ink-3)' }}>ข้อมูลเก่าสุด</span>
                  <strong>{fmtThDate(allPoints[0].t)}</strong>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'var(--ink-3)' }}>อัพเดทล่าสุด</span>
                  <strong>{fmtThDate(allPoints[allPoints.length - 1].t)}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="h-card" style={{ marginBottom:12 }}>กิจกรรมล่าสุด</h3>
            {activities.length === 0 ? (
              <div style={{ textAlign:'center', padding:20, color:'var(--ink-3)', fontSize:12.5 }}>
                ยังไม่มีข้อมูล
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {activities.map((a, i) => (
                  <div key={i} style={{ display:'flex', gap:10, fontSize:12.5 }}>
                    <Av initials={(a.supName || '—').slice(0,2)} kind="company" />
                    <div style={{ flex:1 }}>
                      <div style={{ color:'var(--ink-2)' }}>
                        <strong style={{ color:'var(--ink)' }}>{a.supName}</strong>
                        {' '}เสนอราคา <span className="num" style={{ fontWeight:600 }}>{money(a.price)}</span>
                        {a.source === 'RFQ' && a.sourceRef ? ` (จาก ${a.sourceRef})` : ` (${a.source})`}
                      </div>
                      <div style={{ color:'var(--ink-4)', fontSize:11, marginTop:2 }}>{fmtThDate(a.t)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {manualOpen && (
        <ManualPriceModal
          materials={materials} suppliers={suppliers} units={units}
          initialMaterialId={material.id}
          onClose={() => setManualOpen(false)}
          onSaved={() => { setManualOpen(false); load(); }}
        />
      )}
    </div>
  );
}
