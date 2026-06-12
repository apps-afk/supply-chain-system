'use client';
import React, { useState, useEffect } from 'react';
import { Icons } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle } from '../lib/settings-shared';

/*
  Settings → ตำแหน่งผู้อนุมัติ (Approval Roles)
  Master data driving the sign-off slots on Compare PDFs (and other approval docs).
  - Each role has a level (int) so PDFs lay them out left→right consistently
  - Status: Active / Non-Active
  - Minimum recommendation: ≥4 active roles before generating a Compare PDF
  - Data is now stored in DB and fetched from /api/approval-roles.
*/


export function ScreenSettingsApprovalRoles({ go }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [q, setQ]             = useState('');
  const [filter, setFilter]   = useState('ทั้งหมด');
  const [editing, setEditing] = useState(null); // null | 'new' | object

  async function load() {
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/approval-roles');
      const data = await res.json();
      if (!res.ok) setErr(data.error || 'โหลดข้อมูลไม่สำเร็จ');
      else setItems(data.items || []);
    } catch {
      setErr('เครือข่ายขัดข้อง');
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function remove(r) {
    if (!confirm(`ลบตำแหน่ง "${r.name}"?`)) return;
    try {
      const res = await fetch('/api/approval-roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'เกิดข้อผิดพลาด');
      }
    } catch { alert('เครือข่ายขัดข้อง'); }
    load();
  }

  const filtered = items.filter(r => {
    const status = r.active ? 'Active' : 'Non-Active';
    if (filter !== 'ทั้งหมด' && status !== filter) return false;
    if (q) {
      const s = q.toLowerCase();
      if (!(r.name?.toLowerCase().includes(s) || r.code?.toLowerCase().includes(s))) return false;
    }
    return true;
  });
  const activeRoles = items.filter(r => r.active);
  const activeCount = activeRoles.length;
  const MIN_ROLES = 3;
  const meetsMin = activeCount >= MIN_ROLES;
  const activeSorted = [...activeRoles].sort((a,b) => (a.level||0) - (b.level||0));

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Settings · Master Data</div>
          <h1 className="h-display">ตำแหน่งผู้อนุมัติ (Approval Roles)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:640 }}>
            กำหนดตำแหน่ง/หน่วยงานที่ต้องเซ็นในเอกสาร — เช่น <strong style={{ color:'var(--ink-2)' }}>ใบเปรียบเทียบราคา (Compare PDF)</strong> ·
            ขั้นต่ำ <strong style={{ color:'var(--ink-2)' }}>{MIN_ROLES} ตำแหน่ง</strong>
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn primary" onClick={() => setEditing('new')}>{Icons.plus} เพิ่มตำแหน่ง</button>
        </div>
      </div>

      <SettingsStatStrip stats={[
        { label:'ตำแหน่งทั้งหมด',  value: items.length, sub:`${activeCount} Active · ${items.length - activeCount} Non-Active` },
        { label:'ขั้นต่ำสำหรับ PDF', value:`${MIN_ROLES} ตำแหน่ง`, sub: meetsMin ? `✓ ปัจจุบันมี ${activeCount} ตำแหน่ง · เพียงพอ` : `⚠ ปัจจุบันมี ${activeCount} ตำแหน่ง · ยังไม่ครบ` },
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

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>
      )}

      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:90 }}>รหัส</th>
              <th style={{ width:60 }} className="num-col">ลำดับ</th>
              <th>ตำแหน่ง / หน่วยงาน</th>
              <th style={{ width:120 }}>สถานะ</th>
              <th style={{ width:80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล — คลิก "เพิ่มตำแหน่ง" เพื่อสร้างรายการแรก
              </td></tr>
            ) : [...filtered].sort((a,b) => (a.level||0) - (b.level||0)).map(r => (
              <tr key={r.id}>
                <td className="font-mono" style={{ fontSize:12, color:'var(--ink-2)', fontWeight:500 }}>{r.code}</td>
                <td className="num-col">
                  <span style={{
                    display:'inline-block', width:26, height:26, borderRadius:999,
                    background:'var(--paper-2)', color:'var(--ink-2)',
                    lineHeight:'26px', textAlign:'center',
                    fontFamily:'var(--font-mono)', fontSize:11.5, fontWeight:500,
                  }}>{r.level}</span>
                </td>
                <td style={{ fontWeight:500 }}>{r.name}</td>
                <td><StatusPill status={r.active ? 'Active' : 'Non-Active'} /></td>
                <td style={{ textAlign:'right' }}>
                  <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }} onClick={() => setEditing(r)} title="แก้ไข">{Icons.edit}</button>
                  <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--clay)' }} onClick={() => remove(r)} title="ลบ">×</button>
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
            {meetsMin ? `✓ ${activeCount} ตำแหน่ง — ครบขั้นต่ำ` : `⚠ ${activeCount} ตำแหน่ง — ยังไม่ครบ ${MIN_ROLES} ตำแหน่ง`}
          </span>
        </div>
        <div style={{ padding:'36px 24px 24px', background:'#FCFAF5' }}>
          <div style={{
            display:'grid',
            gridTemplateColumns: `repeat(${Math.max(activeCount, MIN_ROLES)}, 1fr)`,
            gap:24,
          }}>
            {activeSorted.map(r => (
              <div key={r.id} style={{
                borderTop:'1px solid var(--ink-3)',
                paddingTop:8, fontSize:11, color:'var(--ink-3)', textAlign:'center',
              }}>
                {r.name}<br/>
                <span style={{ color:'var(--ink-4)' }}>ลงนาม / วันที่</span>
              </div>
            ))}
            {[...Array(Math.max(0, MIN_ROLES - activeCount))].map((_,i) => (
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

      {editing && (
        <ApprovalRoleModal
          item={editing === 'new' ? null : editing}
          nextLevel={items.length + 1}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ApprovalRoleModal({ item, nextLevel, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    code:   item?.code   || '',
    name:   item?.name   || '',
    level:  item?.level ?? nextLevel,
    active: item?.active !== false,
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
      code:   form.code,
      name:   form.name,
      level:  Number(form.level) || 0,
      active: form.active,
    };
    if (isEdit) payload.id = item.id;
    const res = await fetch('/api/approval-roles', {
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
    <SettingsModal eyebrow={isEdit ? 'แก้ไขตำแหน่งผู้อนุมัติ' : 'เพิ่มตำแหน่งผู้อนุมัติ'} title={isEdit ? item.name : 'ตำแหน่งใหม่'} onClose={onClose} width={520}>
      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 100px', gap:14 }}>
        <SettingsField label="รหัส" required hint="เช่น AR-001">
          <input value={form.code} onChange={e=>set('code', e.target.value)} placeholder="AR-001" style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
        </SettingsField>
        <SettingsField label="ลำดับ" hint="ในแถวเซ็น">
          <input type="number" value={form.level} onChange={e=>set('level', e.target.value)}
            min={1} max={20} style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
        </SettingsField>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="ตำแหน่ง / หน่วยงาน" required>
            <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เช่น ฝ่ายตรวจสอบภายใน" style={settingsInputStyle} />
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
