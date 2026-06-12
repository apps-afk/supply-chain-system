'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle, BulkUploadModal, findUnit, UnitPicker } from '../lib/settings-shared';
import { MainCategoryModal } from './screen-settings-material-main-categories';
import { SubCategoryModal }  from './screen-settings-material-sub-categories';

/*
  Settings → วัสดุก่อสร้าง (single-page hierarchical browser)

  Tree view of all three levels:
    Level 1: หมวดหลัก (material_main_categories master)
      Level 2: หมวดย่อย (material_sub_categories master, FK to main)
        Level 3: รายการ (materials, denormalized main_category + category strings)

  Each row in the tree is collapsible. Inline action buttons let admin
  edit / delete the entity at its level, plus add a child below it.

  Materials rows still store main_category + category as STRINGS for
  backward compat. When adding via the modal here, the strings are
  copied from the master row's name at save time.
*/

// Auto-code helper — global MAT-NNNNN counter across all items.
function nextMaterialCode(existing) {
  let max = 0;
  for (const c of existing || []) {
    const m = /^MAT-(\d+)$/.exec(String(c).trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `MAT-${String(max + 1).padStart(5, '0')}`;
}


export function ScreenSettingsMaterials({ go }) {
  const [items, setItems]     = useState([]);
  const [units, setUnits]     = useState([]);
  const [mainCats, setMainCats] = useState([]);
  const [subCats,  setSubCats]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [q, setQ]             = useState('');

  // Collapse state per main / per sub. Default: collapsed — user clicks
  // to drill in. Search auto-expands everything so matches are visible.
  const [expandedMains, setExpandedMains] = useState(() => new Set());
  const [expandedSubs,  setExpandedSubs]  = useState(() => new Set());

  // Modal state — supports both edit (existing row) and add (with prefilled
  // parent IDs/names when launched from inline "+ ..." buttons).
  const [editing, setEditing] = useState(null);   // {level, item}
  const [adding,  setAdding]  = useState(null);   // {level, parentMainId?, parentMainName?, parentSubName?}
  const [bulkOpen, setBulkOpen] = useState(false);

  async function load() {
    setLoading(true); setErr('');
    try {
      const [mRes, uRes, mcRes, scRes] = await Promise.all([
        fetch('/api/materials'),
        fetch('/api/units'),
        fetch('/api/material-main-categories'),
        fetch('/api/material-sub-categories'),
      ]);
      const m  = await mRes.json();
      const u  = await uRes.json();
      const mc = await mcRes.json();
      const sc = await scRes.json();
      if (!mRes.ok) setErr(m.error || 'โหลดข้อมูลไม่สำเร็จ');
      else setItems(m.items || []);
      if (uRes.ok) setUnits(u.items || []);
      if (mcRes.ok) setMainCats(mc.items || []);
      if (scRes.ok) setSubCats(sc.items || []);
    } catch { setErr('เครือข่ายขัดข้อง'); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Build lookup maps + tree
  const unitsById     = useMemo(() => Object.fromEntries(units.map(u => [u.id, u])), [units]);
  const mainByName    = useMemo(() => Object.fromEntries(mainCats.map(m => [m.name, m])), [mainCats]);
  const subsByMainId  = useMemo(() => {
    const acc = {};
    for (const s of subCats) (acc[s.main_id] = acc[s.main_id] || []).push(s);
    return acc;
  }, [subCats]);
  const itemsByPair   = useMemo(() => {
    const acc = {};
    for (const it of items) {
      const key = `${it.main_category || ''}|||${it.category || ''}`;
      (acc[key] = acc[key] || []).push(it);
    }
    return acc;
  }, [items]);

  const isSearching = q.trim().length > 0;
  const qLower = q.toLowerCase().trim();
  const matches = (s) => !qLower || (s || '').toLowerCase().includes(qLower);

  // Compute filtered tree for display. When searching, ancestors of any
  // matching child are kept (and auto-expanded).
  const tree = useMemo(() => {
    return mainCats.map(main => {
      const allSubs = (subsByMainId[main.id] || []);
      const subs = allSubs.map(sub => {
        const itemsHere = itemsByPair[`${main.name}|||${sub.name}`] || [];
        const itemsFiltered = isSearching
          ? itemsHere.filter(it => matches(it.name) || matches(it.code) || matches(it.spec))
          : itemsHere;
        const matched = matches(sub.name) || matches(main.name) || itemsFiltered.length > 0;
        return { ...sub, items: itemsHere, itemsFiltered, matched };
      });
      const subsFiltered = isSearching ? subs.filter(s => s.matched) : subs;
      const matched = matches(main.name) || subsFiltered.length > 0;
      const totalItems = subs.reduce((n, s) => n + s.items.length, 0);
      return { ...main, subs, subsFiltered, matched, totalItems };
    }).filter(m => !isSearching || m.matched);
  }, [mainCats, subsByMainId, itemsByPair, q, isSearching]);

  // Orphan bucket — materials whose main_category isn't in the master.
  // Surfaced so admin notices and can fix the mismatch (rename master,
  // or move the items to a known category).
  const orphans = useMemo(() => {
    return items.filter(it => !mainByName[it.main_category] || !(subsByMainId[mainByName[it.main_category]?.id] || []).some(s => s.name === it.category));
  }, [items, mainByName, subsByMainId]);

  const stats = {
    items: items.length,
    mains: mainCats.length,
    subs:  subCats.length,
  };

  function toggleMain(id) {
    setExpandedMains(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleSub(id) {
    setExpandedSubs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function expandAll() {
    setExpandedMains(new Set(mainCats.map(m => m.id)));
    setExpandedSubs(new Set(subCats.map(s => s.id)));
  }
  function collapseAll() {
    setExpandedMains(new Set());
    setExpandedSubs(new Set());
  }

  async function removeMain(m) {
    const childSubs = (subsByMainId[m.id] || []);
    if (childSubs.length > 0) {
      alert(`ลบไม่ได้ — หมวดหลัก "${m.name}" มีหมวดย่อย ${childSubs.length} รายการ\nลบหมวดย่อยก่อนแล้วค่อยลบหมวดหลัก`);
      return;
    }
    if (!confirm(`ลบหมวดหลัก "${m.name}"?`)) return;
    const r = await fetch('/api/material-main-categories', {
      method:'DELETE', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ id: m.id }),
    });
    if (!r.ok) { const d = await r.json().catch(()=>({})); alert(d.error || 'ลบไม่สำเร็จ'); }
    load();
  }
  async function removeSub(s) {
    const main = mainCats.find(m => m.id === s.main_id);
    const itemsHere = (itemsByPair[`${main?.name || ''}|||${s.name}`] || []);
    if (itemsHere.length > 0) {
      alert(`ลบไม่ได้ — หมวดย่อย "${s.name}" มีรายการ ${itemsHere.length} วัสดุอยู่\nลบรายการก่อนแล้วค่อยลบหมวดย่อย`);
      return;
    }
    if (!confirm(`ลบหมวดย่อย "${s.name}"?`)) return;
    const r = await fetch('/api/material-sub-categories', {
      method:'DELETE', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ id: s.id }),
    });
    if (!r.ok) { const d = await r.json().catch(()=>({})); alert(d.error || 'ลบไม่สำเร็จ'); }
    load();
  }
  async function removeItem(it) {
    if (!confirm(`ลบวัสดุ "${it.name}"?`)) return;
    const r = await fetch('/api/materials', {
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
          <h1 className="h-display">วัสดุก่อสร้าง</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:640 }}>
            ระบบ 3 ระดับ · <strong style={{ color:'var(--ink-2)' }}>หมวดหลัก → หมวดย่อย → รายการ</strong> ·
            กดที่แถวเพื่อย่อ/ขยาย
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" onClick={() => setBulkOpen(true)}>{Icons.upload} เพิ่มหลายรายการ</button>
          <button className="btn primary" onClick={() => setAdding({ level:'main' })}>{Icons.plus} เพิ่มหมวดหลัก</button>
        </div>
      </div>

      <SettingsStatStrip stats={[
        { label:'วัสดุทั้งหมด', value: stats.items, sub:`${items.filter(p=>p.active).length} Active` },
        { label:'หมวดหลัก',    value: stats.mains, sub:`${mainCats.filter(m=>m.active).length} Active` },
        { label:'หมวดย่อย',    value: stats.subs,  sub:`${subCats.filter(s=>s.active).length} Active` },
      ]} />

      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหา หมวด / รายการ / รหัส…" />
        <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
          <button className="btn sm" onClick={expandAll}>ขยายทั้งหมด</button>
          <button className="btn sm" onClick={collapseAll}>ย่อทั้งหมด</button>
        </div>
      </div>

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>
      )}

      {/* Tree */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--ink-3)' }}>กำลังโหลด…</div>
        ) : tree.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--ink-3)' }}>
            {isSearching
              ? 'ไม่พบหมวดที่ตรงกับคำค้น'
              : 'ยังไม่มีหมวดหลัก — คลิก "เพิ่มหมวดหลัก" เพื่อเริ่ม'}
          </div>
        ) : tree.map(main => {
          const isOpen = expandedMains.has(main.id) || isSearching;
          const subsShown = isSearching ? main.subsFiltered : main.subs;
          return (
            <div key={main.id} style={{ borderBottom:'1px solid var(--rule)' }}>
              {/* Level 1 row */}
              <TreeRow
                level={1}
                isOpen={isOpen}
                onToggle={() => toggleMain(main.id)}
                tag={<Badge bg="#E3EAD3" fg="#3D5224">Level 1</Badge>}
                title={main.name}
                meta={`${main.subs.length} หมวดย่อย · ${main.totalItems} รายการ`}
                statusActive={main.active}
                actions={
                  <>
                    <ActionBtn label="+ หมวดย่อย" onClick={(e) => { e.stopPropagation(); setAdding({ level:'sub', parentMainId: main.id, parentMainName: main.name }); }} />
                    <IconBtn icon={Icons.edit} title="แก้ไข" onClick={(e) => { e.stopPropagation(); setEditing({ level:'main', item: main }); }} />
                    <IconBtn icon="×" title="ลบ" danger onClick={(e) => { e.stopPropagation(); removeMain(main); }} />
                  </>
                }
              />

              {/* Level 2 children */}
              {isOpen && subsShown.map(sub => {
                const subOpen = expandedSubs.has(sub.id) || isSearching;
                const itemsShown = isSearching ? sub.itemsFiltered : sub.items;
                return (
                  <div key={sub.id} style={{ background:'var(--surface-2)', borderTop:'1px solid var(--rule)' }}>
                    <TreeRow
                      level={2}
                      isOpen={subOpen}
                      onToggle={() => toggleSub(sub.id)}
                      tag={<Badge bg="var(--teal-soft)" fg="var(--teal-ink)">Level 2</Badge>}
                      title={sub.name}
                      meta={`${sub.items.length} รายการ`}
                      statusActive={sub.active}
                      actions={
                        <>
                          <ActionBtn label="+ รายการ" onClick={(e) => { e.stopPropagation(); setAdding({ level:'item', parentMainName: main.name, parentSubName: sub.name }); }} />
                          <IconBtn icon={Icons.edit} title="แก้ไข" onClick={(e) => { e.stopPropagation(); setEditing({ level:'sub', item: sub }); }} />
                          <IconBtn icon="×" title="ลบ" danger onClick={(e) => { e.stopPropagation(); removeSub(sub); }} />
                        </>
                      }
                    />

                    {/* Level 3 children */}
                    {subOpen && itemsShown.length === 0 && (
                      <div style={{ padding:'10px 24px 10px 92px', fontSize:12, color:'var(--ink-4)', fontStyle:'italic' }}>
                        {isSearching ? 'ไม่มีรายการที่ตรง' : 'ยังไม่มีรายการ — คลิก "+ รายการ" ด้านบนเพื่อเพิ่ม'}
                      </div>
                    )}
                    {subOpen && itemsShown.map(it => {
                      const unit = unitsById[it.unit_id];
                      return (
                        <div key={it.id} style={{
                          display:'grid', gridTemplateColumns:'92px 90px 1fr 1fr 80px 100px 110px',
                          alignItems:'center', gap:10, padding:'8px 24px',
                          background:'var(--paper)', borderTop:'1px solid var(--rule)',
                          fontSize:12.5,
                        }}>
                          <span /> {/* indent */}
                          <span className="font-mono" style={{ fontSize:11.5, color:'var(--ink-3)' }}>{it.code}</span>
                          <span style={{ fontWeight:500, color:'var(--ink)' }}>{it.name}</span>
                          <span style={{ color:'var(--ink-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{it.spec || '—'}</span>
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
            </div>
          );
        })}

        {/* Orphans bucket */}
        {!isSearching && orphans.length > 0 && (
          <div style={{ padding:'12px 24px', background:'var(--clay-soft)', borderTop:'1px solid var(--rule)', fontSize:12.5, color:'#6B2D1A' }}>
            ⚠ พบ <strong>{orphans.length}</strong> รายการที่ไม่ตรงกับ master (หมวดหลัก/หมวดย่อยถูกเปลี่ยนชื่อหรือลบ) —
            ดูได้ในตารางและแก้ไขให้ตรงกัน
            <details style={{ marginTop:8 }}>
              <summary style={{ cursor:'pointer', fontWeight:500 }}>แสดง {orphans.length} รายการ</summary>
              <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4 }}>
                {orphans.map(o => (
                  <div key={o.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span className="font-mono" style={{ fontSize:11.5 }}>{o.code}</span>
                    <span style={{ fontWeight:500 }}>{o.name}</span>
                    <span style={{ fontSize:11, color:'var(--ink-3)' }}>(เก็บไว้ใต้ {o.main_category || '—'} / {o.category || '—'})</span>
                    <button className="btn ghost sm" onClick={() => setEditing({ level:'item', item: o })} style={{ marginLeft:'auto', padding:'2px 8px' }}>แก้</button>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* ---------- Modals ---------- */}
      {(editing?.level === 'main' || adding?.level === 'main') && (
        <MainCategoryModal
          item={editing?.level === 'main' ? editing.item : null}
          onClose={() => { setEditing(null); setAdding(null); }}
          onSaved={() => { setEditing(null); setAdding(null); load(); }}
        />
      )}
      {(editing?.level === 'sub' || adding?.level === 'sub') && (
        <SubCategoryModal
          item={editing?.level === 'sub' ? editing.item : { main_id: adding.parentMainId }}
          mains={mainCats}
          onClose={() => { setEditing(null); setAdding(null); }}
          onSaved={() => { setEditing(null); setAdding(null); load(); }}
        />
      )}
      {(editing?.level === 'item' || adding?.level === 'item') && (
        <MaterialModal
          item={editing?.level === 'item' ? editing.item : { main_category: adding.parentMainName, category: adding.parentSubName }}
          units={units}
          mainCats={mainCats}
          subCats={subCats}
          existingCodes={items.map(i => i.code).filter(Boolean)}
          go={go}
          onClose={() => { setEditing(null); setAdding(null); }}
          onSaved={() => { setEditing(null); setAdding(null); load(); }}
        />
      )}

      {bulkOpen && (
        <BulkUploadModal
          title="เพิ่มหลายรายการ · วัสดุ"
          entity="วัสดุ"
          endpoint="/api/materials"
          columns={[
            { key:'main_category', label:'หมวดหลัก',   required:true, hint:'Level 1',
              options: mainCats.filter(m => m.active).map(m => m.name) },
            { key:'category',      label:'หมวดย่อย',   required:true, hint:'Level 2',
              options: subCats.filter(s => s.active).map(s => s.name) },
            { key:'name',          label:'ชื่อวัสดุ',   required:true, hint:'Level 3 (Item)' },
            { key:'spec',          label:'Spec' },
            { key:'unit',          label:'หน่วย',      hint:'code เช่น m, kg' },
            { key:'status',        label:'สถานะ',      hint:'Active / Non-Active' },
          ]}
          sampleRow="หมวดหลัก	หมวดย่อย	ชื่อวัสดุ	Spec	หน่วย	สถานะ
งานโครงสร้าง	เสาเข็ม	เสาเข็มตัวไอ I-22	22 x 22 cm	เส้น	Active
งานโครงสร้าง	คอนกรีต	คอนกรีตผสมเสร็จ 240ksc	240 ksc	ลบ.ม.	Active"
          transform={(row, ctx) => {
            const allCodes = [...items.map(i => i.code).filter(Boolean), ...ctx.usedCodes];
            const code = nextMaterialCode(allCodes);
            const unit = findUnit(units, row.unit);
            const active = (row.status || 'Active').toLowerCase() !== 'non-active';
            return {
              code,
              main_category: row.main_category || '',
              category: row.category || '',
              name: row.name,
              spec: row.spec || '',
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
        cursor:'pointer', userSelect:'none',
        background: level === 1 ? 'var(--paper)' : undefined,
      }}>
      <span style={{
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        width:18, height:18, color:'var(--ink-3)',
        transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
        transition: 'transform 0.15s',
        flexShrink: 0,
      }}>{Icons.chevronD}</span>
      {tag}
      <span style={{
        fontWeight: 500,
        fontSize: level === 1 ? 14 : 13,
        color: statusActive ? 'var(--ink)' : 'var(--ink-3)',
      }}>{title}</span>
      <span style={{ fontSize:11.5, color:'var(--ink-3)' }}>· {meta}</span>
      {!statusActive && (
        <span style={{ padding:'1px 8px', borderRadius:999, background:'var(--paper-2)', color:'var(--ink-3)', fontSize:10, fontWeight:500 }}>Non-Active</span>
      )}
      <span style={{ marginLeft:'auto', display:'inline-flex', gap:4 }}>
        {actions}
      </span>
    </div>
  );
}

function Badge({ bg, fg, children }) {
  return (
    <span style={{
      padding:'2px 8px', borderRadius:4, background:bg, color:fg,
      fontSize:10, fontWeight:600, letterSpacing:0.4, flexShrink:0,
    }}>{children}</span>
  );
}

function ActionBtn({ label, onClick }) {
  return (
    <button className="btn ghost sm" onClick={onClick}
      style={{ padding:'2px 8px', fontSize:11, color:'var(--teal-ink)' }}>
      {label}
    </button>
  );
}

function IconBtn({ icon, title, danger, onClick }) {
  return (
    <button className="btn ghost sm" onClick={onClick} title={title}
      style={{ padding:'2px 6px', color: danger ? 'var(--clay)' : 'var(--ink-3)', fontSize:13 }}>
      {icon}
    </button>
  );
}

/* =================== Item modal =================== */

function MaterialModal({ item, units, mainCats, subCats, existingCodes, go, onClose, onSaved }) {
  // isEdit only when we have a real row id; partial item objects used to
  // prefill parent main/sub from the tree view are still treated as POST.
  const isEdit = !!item?.id;
  const [form, setForm] = useState({
    code:          item?.code          || nextMaterialCode(existingCodes),
    name:          item?.name          || '',
    main_category: item?.main_category || '',
    category:      item?.category      || '',
    unit_id:       item?.unit_id       || '',
    spec:          item?.spec          || '',
    notes:         item?.notes         || '',
    active:        item?.active !== false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const activeMains = (mainCats || []).filter(m => m.active);
  const currentMain = (mainCats || []).find(m => m.name === form.main_category);
  const activeSubs  = (subCats || []).filter(s => s.active && (!currentMain || s.main_id === currentMain.id));

  async function save() {
    setErr('');
    if (!form.main_category.trim() || !form.category.trim() || !form.name.trim()) {
      setErr('กรอกหมวดหลัก / หมวดย่อย / ชื่อวัสดุให้ครบ'); return;
    }
    setBusy(true);
    const payload = {
      code:          form.code,
      name:          form.name,
      main_category: form.main_category,
      category:      form.category,
      unit_id:       form.unit_id || null,
      spec:          form.spec,
      notes:         form.notes,
      active:        form.active,
    };
    if (isEdit) payload.id = item.id;
    const res = await fetch('/api/materials', {
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
    <SettingsModal eyebrow={isEdit ? 'แก้ไขวัสดุ' : 'เพิ่มวัสดุใหม่'} title={isEdit ? item.name : 'วัสดุใหม่'} onClose={onClose} width={620}>
      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <SettingsField label="รหัส" hint={isEdit ? 'แก้ไม่ได้' : 'ระบบสร้างให้อัตโนมัติ'}>
          <input value={form.code} readOnly disabled
            style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)', background:'var(--paper-2)', color:'var(--ink-3)' }} />
        </SettingsField>
        <SettingsField label="หมวดหลัก (Level 1)" required>
          <select value={form.main_category}
            onChange={e=>setForm(f => ({ ...f, main_category: e.target.value, category: '' }))}
            style={settingsInputStyle}>
            <option value="">— เลือกหมวดหลัก —</option>
            {activeMains.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </SettingsField>
        <SettingsField label="หมวดย่อย (Level 2)" required>
          <select value={form.category}
            onChange={e=>set('category', e.target.value)}
            disabled={!form.main_category}
            style={settingsInputStyle}>
            <option value="">{form.main_category ? '— เลือกหมวดย่อย —' : '(เลือกหมวดหลักก่อน)'}</option>
            {activeSubs.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </SettingsField>
        <SettingsField label="หน่วย">
          <UnitPicker units={units} value={form.unit_id} onChange={(id)=>set('unit_id', id)} />
        </SettingsField>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="ชื่อวัสดุ (Item)" required hint="Level 3 — รายการสุดท้าย">
            <input value={form.name} onChange={e=>set('name', e.target.value)}
              placeholder="เช่น เสาเข็มตัวไอ I-22" style={settingsInputStyle} />
          </SettingsField>
        </div>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="Spec">
            <input value={form.spec} onChange={e=>set('spec', e.target.value)} placeholder="คุณลักษณะ / รุ่น / Grade" style={settingsInputStyle} />
          </SettingsField>
        </div>
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
