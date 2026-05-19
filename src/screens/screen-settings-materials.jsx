'use client';
import React, { useState, useEffect } from 'react';
import { Icons } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle } from '../lib/settings-shared';

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
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [q, setQ]             = useState('');
  const [filter, setFilter]   = useState('ทั้งหมด');
  const [catFilter, setCatFilter] = useState('ทั้งหมด');
  const [editing, setEditing] = useState(null); // null | 'new' | object

  async function load() {
    setLoading(true); setErr('');
    try {
      const [mRes, uRes] = await Promise.all([
        fetch('/api/materials'),
        fetch('/api/units'),
      ]);
      const m = await mRes.json();
      const u = await uRes.json();
      if (!mRes.ok) setErr(m.error || 'โหลดข้อมูลไม่สำเร็จ');
      else setItems(m.items || []);
      if (uRes.ok) setUnits(u.items || []);
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
  const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort();

  const filtered = items.filter(p => {
    const status = p.active ? 'Active' : 'Non-Active';
    if (filter !== 'ทั้งหมด' && status !== filter) return false;
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
          <button className="btn primary" onClick={() => setEditing('new')}>{Icons.plus} เพิ่มวัสดุ</button>
        </div>
      </div>

      <SettingsStatStrip stats={[
        { label:'วัสดุทั้งหมด', value: items.length, sub:`${items.filter(p=>p.active).length} Active` },
        { label:'หมวดงาน',     value: categories.length, sub:'ที่ใช้งานอยู่' },
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
              <th style={{ width:120 }}>รหัส</th>
              <th>ชื่อวัสดุ</th>
              <th style={{ width:140 }}>หมวด</th>
              <th>Spec</th>
              <th style={{ width:100 }}>หน่วย</th>
              <th style={{ width:120 }}>สถานะ</th>
              <th style={{ width:80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล — คลิก "เพิ่มวัสดุ" เพื่อสร้างรายการแรก
              </td></tr>
            ) : filtered.map(p => {
              const unit = unitsById[p.unit_id];
              return (
                <tr key={p.id}>
                  <td className="font-mono" style={{ fontSize:12, color:'var(--ink-2)', fontWeight:500 }}>{p.code}</td>
                  <td style={{ fontWeight:500 }}>{p.name}</td>
                  <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>
                    {p.category ? (
                      <span style={{ padding:'2px 8px', borderRadius:4, background:'var(--teal-soft)', color:'var(--teal-ink)', fontSize:11.5, fontWeight:500 }}>{p.category}</span>
                    ) : '—'}
                  </td>
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
          existingCategories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function MaterialModal({ item, units, existingCategories, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    code:     item?.code     || '',
    name:     item?.name     || '',
    category: item?.category || '',
    unit_id:  item?.unit_id  || '',
    spec:     item?.spec     || '',
    notes:    item?.notes    || '',
    active:   item?.active !== false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    setErr('');
    if (!form.code.trim() || !form.name.trim()) {
      setErr('กรอกรหัสและชื่อให้ครบ'); return;
    }
    setBusy(true);
    const payload = {
      code:     form.code,
      name:     form.name,
      category: form.category,
      unit_id:  form.unit_id || null,
      spec:     form.spec,
      notes:    form.notes,
      active:   form.active,
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
    <SettingsModal eyebrow={isEdit ? 'แก้ไขวัสดุ' : 'เพิ่มวัสดุใหม่'} title={isEdit ? item.name : 'วัสดุใหม่'} onClose={onClose} width={600}>
      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:14 }}>
        <SettingsField label="รหัส" required hint="เช่น MAT-00001">
          <input value={form.code} onChange={e=>set('code', e.target.value)} placeholder="MAT-00001" style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
        </SettingsField>
        <SettingsField label="ชื่อวัสดุ" required>
          <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เช่น ปูนซีเมนต์ ตรา SCG" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="หมวด" hint="พิมพ์เพื่อสร้างใหม่">
          <input list="material-cats" value={form.category} onChange={e=>set('category', e.target.value)} placeholder="เช่น งานโครงสร้าง" style={settingsInputStyle} />
          <datalist id="material-cats">
            {existingCategories.map(c => <option key={c} value={c} />)}
          </datalist>
        </SettingsField>
        <SettingsField label="หน่วย">
          <select value={form.unit_id} onChange={e=>set('unit_id', e.target.value)} style={settingsInputStyle}>
            <option value="">— เลือกหน่วย —</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
          </select>
        </SettingsField>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="Spec">
            <input value={form.spec} onChange={e=>set('spec', e.target.value)} placeholder="คุณลักษณะ / รุ่น / Grade" style={settingsInputStyle} />
          </SettingsField>
        </div>
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
