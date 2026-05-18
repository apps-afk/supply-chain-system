/* global React, Icons, Chip, settingsInputStyle, SettingsField, SettingsModal, SettingsSearchBox, StatusPill, StatusToggle, BulkExcelButton */
/*
  Reusable 2-level master (Category → Item) for Material List and SubContract List.
  Item code format: {PREFIX}-{CategoryShortCode}-{NNNNN}

  Per requirements:
  - No reference price in Add Item modal
  - Status per item (Active / Non-Active)
  - Bulk Excel button
  - Simplified summary card
*/

const { useState: useStateTL } = React;

function TwoLevelMasterPage({
  prefix,
  pageTitle,
  eyebrowAbove,
  intro,
  categoryNoun,
  itemNoun,
  categories,
  unitOptions,
  bulkEntity,    // string for Bulk Excel modal title
  bulkColumns,   // columns for Bulk Excel template
  bulkSamples,   // sample rows
}) {
  const [selectedCat, setSelectedCat] = useStateTL(categories[0]?.short || null);
  const [q, setQ]                     = useStateTL('');
  const [addCatOpen, setAddCatOpen]   = useStateTL(false);
  const [addItemOpen, setAddItemOpen] = useStateTL(false);

  const totalItems   = categories.reduce((s,c) => s + c.items.length, 0);
  const activeItems  = categories.reduce((s,c) => s + c.items.filter(i => (i.status || 'Active') === 'Active').length, 0);

  const active = categories.find(c => c.short === selectedCat);
  const filteredItems = (active?.items || []).filter(it => {
    if (!q) return true;
    const v = q.toLowerCase();
    return it.name.toLowerCase().includes(v) || it.code.toLowerCase().includes(v) || (it.spec && it.spec.toLowerCase().includes(v));
  });

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">{eyebrowAbove}</div>
          <h1 className="h-display">{pageTitle}</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:640 }}>
            {intro} — รหัสรูปแบบ <span className="font-mono" style={{ color:'var(--ink-2)' }}>{prefix}-[Short Code]-NNNNN</span>
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {bulkColumns && (
            <BulkExcelButton entity={bulkEntity} columns={bulkColumns} sampleRows={bulkSamples || []} />
          )}
          <button className="btn">{Icons.download} Export</button>
          <button className="btn" onClick={() => setAddCatOpen(true)}>{Icons.plus} เพิ่ม{categoryNoun}</button>
          <button className="btn primary" onClick={() => setAddItemOpen(true)}>{Icons.plus} เพิ่ม{itemNoun}</button>
        </div>
      </div>

      {/* Simplified summary: category count + Active item count */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 1fr', gap:0,
        borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)',
        padding:'24px 0', marginBottom:32,
      }}>
        <div>
          <div className="stat-label">{categoryNoun}ทั้งหมด</div>
          <div className="stat-value">{categories.length}</div>
          <div className="stat-sub">Level 1 — มี Short Code</div>
        </div>
        <div style={{ paddingLeft:28, borderLeft:'1px solid var(--rule)' }}>
          <div className="stat-label">{itemNoun}ทั้งหมด</div>
          <div className="stat-value">{totalItems.toLocaleString()}</div>
          <div style={{ display:'flex', gap:14, marginTop:8, fontSize:12 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--moss)' }} />
              <span style={{ color:'var(--ink-3)' }}>Active</span>
              <strong style={{ color:'var(--ink)' }}>{activeItems}</strong>
            </span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--ink-4)' }} />
              <span style={{ color:'var(--ink-3)' }}>Non-Active</span>
              <strong style={{ color:'var(--ink)' }}>{totalItems - activeItems}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Two-pane layout */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', minHeight:540 }}>
          <div style={{ borderRight:'1px solid var(--rule)', background:'var(--surface-2)' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--rule)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div className="eyebrow" style={{ marginBottom:2 }}>{categoryNoun}</div>
                <div style={{ fontSize:11.5, color:'var(--ink-3)' }}>{categories.length} หมวด</div>
              </div>
              <button className="btn ghost sm" onClick={() => setAddCatOpen(true)} style={{ padding:'4px 6px' }} title={`เพิ่ม${categoryNoun}`}>
                {Icons.plus}
              </button>
            </div>
            <div style={{ overflowY:'auto', maxHeight:480 }}>
              {categories.map(c => {
                const sel = c.short === selectedCat;
                return (
                  <div key={c.short}
                    onClick={() => setSelectedCat(c.short)}
                    style={{
                      padding:'12px 18px',
                      cursor:'pointer',
                      background: sel ? 'var(--surface)' : 'transparent',
                      borderLeft: sel ? '3px solid var(--teal)' : '3px solid transparent',
                      borderBottom:'1px solid var(--rule)',
                      display:'flex', alignItems:'flex-start', gap:12,
                    }}>
                    <span style={{
                      display:'inline-block', padding:'3px 8px', borderRadius:4,
                      background: sel ? 'var(--teal)' : 'var(--paper-2)',
                      color: sel ? 'var(--paper)' : 'var(--ink-2)',
                      fontFamily:'var(--font-mono)', fontSize:11, fontWeight:600,
                      letterSpacing:0.02, minWidth:44, textAlign:'center',
                      flexShrink:0,
                    }}>{c.short}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight: sel ? 500 : 400, color: sel ? 'var(--ink)' : 'var(--ink-2)' }}>
                        {c.name}
                      </div>
                      <div className="font-mono" style={{ fontSize:10.5, color:'var(--ink-4)', marginTop:2 }}>
                        {c.code} · {c.items.length} {itemNoun}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background:'var(--surface)' }}>
            <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--rule)', display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
                  <h3 className="h-card">{active?.name || '—'}</h3>
                  <span className="font-mono" style={{ fontSize:11.5, color:'var(--ink-3)' }}>{active?.code}</span>
                </div>
                <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:3 }}>
                  {active?.desc || ''} · {filteredItems.length} {itemNoun}
                </div>
              </div>
              <SettingsSearchBox value={q} onChange={setQ} placeholder={`ค้นหา${itemNoun}…`} />
            </div>

            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width:'18%' }}>รหัส</th>
                  <th>ชื่อ{itemNoun}</th>
                  <th>Spec / รายละเอียด</th>
                  <th>หน่วย</th>
                  <th>สถานะ</th>
                  <th style={{ width:48 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(it => (
                  <tr key={it.code}>
                    <td className="font-mono" style={{ fontSize:11.5, color:'var(--ink-2)' }}>{it.code}</td>
                    <td style={{ fontWeight:500 }}>{it.name}</td>
                    <td style={{ fontSize:12.5, color:'var(--ink-3)' }}>{it.spec}</td>
                    <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{it.unit}</td>
                    <td><StatusPill status={it.status || 'Active'} /></td>
                    <td style={{ textAlign:'right' }}>
                      <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }}>{Icons.edit}</button>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr><td colSpan={6} style={{ padding:48, textAlign:'center', fontSize:13, color:'var(--ink-3)' }}>
                    ยังไม่มี{itemNoun}ในหมวดนี้ — กดปุ่ม "เพิ่ม{itemNoun}" ด้านบน
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {addCatOpen && (
        <AddCategoryModal prefix={prefix} categoryNoun={categoryNoun} itemNoun={itemNoun} categories={categories} onClose={() => setAddCatOpen(false)} />
      )}
      {addItemOpen && (
        <AddItemModal prefix={prefix} itemNoun={itemNoun} categories={categories} active={active} unitOptions={unitOptions} onClose={() => setAddItemOpen(false)} />
      )}
    </div>
  );
}

