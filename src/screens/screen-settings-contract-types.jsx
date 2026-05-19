'use client';
import React, { useState } from 'react';
import { Icons } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle } from '../lib/settings-shared';

/*
  Settings → Contract Type List
  Single-level — type categorization for contracts.
  Auto code: CT-NNN
*/

const CONTRACT_TYPES = [];

export function ScreenSettingsContractTypes({ go }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('ทั้งหมด');
  const [addOpen, setAddOpen] = useState(false);

  const filtered = CONTRACT_TYPES.filter(t => {
    if (filter === 'Active' && !t.active) return false;
    if (filter === 'Non-Active' && t.active) return false;
    if (q && !(t.name.includes(q) || t.code.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Settings · Master Data</div>
          <h1 className="h-display">ประเภทสัญญา (Contract Type)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:600 }}>
            แยกประเภทของสัญญาเพื่อใช้ในการออกเอกสารและรายงาน — Level เดียว · ระบบ Auto Run รหัส <span className="font-mono" style={{ color:'var(--ink-2)' }}>CT-NNN</span>
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn">{Icons.upload} Import</button>
          <button className="btn">{Icons.download} Export</button>
          <button className="btn primary" onClick={() => setAddOpen(true)}>{Icons.plus} เพิ่มประเภท</button>
        </div>
      </div>

      <SettingsStatStrip stats={[
        { label:'ประเภททั้งหมด', value: CONTRACT_TYPES.length, sub:`${CONTRACT_TYPES.filter(t=>t.active).length} Active · ${CONTRACT_TYPES.filter(t=>!t.active).length} Non-Active` },
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
          <span style={{ fontSize:12, color:'var(--ink-3)' }}>
            <strong style={{ color:'var(--ink)' }}>{filtered.length}</strong> รายการ
          </span>
        </div>
      </div>

      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:'10%' }}>รหัส</th>
              <th style={{ width:'28%' }}>ชื่อประเภทสัญญา</th>
              <th>คำอธิบาย</th>
              <th className="num-col">สัญญาที่ผูก</th>
              <th>ใช้ล่าสุด</th>
              <th>สถานะ</th>
              <th style={{ width:48 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล — คลิก "เพิ่มประเภท" เพื่อสร้างรายการแรก
              </td></tr>
            ) : filtered.map(t => (
              <tr key={t.code}>
                <td className="font-mono" style={{ fontSize:12, color:'var(--ink-2)', fontWeight:500 }}>{t.code}</td>
                <td style={{ fontWeight:500 }}>{t.name}</td>
                <td style={{ fontSize:12.5, color:'var(--ink-3)' }}>{t.desc}</td>
                <td className="num-col num" style={{ color:'var(--ink-2)' }}>{t.count}</td>
                <td style={{ fontSize:12, color:'var(--ink-3)' }}>{t.lastUsed}</td>
                <td><StatusPill status={t.active ? 'Active' : 'Non-Active'} /></td>
                <td style={{ textAlign:'right' }}>
                  <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }}>{Icons.edit}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addOpen && <AddContractTypeModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddContractTypeModal({ onClose }) {
  const [form, setForm] = useState({ name:'', desc:'', active:true });
  const set = (k,v) => setForm({ ...form, [k]:v });
  const nextCode = `CT-${String(CONTRACT_TYPES.length + 1).padStart(3,'0')}`;

  return (
    <SettingsModal eyebrow="เพิ่มประเภทสัญญา" title="ประเภทสัญญาใหม่" onClose={onClose} width={560}>
      <div style={{
        padding:'14px 16px', background:'var(--surface-2)',
        border:'1px solid var(--rule)', borderRadius:6, marginBottom:20,
        display:'flex', alignItems:'center', gap:16,
      }}>
        <div style={{ flex:1 }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>รหัส (auto-generate)</div>
          <div className="font-mono" style={{ fontSize:18, color:'var(--teal)' }}>{nextCode}</div>
        </div>
        <div style={{ fontSize:11, color:'var(--ink-3)', textAlign:'right' }}>
          รูปแบบ <strong>CT-NNN</strong>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:14 }}>
        <SettingsField label="ชื่อประเภทสัญญา" required>
          <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เช่น สัญญาว่าจ้างที่ปรึกษา" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="คำอธิบาย">
          <textarea value={form.desc} onChange={e=>set('desc', e.target.value)}
                    placeholder="อธิบายเมื่อใช้ประเภทสัญญานี้"
                    style={{ ...settingsInputStyle, minHeight:72, resize:'vertical', fontFamily:'inherit' }} />
        </SettingsField>
        <SettingsField label="สถานะเริ่มต้น">
          <StatusToggle options={['Active','Non-Active']} value={form.active ? 'Active' : 'Non-Active'} onChange={v => set('active', v === 'Active')} />
        </SettingsField>
      </div>
    </SettingsModal>
  );
}
