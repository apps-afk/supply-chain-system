'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle } from '../lib/settings-shared';

/*
  Settings → Materials · หมวดย่อย (Level 2)
  Each sub-category points to a parent main-category via main_id (FK).
  Adding a new sub-category REQUIRES picking its main parent.

  Auto-seed: when this master is empty but `materials` has existing rows
  with both `main_category` and `category` strings, we offer to back-fill
  sub rows linked to whichever main_category already exists in the main
  master (must seed mains first; the banner explains).
*/

export function ScreenSettingsMaterialSubCategories({ go }) {
  const [items, setItems]       = useState([]);
  const [mains, setMains]       = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [q, setQ]               = useState('');
  const [mainFilter, setMainFilter] = useState('ทั้งหมด');
  const [statusFilter, setStatusFilter] = useState('ทั้งหมด');
  const [editing, setEditing]   = useState(null); // null | 'new' | object
  const [seeding, setSeeding]   = useState(false);

  async function load() {
    setLoading(true); setErr('');
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/material-sub-categories'),
        fetch('/api/material-main-categories'),
        fetch('/api/materials'),
      ]);
      const d1 = await r1.json();
      const d2 = await r2.json();
      const d3 = await r3.json();
      if (!r1.ok) setErr(d1.error || 'โหลดข้อมูลไม่สำเร็จ');
      else setItems(d1.items || []);
      if (r2.ok) setMains(d2.items || []);
      if (r3.ok) setMaterials(d3.items || []);
    } catch { setErr('เครือข่ายขัดข้อง'); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const mainById = useMemo(() => Object.fromEntries(mains.map(m => [m.id, m])), [mains]);
  const mainByName = useMemo(() => Object.fromEntries(mains.map(m => [m.name, m])), [mains]);

  // Distinct (main_category, category) pairs in materials that aren't in
  // the master yet AND whose main_category does exist in the main master.
  const seedCandidates = useMemo(() => {
    const known = new Set(items.map(s => `${s.main_id}__${s.name}`));
    const pairs = new Map();
    for (const m of materials) {
      const mainName = (m.main_category || '').trim();
      const subName  = (m.category || '').trim();
      if (!mainName || !subName) continue;
      const main = mainByName[mainName];
      if (!main) continue; // user must seed mains first
      const key = `${main.id}__${subName}`;
      if (known.has(key) || pairs.has(key)) continue;
      pairs.set(key, { main_id: main.id, main_name: mainName, name: subName });
    }
    return [...pairs.values()];
  }, [items, mainByName, materials]);

  async function seedFromMaterials() {
    if (seedCandidates.length === 0) return;
    if (!confirm(`สร้างหมวดย่อย ${seedCandidates.length} รายการจากข้อมูลวัสดุที่มี?`)) return;
    setSeeding(true);
    for (const c of seedCandidates) {
      try {
        await fetch('/api/material-sub-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ main_id: c.main_id, name: c.name, active: true }),
        });
      } catch { /* keep going */ }
    }
    setSeeding(false);
    load();
  }

  async function remove(it) {
    if (!confirm(`ลบหมวดย่อย "${it.name}"?`)) return;
    try {
      const res = await fetch('/api/material-sub-categories', {
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

  const filtered = items.filter(p => {
    const status = p.active ? 'Active' : 'Non-Active';
    if (statusFilter !== 'ทั้งหมด' && status !== statusFilter) return false;
    if (mainFilter !== 'ทั้งหมด' && p.main_id !== mainFilter) return false;
    if (q) {
      const v = q.toLowerCase();
      if (!(p.name?.toLowerCase().includes(v) || (mainById[p.main_id]?.name || '').toLowerCase().includes(v))) return false;
    }
    return true;
  });

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Settings · Master Data · วัสดุก่อสร้าง</div>
          <h1 className="h-display">หมวดย่อย (Level 2)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:620 }}>
            หมวดย่อยภายใต้หมวดหลัก — ต้องเลือกหมวดหลักเป็น Parent · เช่น เสาเข็ม (ภายใต้ งานโครงสร้าง)
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn primary"
            disabled={mains.filter(m => m.active).length === 0}
            onClick={() => setEditing('new')}>
            {Icons.plus} เพิ่มหมวดย่อย
          </button>
        </div>
      </div>

      {mains.filter(m => m.active).length === 0 && (
        <div style={{
          padding:'12px 16px', background:'var(--ochre-soft)',
          border:'1px solid var(--ochre)', borderRadius:6, marginBottom:16,
          fontSize:13, color:'#6B5121',
        }}>
          ยังไม่มีหมวดหลัก (Active) — ต้องสร้าง <button onClick={() => go('settings-material-main-categories')}
            style={{ background:'none', border:0, padding:0, color:'#6B5121', textDecoration:'underline', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:500 }}>
            หมวดหลัก
          </button> ก่อนถึงจะเพิ่มหมวดย่อยได้
        </div>
      )}

      {seedCandidates.length > 0 && (
        <div style={{
          padding:'12px 16px', background:'var(--moss-soft)',
          border:'1px solid var(--moss)', borderRadius:6, marginBottom:16,
          display:'flex', alignItems:'center', gap:12,
        }}>
          <span style={{ color:'#2F4A1A', fontSize:18 }}>↻</span>
          <div style={{ flex:1, fontSize:13, color:'#2F4A1A' }}>
            ตรวจพบ <strong>{seedCandidates.length}</strong> คู่ (หมวดหลัก/หมวดย่อย) ในข้อมูลวัสดุที่มีอยู่
          </div>
          <button className="btn sm" onClick={seedFromMaterials} disabled={seeding}
            style={{ background:'#2F4A1A', color:'#fff', borderColor:'#2F4A1A' }}>
            {seeding ? 'กำลังสร้าง…' : `ดึงจากข้อมูลเดิม (${seedCandidates.length})`}
          </button>
        </div>
      )}

      <SettingsStatStrip stats={[
        { label:'หมวดย่อยทั้งหมด', value: items.length, sub: `${items.filter(i=>i.active).length} Active` },
        { label:'หมวดหลักที่อ้างถึง', value: new Set(items.map(i => i.main_id)).size, sub: 'distinct' },
      ]} />

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <select value={mainFilter} onChange={e=>setMainFilter(e.target.value)}
          style={{ ...settingsInputStyle, width:'auto', padding:'5px 10px', fontSize:12 }}>
          <option value="ทั้งหมด">ทุกหมวดหลัก</option>
          {mains.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div style={{ display:'flex', gap:4 }}>
          {['ทั้งหมด','Active','Non-Active'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} className="btn sm" style={{
              background: statusFilter === f ? 'var(--ink)' : 'transparent',
              color: statusFilter === f ? 'var(--paper)' : 'var(--ink-2)',
              borderColor: statusFilter === f ? 'var(--ink)' : 'var(--rule)',
              padding:'5px 12px',
            }}>{f}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหา…" />
        </div>
      </div>

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>
      )}

      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:'30%' }}>หมวดหลัก (Parent)</th>
              <th>หมวดย่อย</th>
              <th>หมายเหตุ</th>
              <th style={{ width:120 }}>สถานะ</th>
              <th style={{ width:80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีหมวดย่อย — คลิก "เพิ่มหมวดย่อย" เพื่อสร้างรายการแรก
              </td></tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>
                  <span style={{ padding:'2px 8px', borderRadius:4, background:'#E3EAD3', color:'#3D5224', fontSize:11.5, fontWeight:500 }}>
                    {mainById[p.main_id]?.name || '— หมวดหลักหาย —'}
                  </span>
                </td>
                <td style={{ fontWeight:500 }}>{p.name}</td>
                <td style={{ fontSize:12.5, color:'var(--ink-3)' }}>{p.notes || '—'}</td>
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
        <SubCategoryModal
          item={editing === 'new' ? null : editing}
          mains={mains}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

export function SubCategoryModal({ item, mains, onClose, onSaved }) {
  // isEdit only when we have a real row id; partial item objects used to
  // prefill defaults on create (e.g. main_id passed from the tree view)
  // are still treated as POST.
  const isEdit = !!item?.id;
  const activeMains = mains.filter(m => m.active);
  const [form, setForm] = useState({
    main_id: item?.main_id || (activeMains[0]?.id || ''),
    name:    item?.name    || '',
    notes:   item?.notes   || '',
    active:  item?.active !== false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    setErr('');
    if (!form.main_id) { setErr('เลือกหมวดหลัก (Parent)'); return; }
    if (!form.name.trim()) { setErr('กรอกชื่อหมวดย่อย'); return; }
    setBusy(true);
    const payload = {
      main_id: form.main_id,
      name:    form.name.trim(),
      notes:   form.notes,
      active:  form.active,
    };
    if (isEdit) payload.id = item.id;
    const res = await fetch('/api/material-sub-categories', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      const friendly = !isEdit && /duplicate|unique/i.test(data.error || '')
        ? 'มีหมวดย่อยชื่อนี้อยู่แล้วในหมวดหลักนี้'
        : (data.error || 'บันทึกไม่สำเร็จ');
      setErr(friendly); setBusy(false); return;
    }
    setBusy(false);
    onSaved();
  }

  return (
    <SettingsModal eyebrow={isEdit ? 'แก้ไขหมวดย่อย' : 'เพิ่มหมวดย่อย'} title={isEdit ? item.name : 'หมวดย่อยใหม่'} onClose={onClose} width={560}>
      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:14 }}>
        <SettingsField label="หมวดหลัก (Parent)" required hint="หมวดย่อยนี้จะอยู่ภายใต้หมวดหลักที่เลือก">
          <select value={form.main_id} onChange={e=>set('main_id', e.target.value)} style={settingsInputStyle}>
            <option value="">— เลือกหมวดหลัก —</option>
            {activeMains.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </SettingsField>
        <SettingsField label="ชื่อหมวดย่อย" required hint="เช่น เสาเข็ม">
          <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เสาเข็ม" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="หมายเหตุ">
          <textarea value={form.notes} onChange={e=>set('notes', e.target.value)}
                    placeholder="(ไม่บังคับ)"
                    style={{ ...settingsInputStyle, minHeight:60, resize:'vertical', fontFamily:'inherit' }} />
        </SettingsField>
        <SettingsField label="สถานะ">
          <StatusToggle options={['Active','Non-Active']} value={form.active ? 'Active' : 'Non-Active'} onChange={v => set('active', v === 'Active')} />
        </SettingsField>
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