function AddCategoryModal({ prefix, categoryNoun, itemNoun, categories, onClose }) {
  const [form, setForm] = useStateTL({ short:'', name:'', desc:'', status:'Active' });
  const set = (k,v) => setForm({ ...form, [k]:v });
  const nextCatCode = `${prefix}C-${String(categories.length + 1).padStart(2,'0')}`;
  const previewItemCode = form.short
    ? `${prefix}-${form.short.toUpperCase()}-00001`
    : `${prefix}-—-00001`;

  return (
    <SettingsModal eyebrow={`เพิ่ม${categoryNoun}ใหม่`} title={`${categoryNoun} (Level 1)`} onClose={onClose}>
      <div style={{
        padding:'14px 16px', background:'var(--surface-2)',
        border:'1px solid var(--rule)', borderRadius:6, marginBottom:20,
      }}>
        <div className="eyebrow" style={{ marginBottom:6 }}>รหัส (auto-generate)</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            <div style={{ fontSize:11, color:'var(--ink-3)', marginBottom:2 }}>รหัสหมวด</div>
            <div className="font-mono" style={{ fontSize:16, color:'var(--teal)' }}>{nextCatCode}</div>
          </div>
          <div>
            <div style={{ fontSize:11, color:'var(--ink-3)', marginBottom:2 }}>ตัวอย่างรหัส{itemNoun}แรก</div>
            <div className="font-mono" style={{ fontSize:16, color: form.short ? 'var(--teal)' : 'var(--ink-4)' }}>{previewItemCode}</div>
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:14 }}>
        <SettingsField label="Short Code" required hint="2–4 ตัวอักษร · ใช้ในรหัส">
          <input value={form.short} onChange={e=>set('short', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}
                 placeholder="เช่น STR" maxLength={4}
                 style={{ ...settingsInputStyle, textTransform:'uppercase', fontFamily:'var(--font-mono)' }} />
        </SettingsField>
        <SettingsField label={`ชื่อ${categoryNoun}`} required>
          <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เช่น งานโครงสร้าง" style={settingsInputStyle} />
        </SettingsField>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="คำอธิบาย">
            <input value={form.desc} onChange={e=>set('desc', e.target.value)} placeholder="คำอธิบายสั้น ๆ" style={settingsInputStyle} />
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

function AddItemModal({ prefix, itemNoun, categories, active, unitOptions, onClose }) {
  const [catShort, setCatShort] = useStateTL(active?.short || categories[0]?.short || '');
  const [form, setForm] = useStateTL({ name:'', spec:'', unit: unitOptions[0] || '', status:'Active' });
  const set = (k,v) => setForm({ ...form, [k]:v });

  const cat = categories.find(c => c.short === catShort);
  const nextSeq = (cat?.items.length || 0) + 1;
  const nextCode = catShort
    ? `${prefix}-${catShort}-${String(nextSeq).padStart(5,'0')}`
    : `${prefix}-—-00001`;

  return (
    <SettingsModal eyebrow={`เพิ่ม${itemNoun}ใหม่`} title={`${itemNoun} (Level 2)`} onClose={onClose}>
      <div style={{
        padding:'14px 16px', background:'var(--surface-2)',
        border:'1px solid var(--rule)', borderRadius:6, marginBottom:20,
        display:'flex', alignItems:'center', gap:16,
      }}>
        <div style={{ flex:1 }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>รหัส{itemNoun} (auto-generate)</div>
          <div className="font-mono" style={{ fontSize:18, color:'var(--teal)' }}>{nextCode}</div>
        </div>
        <div style={{ fontSize:11, color:'var(--ink-3)', textAlign:'right', maxWidth:200 }}>
          <strong>{prefix}-[Short Code]-NNNNN</strong>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <SettingsField label="หมวด" required>
          <select value={catShort} onChange={e=>setCatShort(e.target.value)} style={settingsInputStyle}>
            {categories.map(c => <option key={c.short} value={c.short}>{c.short} · {c.name}</option>)}
          </select>
        </SettingsField>
        <SettingsField label="หน่วย" required>
          <select value={form.unit} onChange={e=>set('unit', e.target.value)} style={settingsInputStyle}>
            {unitOptions.map(u => <option key={u}>{u}</option>)}
          </select>
        </SettingsField>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label={`ชื่อ${itemNoun}`} required>
            <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เช่น เหล็กเส้น DB12" style={settingsInputStyle} />
          </SettingsField>
        </div>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="Spec / รายละเอียด">
            <input value={form.spec} onChange={e=>set('spec', e.target.value)} placeholder="เช่น มอก. 24-2559 · ข้ออ้อย ⌀12mm × 10m" style={settingsInputStyle} />
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

window.TwoLevelMasterPage = TwoLevelMasterPage;
