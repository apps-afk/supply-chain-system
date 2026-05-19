'use client';
import React, { useState, useEffect } from 'react';
import { Icons } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsSearchBox, StatusPill, StatusToggle } from '../lib/settings-shared';

/*
  Settings → Project List
  Data is now stored in DB and fetched from /api/projects.
  type_id is a FK to project_types (fetched from /api/project-types).
  Whitelisted fields:
    code, name, type_id, status, location, budget,
    start_date, end_date, notes, active
*/

const STATUS_OPTIONS = ['Planning', 'Active', 'Closed'];

export function ScreenSettingsProjects({ go }) {
  const [items, setItems]         = useState([]);
  const [projectTypes, setTypes]  = useState([]);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState('');
  const [q, setQ]                 = useState('');
  const [filter, setFilter]       = useState('ทั้งหมด');
  const [editing, setEditing]     = useState(null); // null | 'new' | object

  async function load() {
    setLoading(true); setErr('');
    try {
      const [pRes, tRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/project-types'),
      ]);
      const p = await pRes.json();
      const t = await tRes.json();
      if (!pRes.ok) setErr(p.error || 'โหลดข้อมูลไม่สำเร็จ');
      else setItems(p.items || []);
      if (tRes.ok) setTypes(t.items || []);
    } catch {
      setErr('เครือข่ายขัดข้อง');
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function remove(it) {
    if (!confirm(`ลบโครงการ "${it.name}"?`)) return;
    const res = await fetch('/api/projects', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: it.id }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error || 'เกิดข้อผิดพลาด'); }
    load();
  }

  const typesById = Object.fromEntries(projectTypes.map(t => [t.id, t]));

  const filtered = items.filter(p => {
    if (filter !== 'ทั้งหมด') {
      if (filter === 'Active'   && !(p.status === 'Active'   || (!p.status && p.active))) return false;
      if (filter === 'Planning' && p.status !== 'Planning') return false;
      if (filter === 'Closed'   && p.status !== 'Closed') return false;
    }
    if (q) {
      const s = q.toLowerCase();
      if (!(p.name?.toLowerCase().includes(s) || p.code?.toLowerCase().includes(s))) return false;
    }
    return true;
  });

  // Compute split stats
  const active   = items.filter(p => p.status === 'Active' || (!p.status && p.active));
  const closed   = items.filter(p => p.status === 'Closed');
  const planning = items.filter(p => p.status === 'Planning');
  const totalBudget  = items.reduce((s,p) => s + (Number(p.budget) || 0), 0);
  const activeBudget = active.reduce((s,p) => s + (Number(p.budget) || 0), 0);

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Settings · Master Data</div>
          <h1 className="h-display">โครงการ (Project List)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:620 }}>
            ทะเบียนโครงการทั้งหมด · ประเภทโครงการ <button onClick={() => go('settings-project-types')} style={{ background:'none', border:0, padding:0, color:'var(--teal)', textDecoration:'underline', cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>ตั้งค่าใน Project Type</button>
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn primary" onClick={() => setEditing('new')}>{Icons.plus} เพิ่มโครงการ</button>
        </div>
      </div>

      {/* Summary */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:0,
        borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)',
        padding:'24px 0', marginBottom:32,
      }}>
        <div>
          <div className="stat-label">โครงการทั้งหมด</div>
          <div className="stat-value">{items.length}</div>
          <div style={{ display:'flex', gap:14, marginTop:8, fontSize:12, flexWrap:'wrap' }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--moss)' }} />
              <span style={{ color:'var(--ink-3)' }}>Active</span>
              <strong style={{ color:'var(--ink)' }}>{active.length}</strong>
            </span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--ochre)' }} />
              <span style={{ color:'var(--ink-3)' }}>Planning</span>
              <strong style={{ color:'var(--ink)' }}>{planning.length}</strong>
            </span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--ink-4)' }} />
              <span style={{ color:'var(--ink-3)' }}>Closed</span>
              <strong style={{ color:'var(--ink)' }}>{closed.length}</strong>
            </span>
          </div>
        </div>

        <div style={{ paddingLeft:28, borderLeft:'1px solid var(--rule)' }}>
          <div className="stat-label">งบประมาณรวม</div>
          <div className="stat-value">{totalBudget.toLocaleString()}</div>
          <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:8 }}>
            Active <strong style={{ color:'var(--ink)' }}>{activeBudget.toLocaleString()}</strong>
          </div>
        </div>

        <div style={{ paddingLeft:28, borderLeft:'1px solid var(--rule)' }}>
          <div className="stat-label">ประเภทโครงการ</div>
          <div className="stat-value">{projectTypes.filter(t => t.active).length}</div>
          <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:8 }}>Active types</div>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4 }}>
          {['ทั้งหมด','Planning','Active','Closed'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className="btn sm" style={{
              background: filter === f ? 'var(--ink)' : 'transparent',
              color: filter === f ? 'var(--paper)' : 'var(--ink-2)',
              borderColor: filter === f ? 'var(--ink)' : 'var(--rule)',
              padding:'5px 12px',
            }}>{f}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหาโครงการ…" />
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
              <th style={{ width:120 }}>รหัส</th>
              <th>ชื่อโครงการ</th>
              <th>ประเภท</th>
              <th>สถานที่</th>
              <th className="num-col">งบประมาณ</th>
              <th>เริ่มงาน</th>
              <th>สถานะ</th>
              <th style={{ width:80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล — คลิก "เพิ่มโครงการ" เพื่อสร้างรายการแรก
              </td></tr>
            ) : filtered.map(p => {
              const type = typesById[p.type_id];
              const statusLabel = p.status || (p.active ? 'Active' : 'Non-Active');
              return (
                <tr key={p.id}>
                  <td className="font-mono" style={{ fontSize:12, color:'var(--ink-2)' }}>{p.code}</td>
                  <td style={{ fontWeight:500 }}>{p.name}</td>
                  <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{type ? type.name : (p.type_id || '—')}</td>
                  <td style={{ fontSize:12.5, color:'var(--ink-3)' }}>{p.location || '—'}</td>
                  <td className="num-col num" style={{ color:'var(--ink-2)' }}>{p.budget != null ? Number(p.budget).toLocaleString() : '—'}</td>
                  <td style={{ fontSize:12, color:'var(--ink-3)' }}>{p.start_date || '—'}</td>
                  <td><StatusPill status={statusLabel} /></td>
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
        <ProjectModal
          go={go}
          item={editing === 'new' ? null : editing}
          projectTypes={projectTypes}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ProjectModal({ go, item, projectTypes, onClose, onSaved }) {
  const isEdit = !!item;
  const activeTypes = (projectTypes || []).filter(t => t.active);
  const [form, setForm] = useState({
    code:       item?.code        || '',
    name:       item?.name        || '',
    type_id:    item?.type_id     || (activeTypes[0]?.id || ''),
    status:     item?.status      || 'Planning',
    location:   item?.location    || '',
    budget:     item?.budget      ?? '',
    start_date: item?.start_date  || '',
    end_date:   item?.end_date    || '',
    notes:      item?.notes       || '',
    active:     item?.active !== false,
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
      code:       form.code,
      name:       form.name,
      type_id:    form.type_id || null,
      status:     form.status,
      location:   form.location,
      budget:     form.budget === '' ? null : Number(form.budget),
      start_date: form.start_date || null,
      end_date:   form.end_date   || null,
      notes:      form.notes,
      active:     form.active,
    };
    if (isEdit) payload.id = item.id;
    const res = await fetch('/api/projects', {
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
    <SettingsModal eyebrow={isEdit ? 'แก้ไขโครงการ' : 'เพิ่มโครงการ'} title={isEdit ? item.name : 'โครงการใหม่'} onClose={onClose} width={680}>
      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'140px 1fr 1fr', gap:14 }}>
        <SettingsField label="รหัส" required hint="เช่น IE-LV05">
          <input value={form.code} onChange={e=>set('code', e.target.value)} placeholder="IE-LV05" style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
        </SettingsField>
        <div style={{ gridColumn:'2 / -1' }}>
          <SettingsField label="ชื่อโครงการ" required>
            <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เช่น Initial Living สาทร" style={settingsInputStyle} />
          </SettingsField>
        </div>
        <SettingsField label="ประเภท" hint={<span>เพิ่มได้ที่ <button type="button" onClick={()=>go('settings-project-types')} style={{ background:'none', border:0, padding:0, color:'var(--teal)', textDecoration:'underline', cursor:'pointer' }}>Project Type</button></span>}>
          <select value={form.type_id} onChange={e=>set('type_id', e.target.value)} style={settingsInputStyle}>
            <option value="">— เลือกประเภท —</option>
            {activeTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </SettingsField>
        <SettingsField label="สถานะ">
          <select value={form.status} onChange={e=>set('status', e.target.value)} style={settingsInputStyle}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </SettingsField>
        <SettingsField label="สถานที่">
          <input value={form.location} onChange={e=>set('location', e.target.value)} placeholder="เช่น กรุงเทพฯ" style={settingsInputStyle} />
        </SettingsField>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="งบประมาณ" hint="หน่วย: บาท">
            <input type="number" min={0} step={1} value={form.budget}
                   onChange={e=>set('budget', e.target.value)} placeholder="0"
                   style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
          </SettingsField>
        </div>
        <SettingsField label="วันเริ่มงาน">
          <input type="date" value={form.start_date} onChange={e=>set('start_date', e.target.value)} style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="วันสิ้นสุด">
          <input type="date" value={form.end_date} onChange={e=>set('end_date', e.target.value)} style={settingsInputStyle} />
        </SettingsField>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="หมายเหตุ">
            <textarea value={form.notes} onChange={e=>set('notes', e.target.value)}
                      placeholder="(ไม่บังคับ)"
                      style={{ ...settingsInputStyle, minHeight:60, resize:'vertical', fontFamily:'inherit' }} />
          </SettingsField>
        </div>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="ใช้งาน">
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
