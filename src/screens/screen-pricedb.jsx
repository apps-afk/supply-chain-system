'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Icons, Chip, Stat, Spark, Delta, Av, money } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsSearchBox } from '../lib/settings-shared';

/*
  Price DB — list + detail.

  Backed by /api/prices (price_points table). Materials, suppliers, and units
  are pulled from their own master endpoints and joined client-side for display.
  Prices stored are NET — exclude VAT and Overhead.
*/

/* =================== Synthetic RFQ pool for "pull from RFQ" =================== */
const RECEIVED_RFQS_FOR_PRICEDB = [];

/* =================== List =================== */

export function ScreenPriceDB({ go }) {
  const [cat, setCat] = useState('ทั้งหมด');
  const [sourceFilter, setSourceFilter] = useState('ทั้งหมด'); // ทั้งหมด | Manual | RFQ
  const [q, setQ] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [rfqPullOpen, setRfqPullOpen] = useState(false);

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

  // Build display rows
  const rows = useMemo(() => prices.map(p => {
    const m = matById.get(p.material_id) || {};
    const s = supById.get(p.supplier_id) || {};
    const u = unitById.get(p.unit_id || m.unit_id) || {};
    const captured = p.captured_at ? new Date(p.captured_at) : null;
    const ageDays = captured ? Math.max(0, Math.round((Date.now() - captured.getTime()) / 86400000)) : 0;
    const source = (p.source && p.source.toLowerCase().includes('rfq')) ? 'RFQ' : (p.source || 'Manual');
    return {
      id:        p.id,
      code:      m.code || p.material_id,
      name:      m.name || '—',
      spec:      m.spec || '',
      cat:       m.category || '',
      unit:      u.name || u.code || m.unit_id || '',
      sup:       s.name || '—',
      supkind:   s.type || 'company',
      price:     Number(p.price) || 0,
      mom: 0, momDir: 'flat', yoy: 0, yoyDir: 'flat',
      spark:     [],
      date:      captured ? captured.toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' }) : '—',
      age:       ageDays,
      source,
      sourceRef: p.source_id || '',
      flag:      null,
    };
  }), [prices, matById, supById, unitById]);

  const filtered = useMemo(() => {
    const v = q.toLowerCase();
    return rows.filter(r => {
      if (cat !== 'ทั้งหมด' && r.cat !== cat) return false;
      if (sourceFilter !== 'ทั้งหมด' && r.source !== sourceFilter) return false;
      if (q) {
        if (!(r.name.includes(q) || (r.code||'').toLowerCase().includes(v) || (r.sup||'').includes(q))) return false;
      }
      return true;
    });
  }, [rows, cat, sourceFilter, q]);

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
          <button className="btn primary" onClick={() => setManualOpen(true)}>{Icons.plus} เพิ่มราคา</button>
          <button className="btn">{Icons.download} Export</button>
        </div>
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
          { label:'ขาขึ้น (YoY)',       value: '—',                 sub: 'ต้องการประวัติเทียบ' },
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
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                กำลังโหลด…
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล — คลิก "เพิ่มราคา" เพื่อสร้างรายการแรก
              </td></tr>
            ) : filtered.map((r, i) => (
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
          <span>แสดง {filtered.length === 0 ? 0 : 1}–{filtered.length} จาก {filtered.length} รายการ</span>
          <div style={{ display:'flex', gap:6 }}>
            <button className="btn sm" disabled>ก่อนหน้า</button>
            <button className="btn sm">ถัดไป {Icons.chevronR}</button>
          </div>
        </div>
      </div>

      {manualOpen  && <ManualPriceModal
        materials={materials} suppliers={suppliers} units={units}
        onClose={() => setManualOpen(false)}
        onSaved={() => { setManualOpen(false); load(); }} />}
      {rfqPullOpen && <PullFromRFQModal onClose={() => setRfqPullOpen(false)} />}
    </div>
  );
}

