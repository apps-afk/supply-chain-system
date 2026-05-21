'use client';
import React, { useState, useEffect } from 'react';
import { Icons } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle, BulkUploadModal } from '../lib/settings-shared';

function nextSubcontractCode(existing) {
  let max = 0;
  for (const c of existing || []) {
    const m = /^SUB-(\d+)$/.exec(String(c).trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `SUB-${String(max + 1).padStart(5, '0')}`;
}

/*
  Settings → SubContract List
  Data is now stored in DB and fetched from /api/subcontracts.
  Whitelisted fields: code, name, category, unit_id, notes, active.
  Category is a flat free-text field per row (no nested category master).
*/

// NOTE: stub kept for backwards compatibility.
// SUBCONTRACT_CATEGORIES is now derived dynamically from subcontracts rows in the DB;
// consumers (RFQ/Compare) should migrate to fetching `/api/subcontracts` directly.
export const SUBCONTRACT_CATEGORIES = [];

export function ScreenSettingsSubcontracts({ go }) {
  const [items, setItems]     = useState([]);
  const [units, setUnits]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [q, setQ]             = useState('');
  const [filter, setFilter]   = useState('ทั้งหมด');
  const [catFilter, setCatFilter] = useState('ทั้งหมด');
  const [editing, setEditing] = useState(null); // null | 'new' | object
  const [bulkOpen, setBulkOpen] = useState(false);

  async function load() {
    setLoading(true); setErr('');
    try {
      const [sRes, uRes] = await Promise.all([
        fetch('/api/subcontracts'),
        fetch('/api/units'),
      ]);
      const s = await sRes.json();
      const u = await uRes.json();
      if (!sRes.ok) setErr(s.error || 'โหลดข้อมูลไม่สำเร็จ');
      else setItems(s.items || []);
      if (uRes.ok) setUnits(u.items || []);
    } catch {
      setErr('เครือข่ายขัดข้อง');
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function remove(it) {
    if (!confirm(`ลบงานจ้าง "${it.name}"?`)) return;
    try {
      const res = await fetch('/api/subcontracts', {
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
      if (!(p.name?.toLowerCase().includes(s) || p.code?.toLowerCase().includes(s))) return false;
    }
    return true;
  });

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Settings · Master Data</div>
          <h1 className="h-display">งานจ้างเหมา (SubContract List)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:600 }}>
            งานจ้างผู้รับเหมาแยกตามประเภทงาน
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" onClick={() => setBulkOpen(true)}>{Icons.upload} Bulk Upload</button>
          <button className="btn primary" onClick={() => setEditing('new')}>{Icons.plus} เพิ่มงานจ้าง</button>
        </div>
      </div>

      <SettingsStatStrip stats={[
        { label:'งานจ้างทั้งหมด', value: items.length, sub:`${items.filter(p=>p.active).length} Active` },
        { label:'ประเภทงาน',     value: categories.length, sub:'ที่ใช้งานอยู่' },
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
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหางานจ้าง…" />
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
              <th>ชื่องานจ้าง</th>
              <th style={{ width:160 }}>ประเภทงาน</th>
              <th style={{ width:100 }}>หน่วย</th>
              <th style={{ width:120 }}>สถานะ</th>
              <th style={{ width:80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล — คลิก "เพิ่มงานจ้าง" เพื่อสร้างรายการแรก
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
        <SubcontractModal
          item={editing === 'new' ? null : editing}
          units={units}
          existingCategories={categories}
          existingCodes={items.map(i => i.code).filter(Boolean)}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {bulkOpen && (
        <BulkUploadModal
          title="Bulk Upload งานจ้างเหมา"
          entity="งานจ้าง"
          endpoint="/api/subcontracts"
          columns={[
            { key:'category', label:'Category',      required:true, hint:'Level 1',
              options: categories },
            { key:'name',     label:'ชื่องานจ้าง',     required:true, hint:'Level 2 (Item)' },
            { key:'unit',     label:'หน่วย',          hint:'code เช่น m, ครั้ง',
              options: units.filter(u => u.active).map(u => u.code) },
            { key:'status',   label:'สถานะ',          hint:'Active / Non-Active',
              options:['Active', 'Non-Active'] },
          ]}
          sampleRow="Category	ชื่องานจ้าง	หน่วย	สถานะ
จ้างออกแบบ	จ้างออกแบบงานวิศวกรรม	งาน	Active
งานโครงสร้าง	งานเสาเข็มตอก	เส้น	Active"
          transform={(row, ctx) => {
            const allCodes = [...items.map(i => i.code).filter(Boolean), ...ctx.usedCodes];
            const code = nextSubcontractCode(allCodes);
            const uCode = (row.unit || '').toLowerCase().trim();
            const unit = units.find(u => (u.code || '').toLowerCase() === uCode
              || (u.aliases || '').toLowerCase().split(',').map(a => a.trim()).includes(uCode));
            const active = (row.status || 'Active').toLowerCase() !== 'non-active';
            return {
              code,
              category: row.category || '',
              name: row.name,
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

function SubcontractModal({ item, units, existingCategories, existingCodes, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    code:     item?.code || nextSubcontractCode(existingCodes),
    name:     item?.name     || '',
    category: item?.category || '',
    unit_id:  item?.unit_id  || '',
    notes:    item?.notes    || '',
    active:   item?.active !== false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    setErr('');
    if (!form.name.trim() || !form.category.trim()) {
      setErr('กรอก Category และชื่องานจ้างให้ครบ'); return;
    }
    setBusy(true);
    const payload = {
      code:     form.code,
      name:     form.name,
      category: form.category,
      unit_id:  form.unit_id || null,
      notes:    form.notes,
      active:   form.active,
    };
    if (isEdit) payload.id = item.id;
    const res = await fetch('/api/subcontracts', {
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
    <SettingsModal eyebrow={isEdit ? 'แก้ไขงานจ้าง' : 'เพิ่มงานจ้างใหม่'} title={isEdit ? item.name : 'งานจ้างใหม่'} onClose={onClose} width={600}>
      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:14 }}>
        <SettingsField label="รหัส" hint={isEdit ? 'แก้ไม่ได้' : 'ระบบสร้างให้อัตโนมัติ'}>
          <input value={form.code} readOnly disabled
            style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)', background:'var(--paper-2)', color:'var(--ink-3)' }} />
        </SettingsField>
        <SettingsField label="Category (Level 1)" required hint="พิมพ์เพื่อสร้างใหม่ เช่น จ้างออกแบบ">
          <input list="subcontract-cats" value={form.category} onChange={e=>set('category', e.target.value)} placeholder="เช่น จ้างออกแบบ" style={settingsInputStyle} />
          <datalist id="subcontract-cats">
            {existingCategories.map(c => <option key={c} value={c} />)}
          </datalist>
        </SettingsField>
        <SettingsField label="ชื่องานจ้าง (Item)" required hint="Level 2 — รายการสุดท้าย">
          <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เช่น จ้างออกแบบงานวิศวกรรม" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="หน่วย">
          <select value={form.unit_id} onChange={e=>set('unit_id', e.target.value)} style={settingsInputStyle}>
            <option value="">— เลือกหน่วย —</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
          </select>
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
