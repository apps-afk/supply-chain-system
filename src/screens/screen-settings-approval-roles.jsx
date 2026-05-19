'use client';
import React, { useState } from 'react';
import { Icons } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle } from '../lib/settings-shared';

/*
  Settings → ตำแหน่งผู้อนุมัติ (Approval Roles)
  Master data driving the sign-off slots on Compare PDFs (and other approval docs).
  - Auto code AR-NNN
  - Each role has a display order so PDFs lay them out left→right consistently
  - Status: Active / Non-Active
  - Minimum recommendation: ≥4 active roles before generating a Compare PDF
*/

export const APPROVAL_ROLES_DATA = [];

export const getActiveApprovalRoles = () => APPROVAL_ROLES_DATA
  .filter(r => r.status === 'Active')
  .sort((a,b) => a.order - b.order);

export function ScreenSettingsApprovalRoles({ go }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('ทั้งหมด');
  const [addOpen, setAddOpen] = useState(false);

  const filtered = APPROVAL_ROLES_DATA.filter(r => {
    if (filter !== 'ทั้งหมด' && r.status !== filter) return false;
    if (q && !(r.name.includes(q) || r.code.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });
  const active = APPROVAL_ROLES_DATA.filter(r => r.status === 'Active').length;
  const meetsMin = active >= 4;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Settings · Master Data</div>
          <h1 className="h-display">ตำแหน่งผู้อนุมัติ (Approval Roles)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:640 }}>
            กำหนดตำแหน่ง/หน่วยงานที่ต้องเซ็นในเอกสาร — เช่น <strong style={{ color:'var(--ink-2)' }}>ใบเปรียบเทียบราคา (Compare PDF)</strong> ·
            ขั้นต่ำ <strong style={{ color:'var(--ink-2)' }}>4 ตำแหน่ง</strong> · Auto-run รหัส <span className="font-mono" style={{ color:'var(--ink-2)' }}>AR-NNN</span>
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn primary" onClick={() => setAddOpen(true)}>{Icons.plus} เพิ่มตำแหน่ง</button>
        </div>
      </div>

      <SettingsStatStrip stats={[
        { label:'ตำแหน่งทั้งหมด',  value: APPROVAL_ROLES_DATA.length, sub:`${active} Active · ${APPROVAL_ROLES_DATA.length - active} Non-Active` },
        { label:'ขั้นต่ำสำหรับ PDF', value:'4 ตำแหน่ง', sub: meetsMin ? `✓ ปัจจุบันมี ${active} ตำแหน่ง · เพียงพอ` : `⚠ ปัจจุบันมี ${active} ตำแหน่ง · ยังไม่ครบ` },
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
        <div style={{ marginLeft:'auto' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหาตำแหน่ง…" />
        </div>
      </div>

      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:90 }}>รหัส</th>
              <th style={{ width:60 }} className="num-col">ลำดับ</th>
              <th style={{ width:'24%' }}>ตำแหน่ง / หน่วยงาน</th>
              <th>คำอธิบาย</th>
              <th style={{ width:120 }}>สถานะ</th>
              <th style={{ width:48 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล — คลิก "เพิ่มตำแหน่ง" เพื่อสร้างรายการแรก
              </td></tr>
            ) : filtered.sort((a,b) => a.order - b.order).map(r => (
              <tr key={r.code}>
                <td className="font-mono" style={{ fontSize:12, color:'var(--ink-2)', fontWeight:500 }}>{r.code}</td>
                <td className="num-col">
                  <span style={{
                    display:'inline-block', width:26, height:26, borderRadius:999,
                    background:'var(--paper-2)', color:'var(--ink-2)',
                    lineHeight:'26px', textAlign:'center',
                    fontFamily:'var(--font-mono)', fontSize:11.5, fontWeight:500,
                  }}>{r.order}</span>
                </td>
                <td style={{ fontWeight:500 }}>{r.name}</td>
                <td style={{ fontSize:12.5, color:'var(--ink-3)' }}>{r.desc}</td>
                <td><StatusPill status={r.status} /></td>
                <td style={{ textAlign:'right' }}>
                  <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }}>{Icons.edit}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Live preview: how the sign-off row will look on the Compare PDF */}
      <div className="card" style={{ marginTop:24, padding:0, overflow:'hidden' }}>
        <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--rule)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom:2 }}>ตัวอย่างการแสดงผลบน PDF</div>
            <h3 className="h-card">ช่องลงนาม · ใบเปรียบเทียบราคา</h3>
          </div>
          <span style={{ fontSize:11.5, color: meetsMin ? 'var(--moss)' : 'var(--clay)', fontWeight:500 }}>
            {meetsMin ? `✓ ${active} ตำแหน่ง — ครบขั้นต่ำ` : `⚠ ${active} ตำแหน่ง — ยังไม่ครบ 4 ตำแหน่ง`}
          </span>
        </div>
        <div style={{ padding:'36px 24px 24px', background:'#FCFAF5' }}>
          <div style={{
            display:'grid',
            gridTemplateColumns: `repeat(${Math.max(active, 4)}, 1fr)`,
            gap:24,
          }}>
            {getActiveApprovalRoles().map(r => (
              <div key={r.code} style={{
                borderTop:'1px solid var(--ink-3)',
                paddingTop:8, fontSize:11, color:'var(--ink-3)', textAlign:'center',
              }}>
                {r.name}<br/>
                <span style={{ color:'var(--ink-4)' }}>ลงนาม / วันที่</span>
              </div>
            ))}
            {[...Array(Math.max(0, 4 - active))].map((_,i) => (
              <div key={'ph'+i} style={{
                borderTop:'1px dashed var(--rule-2)',
                paddingTop:8, fontSize:11, color:'var(--ink-4)', textAlign:'center', fontStyle:'italic',
              }}>
                (ยังไม่ระบุ)<br/>
                <span>—</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {addOpen && <AddApprovalRoleModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddApprovalRoleModal({ onClose }) {
  const [form, setForm] = useState({ name:'', desc:'', order: APPROVAL_ROLES_DATA.length + 1, status:'Active' });
  const set = (k,v) => setForm({ ...form, [k]:v });
  const nextCode = `AR-${String(APPROVAL_ROLES_DATA.length + 1).padStart(3,'0')}`;

  return (
    <SettingsModal eyebrow="เพิ่มตำแหน่งผู้อนุมัติ" title="ตำแหน่งใหม่" onClose={onClose} width={520}>
      <div style={{
        padding:'14px 16px', background:'var(--surface-2)',
        border:'1px solid var(--rule)', borderRadius:6, marginBottom:20,
      }}>
        <div className="eyebrow" style={{ marginBottom:4 }}>รหัส (auto-generate)</div>
        <div className="font-mono" style={{ fontSize:18, color:'var(--teal)' }}>{nextCode}</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 100px', gap:14 }}>
        <SettingsField label="ตำแหน่ง / หน่วยงาน" required>
          <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เช่น ฝ่ายตรวจสอบภายใน" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="ลำดับ" hint="ในแถวเซ็น">
          <input type="number" value={form.order} onChange={e=>set('order', Number(e.target.value))}
            min={1} max={20} style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
        </SettingsField>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="คำอธิบาย">
            <input value={form.desc} onChange={e=>set('desc', e.target.value)} placeholder="หน้าที่/ขอบเขตในการอนุมัติ" style={settingsInputStyle} />
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
