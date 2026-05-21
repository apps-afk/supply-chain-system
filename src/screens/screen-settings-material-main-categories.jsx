'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle } from '../lib/settings-shared';

/*
  Settings → Materials · หมวดหลัก (Level 1)
  Master table for the top-level material taxonomy. Used as the parent
  picker on the Sub-Categories page + the Item modal.

  Auto-seed: when the master is empty but `materials` has existing rows
  with `main_category` strings, we offer a one-click migration to backfill
  this master from those distinct values.
*/

export function ScreenSettingsMaterialMainCategories({ go }) {
  const [items, setItems]       = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [q, setQ]               = useState('');
  const [filter, setFilter]     = useState('ทั้งหมด');
  const [editing, setEditing]   = useState(null); // null | 'new' | object
  const [seeding, setSeeding]   = useState(false);

  async function load() {
    setLoading(true); setErr('');
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/material-main-categories'),
        fetch('/api/materials'),
      ]);
      const d1 = await r1.json();
      const d2 = await r2.json();
      if (!r1.ok) setErr(d1.error || 'โหลดข้อมูลไม่สำเร็จ');
      else setItems(d1.items || []);
      if (r2.ok) setMaterials(d2.items || []);
    } catch { setErr('เครือข่ายขัดข้อง'); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Distinct main_category strings on materials that aren't already in the
  // master — these are the candidates for the auto-seed button.
  const seedCandidates = useMemo(() => {
    const known = new Set(items.map(i => i.name));
    const fromMaterials = new Set(
      materials.map(m => (m.main_category || '').trim()).filter(Boolean)
    );
    return [...fromMaterials].filter(n => !known.has(n));
  }, [items, materials]);

  async function seedFromMaterials() {
    if (seedCandidates.length === 0) return;
    if (!confirm(`สร้างหมวดหลัก ${seedCandidates.length} รายการจากข้อมูลวัสดุที่มี?\n· ${seedCandidates.slice(0,5).join(', ')}${seedCandidates.length>5?' …':''}`)) return;
    setSeeding(true);
    for (const name of seedCandidates) {
      try {
        await fetch('/api/material-main-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, active: true }),
        });
      } catch { /* keep going; the rest still seed */ }
    }
    setSeeding(false);
    load();
  }

  async function remove(it) {
    // Sub-categories FK to main — block delete with a hint if any reference us.
    if (!confirm(`ลบหมวดหลัก "${it.name}"?\nถ้ามีหมวดย่อยใต้หมวดนี้จะลบไม่ได้`)) return;
    try {
      const res = await fetch('/api/material-main-categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: it.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'เกิดข้อผิดพลาด — หมวดนี้อาจมีหมวดย่อยอยู่');
      }
    } catch { alert('เครือข่ายขัดข้อง'); }
    load();
  }

  const filtered = items.filter(p => {
    const status = p.active ? 'Active' : 'Non-Active';
    if (filter !== 'ทั้งหมด' && status !== filter) return false;
    if (q && !p.name?.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Settings · Master Data · วัสดุก่อสร้าง</div>
          <h1 className="h-display">หมวดหลัก (Level 1)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:620 }}>
            หมวดบนสุดของวัสดุ — เช่น งานโครงสร้าง · งานสถาปัตย์ · งานระบบ
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn primary" onClick={() => setEditing('new')}>{Icons.plus} เพิ่มหมวดหลัก</button>
        </div>
      </div>

      {seedCandidates.length > 0 && (
        <div style={{
          padding:'12px 16px', background:'var(--moss-soft)',
          border:'1px solid var(--moss)', borderRadius:6, marginBottom:16,
          display:'flex', alignItems:'center', gap:12,
        }}>
          <span style={{ color:'#2F4A1A', fontSize:18 }}>↻</span>
          <div style={{ flex:1, fontSize:13, color:'#2F4A1A' }}>
            ตรวจพบ <strong>{seedCandidates.length}</strong> หมวดในข้อมูลวัสดุที่มีอยู่ —
            กดเพื่อสร้างใน master ครั้งเดียว
          </div>
          <button className="btn sm" onClick={seedFromMaterials} disabled={seeding}
            style={{ background:'#2F4A1A', color:'#fff', borderColor:'#2F4A1A' }}>
            {seeding ? 'กำลังสร้าง…' : `ดึงจากข้อมูลเดิม (${seedCandidates.length})`}
          </button>
        </div>
      )}

      <SettingsStatStrip stats={[
        { label:'หมวดหลักทั้งหมด', value: items.length, sub: `${items.filter(i=>i.active).length} Active` },
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
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหาหมวดหลัก…" />
        </div>
      </div>

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>
      )}

      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>ชื่อหมวดหลัก</th>
              <th>หมายเหตุ</th>
              <th style={{ width:120 }}>สถานะ</th>
              <th style={{ width:80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีหมวดหลัก — คลิก "เพิ่มหมวดหลัก" เพื่อสร้างรายการแรก
              </td></tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
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
        <MainCategoryModal
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

export function MainCategoryModal({ item, onClose, onSaved }) {
  // isEdit only when we have a real row id; partial item objects used to
  // prefill defaults on create are still treated as POST.
  const isEdit = !!item?.id;
  const [form, setForm] = useState({
    name:   item?.name   || '',
    notes:  item?.notes  || '',
    active: item?.active !== false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    setErr('');
    if (!form.name.trim()) { setErr('กรอกชื่อหมวดหลัก'); return; }
    setBusy(true);
    const payload = { name: form.name.trim(), notes: form.notes, active: form.active };
    if (isEdit) payload.id = item.id;
    const res = await fetch('/api/material-main-categories', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      const friendly = !isEdit && /duplicate|unique/i.test(data.error || '')
        ? 'ชื่อหมวดนี้มีอยู่แล้ว'
        : (data.error || 'บันทึกไม่สำเร็จ');
      setErr(friendly); setBusy(false); return;
    }
    setBusy(false);
    onSaved();
  }

  return (
    <SettingsModal eyebrow={isEdit ? 'แก้ไขหมวดหลัก' : 'เพิ่มหมวดหลัก'} title={isEdit ? item.name : 'หมวดหลักใหม่'} onClose={onClose} width={520}>
      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:14 }}>
        <SettingsField label="ชื่อหมวดหลัก" required hint="เช่น งานโครงสร้าง">
          <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="งานโครงสร้าง" style={settingsInputStyle} />
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
