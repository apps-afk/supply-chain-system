'use client';
import React, { useState, useEffect } from 'react';
import { Icons } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle, BulkUploadModal } from '../lib/settings-shared';

// Auto-code helpers — same pattern as Suppliers (scan max numeric suffix).
function nextMaterialCode(existing) {
  let max = 0;
  for (const c of existing || []) {
    const m = /^MAT-(\d+)$/.exec(String(c).trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `MAT-${String(max + 1).padStart(5, '0')}`;
}

/*
  Settings → Material List
  Data is now stored in DB and fetched from /api/materials.
  Whitelisted fields: code, name, category, unit_id, spec, notes, active.
  Category is a flat free-text field per row (no nested category master).
*/

// NOTE: stub kept for backwards compatibility.
// MATERIAL_CATEGORIES is now derived dynamically from materials rows in the DB;
// consumers (RFQ/Compare) should migrate to fetching `/api/materials` directly.
export const MATERIAL_CATEGORIES = [];

export function ScreenSettingsMaterials({ go }) {
  const [items, setItems]     = useState([]);
  const [units, setUnits]     = useState([]);
  const [mainCats, setMainCats] = useState([]);
  const [subCats,  setSubCats]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [q, setQ]             = useState('');
  const [filter, setFilter]   = useState('ทั้งหมด');
  const [catFilter, setCatFilter] = useState('ทั้งหมด');
  const [mainCatFilter, setMainCatFilter] = useState('ทั้งหมด');
  const [editing, setEditing] = useState(null); // null | 'new' | object
  const [bulkOpen, setBulkOpen] = useState(false);

  async function load() {
    setLoading(true); setErr('');
    try {
      const [mRes, uRes, mcRes, scRes] = await Promise.all([
        fetch('/api/materials'),
        fetch('/api/units'),
        fetch('/api/material-main-categories'),
        fetch('/api/material-sub-categories'),
      ]);
      const m  = await mRes.json();
      const u  = await uRes.json();
      const mc = await mcRes.json();
      const sc = await scRes.json();
      if (!mRes.ok) setErr(m.error || 'โหลดข้อมูลไม่สำเร็จ');
      else setItems(m.items || []);
      if (uRes.ok) setUnits(u.items || []);
      if (mcRes.ok) setMainCats(mc.items || []);
      if (scRes.ok) setSubCats(sc.items || []);
    } catch {
      setErr('เครือข่ายขัดข้อง');
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function remove(it) {
    if (!confirm(`ลบวัสดุ "${it.name}"?`)) return;
    try {
      const res = await fetch('/api/materials', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: it.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'เกิดข้อผิดพลาด');
      }
    } catch { alert('เครือข่ายขัดข้อง'); }
    load();
  }

  const unitsById = Object.fromEntries(units.map(u => [u.id, u]));
  // Categories now come from the dedicated master tables (Level 1 + Level 2
  // managed in their own sidebar pages). Each material row still carries
  // the string copy for backward compat with legacy data + bulk uploads.
  const mainCategories = mainCats.filter(m => m.active).map(m => m.name).sort();
  const mainByName = Object.fromEntries(mainCats.map(m => [m.name, m]));
  const subsByMainId = subCats.reduce((acc, s) => {
    (acc[s.main_id] = acc[s.main_id] || []).push(s);
    return acc;
  }, {});
  // Filter list of sub-categories depends on which main is selected.
  const categories = (() => {
    if (mainCatFilter === 'ทั้งหมด') return Array.from(new Set(subCats.filter(s => s.active).map(s => s.name))).sort();
    const main = mainByName[mainCatFilter];
    if (!main) return [];
    return (subsByMainId[main.id] || []).filter(s => s.active).map(s => s.name).sort();
  })();

  const filtered = items.filter(p => {
    const status = p.active ? 'Active' : 'Non-Active';
    if (filter !== 'ทั้งหมด' && status !== filter) return false;
    if (mainCatFilter !== 'ทั้งหมด' && p.main_category !== mainCatFilter) return false;
    if (catFilter !== 'ทั้งหมด' && p.category !== catFilter) return false;
    if (q) {
      const s = q.toLowerCase();
      if (!(p.name?.toLowerCase().includes(s) || p.code?.toLowerCase().includes(s) || p.spec?.toLowerCase().includes(s))) return false;
    }
    return true;
  });

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Settings · Master Data</div>
          <h1 className="h-display">วัสดุ (Material List)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:600 }}>
            คลังกลางของวัสดุทุกประเภท
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" onClick={() => setBulkOpen(true)}>{Icons.upload} Bulk Upload</button>
          <button className="btn primary" onClick={() => setEditing('new')}>{Icons.plus} เพิ่มวัสดุ</button>
        </div>
      </div>

      <SettingsStatStrip stats={[
        { label:'วัสดุทั้งหมด',  value: items.length, sub:`${items.filter(p=>p.active).length} Active` },
        { label:'หมวดหลัก',     value: mainCats.length, sub: <button onClick={() => go('settings-material-main-categories')} style={{ background:'none', border:0, padding:0, color:'var(--teal)', textDecoration:'underline', cursor:'pointer', fontFamily:'inherit', fontSize:12 }}>จัดการ Level 1</button> },
        { label:'หมวดย่อย',     value: subCats.length, sub: <button onClick={() => go('settings-material-sub-categories')} style={{ background:'none', border:0, padding:0, color:'var(--teal)', textDecoration:'underline', cursor:'pointer', fontFamily:'inherit', fontSize:12 }}>จัดการ Level 2</button> },
      ]} />

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4 }}>
          {['ทั้งหมด','Active','Non-Active'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className="btn sm" style={{
              background: filter === f ? 'var(--ink)' : 'transparent',
              color: filter === f ? 'var(--paper)' : 'var(--ink-2)',
              borderColor: filter === f ? 'var(--ink)' : 'var(--rule)',
              padding:'5px 12px',
            }}>{f}</button>
          ))}
        </div>
        {mainCategories.length > 0 && (
          <select value={mainCatFilter} onChange={e=>{ setMainCatFilter(e.target.value); setCatFilter('ทั้งหมด'); }} style={{ ...settingsInputStyle, width:'auto', padding:'5px 10px', fontSize:12 }}>
            <option>ทั้งหมด</option>
            {mainCategories.map(c => <option key={c}>{c}</option>)}
          </select>
        )}
        {categories.length > 0 && (
          <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={{ ...settingsInputStyle, width:'auto', padding:'5px 10px', fontSize:12 }}>
            <option>ทั้งหมด</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหาวัสดุ…" />
          <span style={{ fontSize:12, color:'var(--ink-3)' }}>
            <strong style={{ color:'var(--ink)' }}>{filtered.length}</strong> รายการ
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
              <th style={{ width:110 }}>รหัส</th>
              <th style={{ width:130 }}>หมวดหลัก</th>
              <th style={{ width:130 }}>หมวดย่อย</th>
              <th>ชื่อวัสดุ (Item)</th>
              <th>Spec</th>
              <th style={{ width:90 }}>หน่วย</th>
              <th style={{ width:110 }}>สถานะ</th>
              <th style={{ width:80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล — คลิก "เพิ่มวัสดุ" เพื่อสร้างรายการแรก
              </td></tr>
            ) : filtered.map(p => {
              const unit = unitsById[p.unit_id];
              return (
                <tr key={p.id}>
                  <td className="font-mono" style={{ fontSize:12, color:'var(--ink-2)', fontWeight:500 }}>{p.code}</td>
                  <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>
                    {p.main_category ? (
                      <span style={{ padding:'2px 8px', borderRadius:4, background:'#E3EAD3', color:'#3D5224', fontSize:11.5, fontWeight:500 }}>{p.main_category}</span>
                    ) : '—'}
                  </td>
                  <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>
                    {p.category ? (
                      <span style={{ padding:'2px 8px', borderRadius:4, background:'var(--teal-soft)', color:'var(--teal-ink)', fontSize:11.5, fontWeight:500 }}>{p.category}</span>
                    ) : '—'}
                  </td>
                  <td style={{ fontWeight:500 }}>{p.name}</td>
                  <td style={{ fontSize:12.5, color:'var(--ink-3)' }}>{p.spec || '—'}</td>
                  <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{unit ? unit.name : (p.unit_id || '—')}</td>
                  <td><StatusPill status={p.active ? 'Active' : 'Non-Active'} /></td>
                  <td style={{ textAlign:'right' }}>
                    <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }} onClick={() => setEditing(p)} title="แก้ไข">{Icons.edit}</button>
                    <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--clay)' }} onClick={() => remove(p)} title="ลบ">×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <MaterialModal
          item={editing === 'new' ? null : editing}
          units={units}
          mainCats={mainCats}
          subCats={subCats}
          existingCodes={items.map(i => i.code).filter(Boolean)}
          go={go}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {bulkOpen && (
        <BulkUploadModal
          title="Bulk Upload วัสดุ"
          entity="วัสดุ"
          endpoint="/api/materials"
          columns={[
            { key:'main_category', label:'หมวดหลัก',   required:true, hint:'Level 1' },
            { key:'category',      label:'หมวดย่อย',   required:true, hint:'Level 2' },
            { key:'name',          label:'ชื่อวัสดุ',   required:true, hint:'Level 3 (Item)' },
            { key:'spec',          label:'Spec' },
            { key:'unit',          label:'หน่วย',      hint:'code เช่น m, kg' },
            { key:'status',        label:'สถานะ',      hint:'Active / Non-Active' },
          ]}
          sampleRow="หมวดหลัก	หมวดย่อย	ชื่อวัสดุ	Spec	หน่วย	สถานะ
งานโครงสร้าง	เสาเข็ม	เสาเข็มตัวไอ I-22	22 x 22 cm	เส้น	Active
งานโครงสร้าง	คอนกรีต	คอนกรีตผสมเสร็จ 240ksc	240 ksc	ลบ.ม.	Active"
          transform={(row, ctx) => {
            const allCodes = [...items.map(i => i.code).filter(Boolean), ...ctx.usedCodes];
            const code = nextMaterialCode(allCodes);
            // Look up unit by code or alias
            const uCode = (row.unit || '').toLowerCase().trim();
            const unit = units.find(u => (u.code || '').toLowerCase() === uCode
              || (u.aliases || '').toLowerCase().split(',').map(a => a.trim()).includes(uCode));
            const active = (row.status || 'Active').toLowerCase() !== 'non-active';
            return {
              code,
              main_category: row.main_category || '',
              category: row.category || '',
              name: row.name,
              spec: row.spec || '',
              unit_id: unit?.id || null,
              active,
            };
          }}
          onClose={() => setBulkOpen(false)}
          onDone={() => { load(); }}
        />
      )}
    </div>
  );
}

function MaterialModal({ item, units, mainCats, subCats, existingCodes, go, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    code:          item?.code          || nextMaterialCode(existingCodes),
    name:          item?.name          || '',
    main_category: item?.main_category || '',
    category:      item?.category      || '',
    unit_id:       item?.unit_id       || '',
    spec:          item?.spec          || '',
    notes:         item?.notes         || '',
    active:        item?.active !== false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Pull options from the FK-linked masters. Sub list filters by the
  // currently-selected main so the user only sees valid pairs.
  const activeMains = (mainCats || []).filter(m => m.active);
  const currentMain = (mainCats || []).find(m => m.name === form.main_category);
  const activeSubs  = (subCats || []).filter(s => s.active && (!currentMain || s.main_id === currentMain.id));

  async function save() {
    setErr('');
    if (!form.main_category.trim() || !form.category.trim() || !form.name.trim()) {
      setErr('กรอกหมวดหลัก / หมวดย่อย / ชื่อวัสดุให้ครบ'); return;
    }
    setBusy(true);
    const payload = {
      code:          form.code,
      name:          form.name,
      main_category: form.main_category,
      category:      form.category,
      unit_id:       form.unit_id || null,
      spec:          form.spec,
      notes:         form.notes,
      active:        form.active,
    };
    if (isEdit) payload.id = item.id;
    const res = await fetch('/api/materials', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || 'บันทึกไม่สำเร็จ'); setBusy(false); return; }
    setBusy(false);
    onSaved();
  }

  return (
    <SettingsModal eyebrow={isEdit ? 'แก้ไขวัสดุ' : 'เพิ่มวัสดุใหม่'} title={isEdit ? item.name : 'วัสดุใหม่'} onClose={onClose} width={620}>
      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:14 }}>
        <SettingsField label="รหัส" hint={isEdit ? 'แก้ไม่ได้' : 'ระบบสร้างให้อัตโนมัติ'}>
          <input value={form.code} readOnly disabled
            style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)', background:'var(--paper-2)', color:'var(--ink-3)' }} />
        </SettingsField>
        <SettingsField label="หมวดหลัก (Level 1)" required
          hint={<span>เพิ่มได้ที่ <button type="button" onClick={()=>go('settings-material-main-categories')} style={{ background:'none', border:0, padding:0, color:'var(--teal)', textDecoration:'underline', cursor:'pointer' }}>จัดการหมวดหลัก</button></span>}>
          <select value={form.main_category}
            onChange={e=>setForm(f => ({ ...f, main_category: e.target.value, category: '' }))}
            style={settingsInputStyle}>
            <option value="">— เลือกหมวดหลัก —</option>
            {activeMains.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </SettingsField>
        <SettingsField label="หมวดย่อย (Level 2)" required
          hint={<span>เพิ่มได้ที่ <button type="button" onClick={()=>go('settings-material-sub-categories')} style={{ background:'none', border:0, padding:0, color:'var(--teal)', textDecoration:'underline', cursor:'pointer' }}>จัดการหมวดย่อย</button></span>}>
          <select value={form.category}
            onChange={e=>set('category', e.target.value)}
            disabled={!form.main_category}
            style={settingsInputStyle}>
            <option value="">{form.main_category ? '— เลือกหมวดย่อย —' : '(เลือกหมวดหลักก่อน)'}</option>
            {activeSubs.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </SettingsField>
        <SettingsField label="ชื่อวัสดุ (Item)" required hint="Level 3 — รายการสุดท้าย">
          <input value={form.name} onChange={e=>set('name', e.target.value)}
            placeholder="เช่น เสาเข็มตัวไอ I-22" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="หน่วย">
          <select value={form.unit_id} onChange={e=>set('unit_id', e.target.value)} style={settingsInputStyle}>
            <option value="">— เลือกหน่วย —</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
          </select>
        </SettingsField>
        <SettingsField label="Spec">
          <input value={form.spec} onChange={e=>set('spec', e.target.value)} placeholder="คุณลักษณะ / รุ่น / Grade" style={settingsInputStyle} />
        </SettingsField>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="หมายเหตุ">
            <textarea value={form.notes} onChange={e=>set('notes', e.target.value)}
                      placeholder="(ไม่บังคับ)"
                      style={{ ...settingsInputStyle, minHeight:60, resize:'vertical', fontFamily:'inherit' }} />
          </SettingsField>
        </div>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="สถานะ">
            <StatusToggle options={['Active','Non-Active']} value={form.active ? 'Active' : 'Non-Active'} onChange={v => set('active', v === 'Active')} />
          </SettingsField>
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:20 }}>
        <button className="btn" onClick={onClose}>ยกเลิก</button>
        <button className="btn primary" onClick={save} disabled={busy}>
          {busy ? 'กำลังบันทึก…' : (isEdit ? 'บันทึก' : 'เพิ่ม')}
        </button>
      </div>
    </SettingsModal>
  );
}
