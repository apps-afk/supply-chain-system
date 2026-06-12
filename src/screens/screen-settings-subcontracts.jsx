'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle, BulkUploadModal, findUnit, UnitPicker } from '../lib/settings-shared';

/*
  Settings → งานจ้างเหมา (2-level hierarchical browser)

  Tree view:
    Level 1: ประเภท (subcontract_categories master)
      Level 2: ชิ้นงานจ้าง (subcontracts rows; `category` string = parent name)

  Each ประเภท row is collapsible. Inline actions:
    Level 1: + ชิ้นงานจ้าง, edit, delete
    Level 2: edit, delete

  Subcontracts rows keep `category` as a STRING (denormalized parent name)
  for backward compat + bulk upload; the master constrains the dropdowns.
*/

function nextSubcontractCode(existing) {
  let max = 0;
  for (const c of existing || []) {
    const m = /^SUB-(\d+)$/.exec(String(c).trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `SUB-${String(max + 1).padStart(5, '0')}`;
}

// NOTE: stub kept for backwards compatibility.

export function ScreenSettingsSubcontracts({ go }) {
  const [items, setItems]     = useState([]);
  const [units, setUnits]     = useState([]);
  const [cats, setCats]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [q, setQ]             = useState('');

  const [expandedCats, setExpandedCats] = useState(() => new Set());

  const [editing, setEditing] = useState(null);   // {level:'cat'|'item', item}
  const [adding,  setAdding]  = useState(null);    // {level:'cat'|'item', parentCatName?}
  const [bulkOpen, setBulkOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function load() {
    setLoading(true); setErr('');
    try {
      const [sRes, uRes, cRes] = await Promise.all([
        fetch('/api/subcontracts'),
        fetch('/api/units'),
        fetch('/api/subcontract-categories'),
      ]);
      const s = await sRes.json();
      const u = await uRes.json();
      const c = await cRes.json();
      if (!sRes.ok) setErr(s.error || 'โหลดข้อมูลไม่สำเร็จ');
      else setItems(s.items || []);
      if (uRes.ok) setUnits(u.items || []);
      if (cRes.ok) setCats(c.items || []);
    } catch { setErr('เครือข่ายขัดข้อง'); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const unitsById   = useMemo(() => Object.fromEntries(units.map(u => [u.id, u])), [units]);
  const catByName   = useMemo(() => Object.fromEntries(cats.map(c => [c.name, c])), [cats]);
  const itemsByCat  = useMemo(() => {
    const acc = {};
    for (const it of items) (acc[it.category || ''] = acc[it.category || ''] || []).push(it);
    return acc;
  }, [items]);

  const isSearching = q.trim().length > 0;
  const qLower = q.toLowerCase().trim();
  const matches = (s) => !qLower || (s || '').toLowerCase().includes(qLower);

  const tree = useMemo(() => {
    return cats.map(cat => {
      const itemsHere = itemsByCat[cat.name] || [];
      const itemsFiltered = isSearching
        ? itemsHere.filter(it => matches(it.name) || matches(it.code))
        : itemsHere;
      const matched = matches(cat.name) || itemsFiltered.length > 0;
      return { ...cat, items: itemsHere, itemsFiltered, matched };
    }).filter(c => !isSearching || c.matched);
  }, [cats, itemsByCat, q, isSearching]);

  // Distinct category strings on items not yet in the master.
  const seedCandidates = useMemo(() => {
    const known = new Set(cats.map(c => c.name));
    const fromItems = new Set(items.map(i => (i.category || '').trim()).filter(Boolean));
    return [...fromItems].filter(n => !known.has(n));
  }, [cats, items]);

  // Orphan items: category isn't in the master.
  const orphans = useMemo(
    () => items.filter(it => !catByName[(it.category || '').trim()]),
    [items, catByName]
  );

  async function seedFromItems() {
    if (seedCandidates.length === 0) return;
    if (!confirm(`สร้างประเภท ${seedCandidates.length} รายการจากข้อมูลที่มี?\n· ${seedCandidates.slice(0,5).join(', ')}${seedCandidates.length>5?' …':''}`)) return;
    setSeeding(true);
    for (const name of seedCandidates) {
      try {
        await fetch('/api/subcontract-categories', {
          method:'POST', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ name, active: true }),
        });
      } catch { /* keep going */ }
    }
    setSeeding(false);
    load();
  }

  function toggleCat(id) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const expandAll   = () => setExpandedCats(new Set(cats.map(c => c.id)));
  const collapseAll = () => setExpandedCats(new Set());

  async function removeCat(c) {
    const itemsHere = itemsByCat[c.name] || [];
    if (itemsHere.length > 0) {
      alert(`ลบไม่ได้ — ประเภท "${c.name}" มีชิ้นงานจ้าง ${itemsHere.length} รายการอยู่\nลบรายการก่อนแล้วค่อยลบประเภท`);
      return;
    }
    if (!confirm(`ลบประเภท "${c.name}"?`)) return;
    const r = await fetch('/api/subcontract-categories', {
      method:'DELETE', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ id: c.id }),
    });
    if (!r.ok) { const d = await r.json().catch(()=>({})); alert(d.error || 'ลบไม่สำเร็จ'); }
    load();
  }
  async function removeItem(it) {
    if (!confirm(`ลบงานจ้าง "${it.name}"?`)) return;
    const r = await fetch('/api/subcontracts', {
      method:'DELETE', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ id: it.id }),
    });
    if (!r.ok) { const d = await r.json().catch(()=>({})); alert(d.error || 'ลบไม่สำเร็จ'); }
    load();
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Settings · Master Data</div>
          <h1 className="h-display">งานจ้างเหมา</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:640 }}>
            ระบบ 2 ระดับ · <strong style={{ color:'var(--ink-2)' }}>ประเภท → ชิ้นงานจ้าง</strong> ·
            กดที่แถวเพื่อย่อ/ขยาย
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" onClick={() => setBulkOpen(true)}>{Icons.upload} เพิ่มหลายรายการ</button>
          <button className="btn primary" onClick={() => setAdding({ level:'cat' })}>{Icons.plus} เพิ่มประเภท</button>
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
            ตรวจพบ <strong>{seedCandidates.length}</strong> ประเภทในข้อมูลที่มีอยู่ — กดเพื่อสร้างใน master ครั้งเดียว
          </div>
          <button className="btn sm" onClick={seedFromItems} disabled={seeding}
            style={{ background:'#2F4A1A', color:'#fff', borderColor:'#2F4A1A' }}>
            {seeding ? 'กำลังสร้าง…' : `ดึงจากข้อมูลเดิม (${seedCandidates.length})`}
          </button>
        </div>
      )}

      <SettingsStatStrip stats={[
        { label:'งานจ้างทั้งหมด', value: items.length, sub:`${items.filter(p=>p.active).length} Active` },
        { label:'ประเภท',         value: cats.length, sub:`${cats.filter(c=>c.active).length} Active` },
      ]} />

      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหา ประเภท / งานจ้าง / รหัส…" />
        <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
          <button className="btn sm" onClick={expandAll}>ขยายทั้งหมด</button>
          <button className="btn sm" onClick={collapseAll}>ย่อทั้งหมด</button>
        </div>
      </div>

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>
      )}

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--ink-3)' }}>กำลังโหลด…</div>
        ) : tree.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--ink-3)' }}>
            {isSearching ? 'ไม่พบประเภทที่ตรงกับคำค้น' : 'ยังไม่มีประเภท — คลิก "เพิ่มประเภท" เพื่อเริ่ม'}
          </div>
        ) : tree.map(cat => {
          const isOpen = expandedCats.has(cat.id) || isSearching;
          const itemsShown = isSearching ? cat.itemsFiltered : cat.items;
          return (
            <div key={cat.id} style={{ borderBottom:'1px solid var(--rule)' }}>
              <TreeRow
                level={1}
                isOpen={isOpen}
                onToggle={() => toggleCat(cat.id)}
                tag={<Badge bg="#E3EAD3" fg="#3D5224">ประเภท</Badge>}
                title={cat.name}
                meta={`${cat.items.length} ชิ้นงานจ้าง`}
                statusActive={cat.active}
                actions={
                  <>
                    <ActionBtn label="+ ชิ้นงานจ้าง" onClick={(e) => { e.stopPropagation(); setAdding({ level:'item', parentCatName: cat.name }); }} />
                    <IconBtn icon={Icons.edit} title="แก้ไข" onClick={(e) => { e.stopPropagation(); setEditing({ level:'cat', item: cat }); }} />
                    <IconBtn icon="×" title="ลบ" danger onClick={(e) => { e.stopPropagation(); removeCat(cat); }} />
                  </>
                }
              />
              {isOpen && itemsShown.length === 0 && (
                <div style={{ padding:'10px 24px 10px 68px', fontSize:12, color:'var(--ink-4)', fontStyle:'italic', background:'var(--surface-2)', borderTop:'1px solid var(--rule)' }}>
                  {isSearching ? 'ไม่มีรายการที่ตรง' : 'ยังไม่มีชิ้นงานจ้าง — คลิก "+ ชิ้นงานจ้าง" ด้านบนเพื่อเพิ่ม'}
                </div>
              )}
              {isOpen && itemsShown.map(it => {
                const unit = unitsById[it.unit_id];
                return (
                  <div key={it.id} style={{
                    display:'grid', gridTemplateColumns:'68px 90px 1fr 90px 110px 90px',
                    alignItems:'center', gap:10, padding:'8px 24px',
                    background:'var(--surface-2)', borderTop:'1px solid var(--rule)',
                    fontSize:12.5,
                  }}>
                    <span /> {/* indent */}
                    <span className="font-mono" style={{ fontSize:11.5, color:'var(--ink-3)' }}>{it.code}</span>
                    <span style={{ fontWeight:500, color:'var(--ink)' }}>{it.name}</span>
                    <span style={{ color:'var(--ink-2)' }}>{unit ? unit.code : '—'}</span>
                    <StatusPill status={it.active ? 'Active' : 'Non-Active'} />
                    <span style={{ textAlign:'right' }}>
                      <IconBtn icon={Icons.edit} title="แก้ไข" onClick={() => setEditing({ level:'item', item: it })} />
                      <IconBtn icon="×" title="ลบ" danger onClick={() => removeItem(it)} />
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}

        {!isSearching && orphans.length > 0 && (
          <div style={{ padding:'12px 24px', background:'var(--clay-soft)', borderTop:'1px solid var(--rule)', fontSize:12.5, color:'#6B2D1A' }}>
            ⚠ พบ <strong>{orphans.length}</strong> รายการที่ไม่ตรงกับ master (ประเภทถูกเปลี่ยนชื่อหรือลบ)
            <details style={{ marginTop:8 }}>
              <summary style={{ cursor:'pointer', fontWeight:500 }}>แสดง {orphans.length} รายการ</summary>
              <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4 }}>
                {orphans.map(o => (
                  <div key={o.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span className="font-mono" style={{ fontSize:11.5 }}>{o.code}</span>
                    <span style={{ fontWeight:500 }}>{o.name}</span>
                    <span style={{ fontSize:11, color:'var(--ink-3)' }}>(ประเภท {o.category || '—'})</span>
                    <button className="btn ghost sm" onClick={() => setEditing({ level:'item', item: o })} style={{ marginLeft:'auto', padding:'2px 8px' }}>แก้</button>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* ---------- Modals ---------- */}
      {(editing?.level === 'cat' || adding?.level === 'cat') && (
        <CategoryModal
          item={editing?.level === 'cat' ? editing.item : null}
          onClose={() => { setEditing(null); setAdding(null); }}
          onSaved={() => { setEditing(null); setAdding(null); load(); }}
        />
      )}
      {(editing?.level === 'item' || adding?.level === 'item') && (
        <SubcontractModal
          item={editing?.level === 'item' ? editing.item : { category: adding.parentCatName }}
          units={units}
          cats={cats}
          existingCodes={items.map(i => i.code).filter(Boolean)}
          onClose={() => { setEditing(null); setAdding(null); }}
          onSaved={() => { setEditing(null); setAdding(null); load(); }}
        />
      )}

      {bulkOpen && (
        <BulkUploadModal
          title="เพิ่มหลายรายการ · งานจ้างเหมา"
          entity="งานจ้าง"
          endpoint="/api/subcontracts"
          columns={[
            { key:'category', label:'ประเภท',       required:true, hint:'Level 1',
              options: cats.filter(c => c.active).map(c => c.name) },
            { key:'name',     label:'ชื่องานจ้าง',     required:true, hint:'Level 2 (Item)' },
            { key:'unit',     label:'หน่วย',          hint:'code เช่น m, ครั้ง' },
            { key:'status',   label:'สถานะ',          hint:'Active / Non-Active' },
          ]}
          sampleRow="ประเภท	ชื่องานจ้าง	หน่วย	สถานะ
จ้างออกแบบ	จ้างออกแบบงานวิศวกรรม	งาน	Active
งานโครงสร้าง	งานเสาเข็มตอก	เส้น	Active"
          transform={(row, ctx) => {
            const allCodes = [...items.map(i => i.code).filter(Boolean), ...ctx.usedCodes];
            const code = nextSubcontractCode(allCodes);
            const unit = findUnit(units, row.unit);
            const active = (row.status || 'Active').toLowerCase() !== 'non-active';
            return {
              code,
              category: row.category || '',
              name: row.name,
              unit_id: unit?.id || null,
              active,
            };
          }}
          onClose={() => setBulkOpen(false)}
          onDone={() => { load(); }}
        />
      )}
    </div>
  );
}

/* =================== Tree row + helpers =================== */

function TreeRow({ level, isOpen, onToggle, tag, title, meta, statusActive, actions }) {
  const indent = (level - 1) * 24;
  return (
    <div
      onClick={onToggle}
      style={{
        display:'flex', alignItems:'center', gap:10,
        padding:`12px 16px 12px ${16 + indent}px`,
        cursor:'pointer', userSelect:'none', background:'var(--paper)',
      }}>
      <span style={{
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        width:18, height:18, color:'var(--ink-3)',
        transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
        transition: 'transform 0.15s', flexShrink: 0,
      }}>{Icons.chevronD}</span>
      {tag}
      <span style={{ fontWeight:500, fontSize:14, color: statusActive ? 'var(--ink)' : 'var(--ink-3)' }}>{title}</span>
      <span style={{ fontSize:11.5, color:'var(--ink-3)' }}>· {meta}</span>
      {!statusActive && (
        <span style={{ padding:'1px 8px', borderRadius:999, background:'var(--paper-2)', color:'var(--ink-3)', fontSize:10, fontWeight:500 }}>Non-Active</span>
      )}
      <span style={{ marginLeft:'auto', display:'inline-flex', gap:4 }}>{actions}</span>
    </div>
  );
}

function Badge({ bg, fg, children }) {
  return (
    <span style={{ padding:'2px 8px', borderRadius:4, background:bg, color:fg, fontSize:10, fontWeight:600, letterSpacing:0.4, flexShrink:0 }}>{children}</span>
  );
}
function ActionBtn({ label, onClick }) {
  return (
    <button className="btn ghost sm" onClick={onClick} style={{ padding:'2px 8px', fontSize:11, color:'var(--teal-ink)' }}>{label}</button>
  );
}
function IconBtn({ icon, title, danger, onClick }) {
  return (
    <button className="btn ghost sm" onClick={onClick} title={title} style={{ padding:'2px 6px', color: danger ? 'var(--clay)' : 'var(--ink-3)', fontSize:13 }}>{icon}</button>
  );
}

/* =================== Category (Level 1) modal =================== */

function CategoryModal({ item, onClose, onSaved }) {
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
    if (!form.name.trim()) { setErr('กรอกชื่อประเภท'); return; }
    setBusy(true);
    const payload = { name: form.name.trim(), notes: form.notes, active: form.active };
    if (isEdit) payload.id = item.id;
    const res = await fetch('/api/subcontract-categories', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      const friendly = !isEdit && /duplicate|unique/i.test(data.error || '')
        ? 'ชื่อประเภทนี้มีอยู่แล้ว'
        : (data.error || 'บันทึกไม่สำเร็จ');
      setErr(friendly); setBusy(false); return;
    }
    setBusy(false);
    onSaved();
  }

  return (
    <SettingsModal eyebrow={isEdit ? 'แก้ไขประเภท' : 'เพิ่มประเภท'} title={isEdit ? item.name : 'ประเภทใหม่'} onClose={onClose} width={520}>
      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:14 }}>
        <SettingsField label="ชื่อประเภท" required hint="เช่น จ้างออกแบบ">
          <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="จ้างออกแบบ" style={settingsInputStyle} />
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

/* =================== Item (Level 2) modal =================== */

function SubcontractModal({ item, units, cats, existingCodes, onClose, onSaved }) {
  // isEdit only when we have a real row id; partial item objects used to
  // prefill the parent category from the tree are still treated as POST.
  const isEdit = !!item?.id;
  const [form, setForm] = useState({
    code:     item?.code || nextSubcontractCode(existingCodes),
    name:     item?.name     || '',
    category: item?.category || '',
    unit_id:  item?.unit_id  || '',
    notes:    item?.notes    || '',
    active:   item?.active !== false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const activeCats = (cats || []).filter(c => c.active);

  async function save() {
    setErr('');
    if (!form.category.trim()) { setErr('เลือกประเภท'); return; }
    if (!form.name.trim()) { setErr('กรอกชื่องานจ้าง'); return; }
    setBusy(true);
    const payload = {
      code:     form.code,
      name:     form.name,
      category: form.category,
      unit_id:  form.unit_id || null,
      notes:    form.notes,
      active:   form.active,
    };
    if (isEdit) payload.id = item.id;
    const res = await fetch('/api/subcontracts', {
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
    <SettingsModal eyebrow={isEdit ? 'แก้ไขงานจ้าง' : 'เพิ่มงานจ้างใหม่'} title={isEdit ? item.name : 'งานจ้างใหม่'} onClose={onClose} width={600}>
      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:14 }}>
        <SettingsField label="รหัส" hint={isEdit ? 'แก้ไม่ได้' : 'ระบบสร้างให้อัตโนมัติ'}>
          <input value={form.code} readOnly disabled
            style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)', background:'var(--paper-2)', color:'var(--ink-3)' }} />
        </SettingsField>
        <SettingsField label="ประเภท (Level 1)" required>
          <select value={form.category} onChange={e=>set('category', e.target.value)} style={settingsInputStyle}>
            <option value="">— เลือกประเภท —</option>
            {activeCats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </SettingsField>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="ชื่องานจ้าง (Item)" required hint="Level 2 — รายการสุดท้าย">
            <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เช่น จ้างออกแบบงานวิศวกรรม" style={settingsInputStyle} />
          </SettingsField>
        </div>
        <SettingsField label="หน่วย">
          <UnitPicker units={units} value={form.unit_id} onChange={(id)=>set('unit_id', id)} />
        </SettingsField>
        <div />
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="หมายเหตุ">
            <textarea value={form.notes} onChange={e=>set('notes', e.target.value)}
                      placeholder="(ไม่บังคับ)"
                      style={{ ...settingsInputStyle, minHeight:60, resize:'vertical', fontFamily:'inherit' }} />
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