/* =================== Manual entry modal =================== */
function ManualPriceModal({ materials, suppliers, units, onClose, onSaved }) {
  const [form, setForm] = useState({
    materialId:'', supplierId:'', price:'', unitId:'', source:'Manual', sourceId:'',
  });
  const set = (k,v) => setForm({ ...form, [k]:v });
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
          <select value={form.unitId} onChange={e => set('unitId', e.target.value)} style={settingsInputStyle}>
            <option value="">— ใช้หน่วยจาก Material —</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.code ? `${u.code} · ` : ''}{u.name}</option>)}
          </select>
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

  // Pull the latest material for the detail header (chart/history stays placeholder).
  const [material, setMaterial] = useState(null);
  const [unit, setUnit]         = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const [mR, uR] = await Promise.all([
          fetch('/api/materials').then(r => r.json()),
          fetch('/api/units').then(r => r.json()),
        ]);
        const list = mR.items || [];
        const m = list[0] || null;
        setMaterial(m);
        if (m && m.unit_id) {
          setUnit((uR.items || []).find(u => u.id === m.unit_id) || null);
        }
      } catch {}
    })();
  }, []);

  const supplierRows = [];
  const activities = [];

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => go('pricedb')} style={{ marginBottom:20, marginLeft:-8 }}>
        {Icons.back} กลับไป Price Database
      </button>

      <div className="page-head" style={{ alignItems:'flex-start' }}>
        <div className="page-title">
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
            <span className="font-mono" style={{ fontSize:12, color:'var(--ink-3)' }}>{material?.code || '—'}</span>
            <span style={{ fontSize:11, padding:'1px 8px', borderRadius:3, background:'var(--paper-2)', color:'var(--ink-3)' }}>
              ราคาทั้งหมดเป็น net · ไม่รวม VAT/Overhead
            </span>
          </div>
          <h1 className="h-display">{material?.name || 'ยังไม่มีข้อมูล'}</h1>
          <div style={{ display:'flex', gap:24, marginTop:12, fontSize:13, color:'var(--ink-3)' }}>
            <span>หมวด: <strong style={{ color:'var(--ink-2)' }}>{material?.category || '—'}</strong></span>
            <span>หน่วย: <strong style={{ color:'var(--ink-2)' }}>{unit?.name || unit?.code || '—'}</strong></span>
            <span>Spec: <strong style={{ color:'var(--ink-2)' }}>{material?.spec || '—'}</strong></span>
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
                ราคาล่าสุด · <span style={{ color:'var(--ink-2)' }}>—</span>
              </div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:72, lineHeight:1, letterSpacing:'-0.02em' }}>
                ฿0<span style={{ fontFamily:'var(--font-sans)', fontSize:18, color:'var(--ink-3)', marginLeft:8 }}>/ —</span>
              </div>
              <div style={{ marginTop:12, display:'flex', gap:16, alignItems:'center' }}>
                <span style={{ fontSize:12, color:'var(--ink-3)' }}>ยังไม่มีข้อมูล</span>
              </div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:0, borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)', padding:'14px 0' }}>
                <Stat label="ต่ำสุด 90 วัน" value="—" sub="ยังไม่มีข้อมูล" />
                <Stat label="สูงสุด 90 วัน" value="—" sub="ยังไม่มีข้อมูล" />
                <Stat label="เฉลี่ย 90 วัน" value="—" sub="ยังไม่มีข้อมูล" />
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
            <div style={{ padding:40, textAlign:'center', color:'var(--ink-3)', fontSize:13 }}>
              ยังไม่มีข้อมูล
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
                {supplierRows.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                    ยังไม่มีข้อมูล
                  </td></tr>
                ) : supplierRows.map((r, i) => (
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
              —
            </div>
            <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:6 }}>ยังไม่มีข้อมูล</div>
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
                    <Av initials={a.who === 'System' ? 'IE' : a.who.slice(0,1)} kind={a.kind} />
                    <div style={{ flex:1 }}>
                      <div style={{ color:'var(--ink-2)' }}><strong style={{ color:'var(--ink)' }}>{a.who}</strong> {a.what}</div>
                      <div style={{ color:'var(--ink-4)', fontSize:11, marginTop:2 }}>{a.when}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

