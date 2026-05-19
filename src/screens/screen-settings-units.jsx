'use client';
import React, { useState, useEffect } from 'react';
import { Icons } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle } from '../lib/settings-shared';

const TYPE_OPTIONS = ['count', 'length', 'area', 'volume', 'weight', 'time', 'other'];
const TYPE_LABEL = {
  count:  'นับชิ้น',
  length: 'ความยาว',
  area:   'พื้นที่',
  volume: 'ปริมาตร',
  weight: 'น้ำหนัก',
  time:   'เวลา',
  other:  'อื่นๆ',
};
const TYPE_BADGE = {
  count:  { bg:'var(--teal-soft)', fg:'var(--teal-ink)' },
  length: { bg:'#DEE7E3',          fg:'#1F4D40' },
  area:   { bg:'#E3EAD3',          fg:'#3D5224' },
  volume: { bg:'#F0E4C5',          fg:'#6B5121' },
  weight: { bg:'#EADBD3',          fg:'#6B3F2E' },
  time:   { bg:'var(--paper-2)',   fg:'var(--ink-2)' },
  other:  { bg:'var(--paper-2)',   fg:'var(--ink-3)' },
};

export function ScreenSettingsUnits() {
  const [units, setUnits]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [q, setQ]               = useState('');
  const [filter, setFilter]     = useState('ทั้งหมด');
  const [editing, setEditing]   = useState(null);   // null | 'new' | unit object

  async function load() {
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/units');
      const data = await res.json();
      if (!res.ok) setErr(data.error || 'โหลดข้อมูลไม่สำเร็จ');
      else setUnits(data.items || []);
    } catch {
      setErr('เครือข่ายขัดข้อง');
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function remove(u) {
    if (!confirm(`ลบหน่วย "${u.name}"?`)) return;
    try {
      const res = await fetch('/api/units', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'เกิดข้อผิดพลาด');
      }
    } catch { alert('เครือข่ายขัดข้อง'); }
    load();
  }

  const filtered = units.filter(u => {
    if (filter !== 'ทั้งหมด' && u.type !== filter) return false;
    if (q) {
      const s = q.toLowerCase();
      if (!(u.name?.toLowerCase().includes(s) || u.code?.toLowerCase().includes(s))) return false;
    }
    return true;
  });

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">ตั้งค่า · ข้อมูลหลัก</div>
          <h1 className="h-display">หน่วยนับ</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:600 }}>
            หน่วยนับสำหรับวัสดุและงานจ้าง เช่น ชิ้น เมตร ตารางเมตร กิโลกรัม ฯลฯ
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn primary" onClick={() => setEditing('new')}>{Icons.plus} เพิ่มหน่วย</button>
        </div>
      </div>

      <SettingsStatStrip stats={[
        { label:'หน่วยทั้งหมด', value: units.length, sub:`${units.filter(u=>u.active).length} ใช้งานอยู่` },
        { label:'นับชิ้น',     value: units.filter(u=>u.type==='count').length, sub:'เช่น ชิ้น, ใบ' },
        { label:'มิติ',         value: units.filter(u=>['length','area','volume'].includes(u.type)).length, sub:'ยาว · พื้นที่ · ปริมาตร' },
        { label:'น้ำหนัก',     value: units.filter(u=>u.type==='weight').length, sub:'กก., ตัน' },
      ]} />

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {['ทั้งหมด', ...TYPE_OPTIONS].map(f => (
            <button key={f} onClick={() => setFilter(f)} className="btn sm" style={{
              background: filter === f ? 'var(--ink)' : 'transparent',
              color: filter === f ? 'var(--paper)' : 'var(--ink-2)',
              borderColor: filter === f ? 'var(--ink)' : 'var(--rule)',
              padding:'5px 12px',
            }}>{f === 'ทั้งหมด' ? f : TYPE_LABEL[f]}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหาหน่วย…" />
          <span style={{ fontSize:12, color:'var(--ink-3)' }}>
            แสดง <strong style={{ color:'var(--ink)' }}>{filtered.length}</strong> รายการ
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
              <th style={{ width:'15%' }}>รหัส/สัญลักษณ์</th>
              <th>ชื่อหน่วย</th>
              <th>ประเภท</th>
              <th>สถานะ</th>
              <th style={{ width:80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล — คลิก "เพิ่มหน่วย" เพื่อสร้างรายการแรก
              </td></tr>
            ) : filtered.map(u => {
              const c = TYPE_BADGE[u.type] || TYPE_BADGE.other;
              return (
                <tr key={u.id}>
                  <td className="font-mono" style={{ fontSize:14, color:'var(--ink)', fontWeight:500 }}>{u.code}</td>
                  <td style={{ fontWeight:500 }}>{u.name}</td>
                  <td>
                    <span style={{
                      display:'inline-block', padding:'2px 10px', borderRadius:999,
                      fontSize:11, fontWeight:500, background:c.bg, color:c.fg,
                    }}>{TYPE_LABEL[u.type] || u.type}</span>
                  </td>
                  <td><StatusPill status={u.active ? 'Active' : 'Non-Active'} /></td>
                  <td style={{ textAlign:'right' }}>
                    <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }} onClick={() => setEditing(u)} title="แก้ไข">{Icons.edit}</button>
                    <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--clay)' }} onClick={() => remove(u)} title="ลบ">×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <UnitModal
          unit={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function UnitModal({ unit, onClose, onSaved }) {
  const isEdit = !!unit;
  const [form, setForm] = useState({
    code:   unit?.code   || '',
    name:   unit?.name   || '',
    type:   unit?.type   || 'count',
    notes:  unit?.notes  || '',
    active: unit?.active !== false,
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
    const payload = isEdit ? { ...form, id: unit.id } : form;
    const res = await fetch('/api/units', {
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
    <SettingsModal eyebrow={isEdit ? 'แก้ไขหน่วย' : 'เพิ่มหน่วยใหม่'} title={isEdit ? unit.name : 'หน่วยใหม่'} onClose={onClose} width={520}>
      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:14 }}>
        <SettingsField label="รหัส/สัญลักษณ์" required hint="เช่น m, kg, ชิ้น">
          <input value={form.code} onChange={e=>set('code', e.target.value)} placeholder="m" style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
        </SettingsField>
        <SettingsField label="ชื่อหน่วย" required>
          <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เช่น เมตร" style={settingsInputStyle} />
        </SettingsField>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="ประเภท">
            <select value={form.type} onChange={e=>set('type', e.target.value)} style={settingsInputStyle}>
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </SettingsField>
        </div>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="หมายเหตุ">
            <input value={form.notes} onChange={e=>set('notes', e.target.value)} placeholder="(ไม่บังคับ)" style={settingsInputStyle} />
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
