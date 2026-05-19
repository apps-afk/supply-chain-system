'use client';
import React, { useState, useEffect } from 'react';
import { Icons } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle } from '../lib/settings-shared';

/*
  Settings → Project Type List
  Single-level master — used by Projects page to pick type.
  Data is now stored in DB and fetched from /api/project-types.
*/

// NOTE: stub kept for backwards compatibility.
// PROJECT_TYPES_DATA is now stored in the DB; consumers should migrate to
// fetching from `/api/project-types` directly instead of importing this constant.
export const PROJECT_TYPES_DATA = [];

export function ScreenSettingsProjectTypes({ go }) {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]       = useState('');
  const [q, setQ]           = useState('');
  const [filter, setFilter] = useState('ทั้งหมด');
  const [editing, setEditing] = useState(null); // null | 'new' | object

  async function load() {
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/project-types');
      const data = await res.json();
      if (!res.ok) setErr(data.error || 'โหลดข้อมูลไม่สำเร็จ');
      else setItems(data.items || []);
    } catch {
      setErr('เครือข่ายขัดข้อง');
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function remove(p) {
    if (!confirm(`ลบประเภท "${p.name}"?`)) return;
    try {
      const res = await fetch('/api/project-types', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'เกิดข้อผิดพลาด');
      }
    } catch { alert('เครือข่ายขัดข้อง'); }
    load();
  }

  const filtered = items.filter(p => {
    const status = p.active ? 'Active' : 'Non-Active';
    if (filter !== 'ทั้งหมด' && status !== filter) return false;
    if (q && !(p.name?.toLowerCase().includes(q.toLowerCase()) || p.code?.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Settings · Master Data</div>
          <h1 className="h-display">ประเภทโครงการ (Project Type)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:600 }}>
            ใช้ในการแยกประเภทของโครงการ
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn primary" onClick={() => setEditing('new')}>{Icons.plus} เพิ่มประเภท</button>
        </div>
      </div>

      <SettingsStatStrip stats={[
        { label:'ประเภททั้งหมด', value: items.length, sub:`${items.filter(p=>p.active).length} Active` },
      ]} />

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16 }}>
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
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหาประเภท…" />
        </div>
      </div>

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>
      )}

      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:100 }}>รหัส</th>
              <th style={{ width:'24%' }}>ชื่อประเภท</th>
              <th>คำอธิบาย</th>
              <th style={{ width:120 }}>สถานะ</th>
              <th style={{ width:80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล — คลิก "เพิ่มประเภท" เพื่อสร้างรายการแรก
              </td></tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td className="font-mono" style={{ fontSize:12, color:'var(--ink-2)', fontWeight:500 }}>{p.code}</td>
                <td style={{ fontWeight:500 }}>{p.name}</td>
                <td style={{ fontSize:12.5, color:'var(--ink-3)' }}>{p.description}</td>
                <td><StatusPill status={p.active ? 'Active' : 'Non-Active'} /></td>
                <td style={{ textAlign:'right' }}>
                  <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }} onClick={() => setEditing(p)} title="แก้ไข">{Icons.edit}</button>
                  <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--clay)' }} onClick={() => remove(p)} title="ลบ">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProjectTypeModal
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ProjectTypeModal({ item, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    code:        item?.code        || '',
    name:        item?.name        || '',
    description: item?.description || '',
    active:      item?.active !== false,
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
    const payload = isEdit ? { ...form, id: item.id } : form;
    const res = await fetch('/api/project-types', {
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
    <SettingsModal eyebrow={isEdit ? 'แก้ไขประเภทโครงการ' : 'เพิ่มประเภทโครงการ'} title={isEdit ? item.name : 'ประเภทใหม่'} onClose={onClose} width={520}>
      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:14 }}>
        <SettingsField label="รหัส" required hint="เช่น PT-001">
          <input value={form.code} onChange={e=>set('code', e.target.value)} placeholder="PT-001" style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
        </SettingsField>
        <SettingsField label="ชื่อประเภท" required>
          <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เช่น Mixed-use" style={settingsInputStyle} />
        </SettingsField>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="คำอธิบาย">
            <input value={form.description} onChange={e=>set('description', e.target.value)} placeholder="คำอธิบายสั้น ๆ" style={settingsInputStyle} />
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
