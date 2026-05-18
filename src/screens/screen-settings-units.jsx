'use client';
import React, { useState } from 'react';
import { Icons } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle } from '../lib/settings-shared';

/*
  Settings → Unit List
  Reference: International System of Units (SI) — used as Master Data
  for unit fields in documents only. Kept intentionally minimal.
*/

const UNIT_DATA = [
  // SI base units
  { code:'U-001', symbol:'m',    name:'เมตร',          si:'SI Base',    status:'Active' },
  { code:'U-002', symbol:'kg',   name:'กิโลกรัม',      si:'SI Base',    status:'Active' },
  { code:'U-003', symbol:'s',    name:'วินาที',        si:'SI Base',    status:'Active' },
  // SI derived
  { code:'U-004', symbol:'m²',   name:'ตารางเมตร',     si:'SI Derived', status:'Active' },
  { code:'U-005', symbol:'m³',   name:'ลูกบาศก์เมตร',  si:'SI Derived', status:'Active' },
  // Common prefixed
  { code:'U-006', symbol:'mm',   name:'มิลลิเมตร',     si:'SI Prefix',  status:'Active' },
  { code:'U-007', symbol:'cm',   name:'เซนติเมตร',     si:'SI Prefix',  status:'Active' },
  { code:'U-008', symbol:'km',   name:'กิโลเมตร',      si:'SI Prefix',  status:'Active' },
  { code:'U-009', symbol:'g',    name:'กรัม',          si:'SI Prefix',  status:'Active' },
  { code:'U-010', symbol:'t',    name:'ตัน',           si:'SI Prefix',  status:'Active' },
  // Accepted with SI
  { code:'U-011', symbol:'L',    name:'ลิตร',          si:'Accepted',   status:'Active' },
  { code:'U-012', symbol:'h',    name:'ชั่วโมง',       si:'Accepted',   status:'Active' },
  { code:'U-013', symbol:'min',  name:'นาที',          si:'Accepted',   status:'Active' },
  { code:'U-014', symbol:'d',    name:'วัน',           si:'Accepted',   status:'Active' },
  // Construction trade units (non-SI but standard in industry)
  { code:'U-015', symbol:'ถุง',  name:'ถุง',           si:'Trade',      status:'Active' },
  { code:'U-016', symbol:'เส้น', name:'เส้น',          si:'Trade',      status:'Active' },
  { code:'U-017', symbol:'ก้อน', name:'ก้อน',          si:'Trade',      status:'Active' },
  { code:'U-018', symbol:'แผ่น', name:'แผ่น',          si:'Trade',      status:'Active' },
  { code:'U-019', symbol:'ม้วน', name:'ม้วน',          si:'Trade',      status:'Active' },
  { code:'U-020', symbol:'ชุด',  name:'ชุด',           si:'Trade',      status:'Active' },
  { code:'U-021', symbol:'ชิ้น', name:'ชิ้น',          si:'Trade',      status:'Active' },
  { code:'U-022', symbol:'ตัว',  name:'ตัว',           si:'Trade',      status:'Active' },
  { code:'U-023', symbol:'จุด',  name:'จุด',           si:'Trade',      status:'Active' },
  { code:'U-024', symbol:'งวด',  name:'งวด',           si:'Trade',      status:'Active' },
];

const SI_BADGE_COLOR = {
  'SI Base':    { bg:'var(--teal-soft)',  fg:'var(--teal-ink)' },
  'SI Derived': { bg:'#DEE7E3',           fg:'#1F4D40' },
  'SI Prefix':  { bg:'#E3EAD3',           fg:'#3D5224' },
  'Accepted':   { bg:'#F0E4C5',           fg:'#6B5121' },
  'Trade':      { bg:'var(--paper-2)',    fg:'var(--ink-3)' },
};

