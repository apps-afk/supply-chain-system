'use client';
import React, { useState, useEffect } from 'react';
import { Icons } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle } from '../lib/settings-shared';

/*
  Settings → Contract Type List
  Single-level — type categorization for contracts.
  Data is now stored in DB and fetched from /api/contract-types.
*/

export function ScreenSettingsContractTypes({ go }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [q, setQ]             = useState('');
  const [filter, setFilter]   = useState('ทั้งหมด');
  const [editing, setEditing] = useState(null); // null | 'new' | object

  async function load() {
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/contract-types');
      const data = await res.json();
      if (!res.ok) setErr(data.error || 'โหลดข้อมูลไม่สำเร็จ');
      else setItems(data.items || []);
    } catch {
      setErr('เครือข่ายขัดข้อง');
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function remove(t) {
    if (!confirm(`ลบประเภท "${t.name}"?`)) return;
    try {
      const res = await fetch('/api/contract-types', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'เกิดข้อผิดพลาด');
      }
    } catch { alert('เครือข่ายขัดข้อง'); }
    load();
  }

  const filtered = items.filter(t => {
    if (filter === 'Active' && !t.active) return false;
    if (filter === 'Non-Active' && t.active) return false;
    if (q) {
      const s = q.toLowerCase();
      if (!(t.name?.toLowerCase().includes(s) || t.code?.toLowerCase().includes(s))) return false;
    }
    return true;
  });

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Settings · Master Data</div>
          <h1 className="h-display">ประเภทสัญญา (Contract Type)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:600 }}>
            แยกประเภทของสัญญาเพื่อใช้ในการออกเอกสารและรายงาน
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn primary" onClick={() => setEditing('new')}>{Icons.plus} เพิ่มประเภท</button>
        </div>
      </div>

      <SettingsStatStrip stats={[
        { label:'ประเภททั้งหมด', value: items.length, sub:`${items.filter(t=>t.active).length} Active · ${items.filter(t=>!t.active).length} Non-Active` },
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

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>
      )}

      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:'10%' }}>รหัส</th>
              <th style={{ width:'28%' }}>ชื่อประเภทสัญญา</th>
              <th>คำอธิบาย</th>
              <th className="num-col" style={{ width:100 }}>มัดจำ %</th>
              <th className="num-col" style={{ width:100 }}>เก็บไว้ %</th>
              <th style={{ width:120 }}>สถานะ</th>
              <th style={{ width:80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล — คลิก "เพิ่มประเภท" เพื่อสร้างรายการแรก
              </td></tr>
            ) : filtered.map(t => (
              <tr key={t.id}>
                <td className="font-mono" style={{ fontSize:12, color:'var(--ink-2)', fontWeight:500 }}>{t.code}</td>
                <td style={{ fontWeight:500 }}>{t.name}</td>
                <td style={{ fontSize:12.5, color:'var(--ink-3)' }}>{t.description}</td>
                <td className="num-col num" style={{ color:'var(--ink-2)' }}>{t.deposit_pct != null ? `${t.deposit_pct}%` : '—'}</td>
                <td className="num-col num" style={{ color:'var(--ink-2)' }}>{t.retention_pct != null ? `${t.retention_pct}%` : '—'}</td>
                <td><StatusPill status={t.active ? 'Active' : 'Non-Active'} /></td>
                <td style={{ textAlign:'right' }}>
                  <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }} onClick={() => setEditing(t)} title="แก้ไข">{Icons.edit}</button>
                  <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--clay)' }} onClick={() => remove(t)} title="ลบ">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ContractTypeModal
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ContractTypeModal({ item, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    code:           item?.code           || '',
    name:           item?.name           || '',
    description:    item?.description    || '',
    deposit_pct:    item?.deposit_pct    ?? '',
    retention_pct:  item?.retention_pct  ?? '',
    active:         item?.active !== false,
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
      code:          form.code,
      name:          form.name,
      description:   form.description,
      deposit_pct:   form.deposit_pct   === '' ? null : Number(form.deposit_pct),
      retention_pct: form.retention_pct === '' ? null : Number(form.retention_pct),
      active:        form.active,
    };
    if (isEdit) payload.id = item.id;
    const res = await fetch('/api/contract-types', {
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
    <SettingsModal eyebrow={isEdit ? 'แก้ไขประเภทสัญญา' : 'เพิ่มประเภทสัญญา'} title={isEdit ? item.name : 'ประเภทสัญญาใหม่'} onClose={onClose} width={560}>
      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:14 }}>
        <SettingsField label="รหัส" required hint="เช่น CT-001">
          <input value={form.code} onChange={e=>set('code', e.target.value)} placeholder="CT-001" style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
        </SettingsField>
        <SettingsField label="ชื่อประเภทสัญญา" required>
          <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เช่น สัญญาว่าจ้างที่ปรึกษา" style={settingsInputStyle} />
        </SettingsField>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="คำอธิบาย">
            <textarea value={form.description} onChange={e=>set('description', e.target.value)}
                      placeholder="อธิบายเมื่อใช้ประเภทสัญญานี้"
                      style={{ ...settingsInputStyle, minHeight:72, resize:'vertical', fontFamily:'inherit' }} />
          </SettingsField>
        </div>
        <SettingsField label="มัดจำ %" hint="0–100">
          <input type="number" min={0} max={100} step={0.01} value={form.deposit_pct}
                 onChange={e=>set('deposit_pct', e.target.value)} placeholder="เช่น 30"
                 style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
        </SettingsField>
        <SettingsField label="เก็บไว้ %" hint="Retention 0–100">
          <input type="number" min={0} max={100} step={0.01} value={form.retention_pct}
                 onChange={e=>set('retention_pct', e.target.value)} placeholder="เช่น 5"
                 style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
        </SettingsField>
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