export function ScreenSettingsUnits({ go }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('ทั้งหมด');
  const [addOpen, setAddOpen] = useState(false);

  const filtered = UNIT_DATA.filter(u => {
    if (filter !== 'ทั้งหมด' && u.si !== filter) return false;
    if (q && !(u.name.includes(q) || u.symbol.toLowerCase().includes(q.toLowerCase()) || u.code.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Settings · Master Data</div>
          <h1 className="h-display">หน่วยนับ (Unit List)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:600 }}>
            อ้างอิงตามมาตรฐาน <strong style={{ color:'var(--ink-2)' }}>SI (International System of Units)</strong> — ใช้กำหนดหน่วยในเอกสารทุกฉบับ
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn primary" onClick={() => setAddOpen(true)}>{Icons.plus} เพิ่มหน่วย</button>
        </div>
      </div>

      <SettingsStatStrip stats={[
        { label:'หน่วยทั้งหมด',    value: UNIT_DATA.length, sub:`${UNIT_DATA.filter(u=>u.status==='Active').length} Active` },
        { label:'SI Base',         value: UNIT_DATA.filter(u=>u.si==='SI Base').length, sub:'หน่วยฐาน — m, kg, s' },
        { label:'SI Derived',      value: UNIT_DATA.filter(u=>u.si==='SI Derived').length, sub:'หน่วยอนุพันธ์ — m², m³' },
        { label:'Trade Units',     value: UNIT_DATA.filter(u=>u.si==='Trade').length, sub:'หน่วยมาตรฐานในวงการก่อสร้าง' },
      ]} />

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {['ทั้งหมด','SI Base','SI Derived','SI Prefix','Accepted','Trade'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className="btn sm" style={{
              background: filter === f ? 'var(--ink)' : 'transparent',
              color: filter === f ? 'var(--paper)' : 'var(--ink-2)',
              borderColor: filter === f ? 'var(--ink)' : 'var(--rule)',
              padding:'5px 12px',
            }}>{f}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหาหน่วย…" />
          <span style={{ fontSize:12, color:'var(--ink-3)' }}>
            แสดง <strong style={{ color:'var(--ink)' }}>{filtered.length}</strong> รายการ
          </span>
        </div>
      </div>

      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:'10%' }}>รหัส</th>
              <th style={{ width:'18%' }}>สัญลักษณ์</th>
              <th>ชื่อหน่วย</th>
              <th>มาตรฐาน</th>
              <th>สถานะ</th>
              <th style={{ width:48 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const c = SI_BADGE_COLOR[u.si] || { bg:'var(--paper-2)', fg:'var(--ink-2)' };
              return (
                <tr key={u.code}>
                  <td className="font-mono" style={{ fontSize:11.5, color:'var(--ink-3)' }}>{u.code}</td>
                  <td>
                    <span className="font-mono" style={{ fontSize:15, color:'var(--ink)', fontWeight:500 }}>{u.symbol}</span>
                  </td>
                  <td style={{ fontWeight:500 }}>{u.name}</td>
                  <td>
                    <span style={{
                      display:'inline-block', padding:'2px 10px', borderRadius:999,
                      fontSize:11, fontWeight:500, background:c.bg, color:c.fg,
                    }}>{u.si}</span>
                  </td>
                  <td><StatusPill status={u.status} /></td>
                  <td style={{ textAlign:'right' }}>
                    <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }}>{Icons.edit}</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding:48, textAlign:'center', fontSize:13, color:'var(--ink-3)' }}>ไม่พบหน่วยที่ตรงกับเงื่อนไข</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {addOpen && <AddUnitModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddUnitModal({ onClose }) {
  const [form, setForm] = useState({ symbol:'', name:'', si:'Trade', status:'Active' });
  const set = (k,v) => setForm({ ...form, [k]:v });
  const nextCode = `U-${String(UNIT_DATA.length + 1).padStart(3,'0')}`;

  return (
    <SettingsModal eyebrow="เพิ่มหน่วยนับ" title="หน่วยใหม่" onClose={onClose} width={520}>
      <div style={{
        padding:'14px 16px', background:'var(--surface-2)',
        border:'1px solid var(--rule)', borderRadius:6, marginBottom:20,
      }}>
        <div className="eyebrow" style={{ marginBottom:4 }}>รหัส (auto-generate)</div>
        <div className="font-mono" style={{ fontSize:18, color:'var(--teal)' }}>{nextCode}</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:14 }}>
        <SettingsField label="สัญลักษณ์" required hint="เช่น m, kg, ตร.ม.">
          <input value={form.symbol} onChange={e=>set('symbol', e.target.value)} placeholder="symbol" style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
        </SettingsField>
        <SettingsField label="ชื่อหน่วย" required>
          <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เช่น เมตร" style={settingsInputStyle} />
        </SettingsField>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="มาตรฐาน">
            <select value={form.si} onChange={e=>set('si', e.target.value)} style={settingsInputStyle}>
              <option>SI Base</option>
              <option>SI Derived</option>
              <option>SI Prefix</option>
              <option>Accepted</option>
              <option>Trade</option>
            </select>
          </SettingsField>
        </div>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="สถานะ">
            <StatusToggle options={['Active','Non-Active']} value={form.status} onChange={v => set('status', v)} />
          </SettingsField>
        </div>
      </div>
    </SettingsModal>
  );
}
