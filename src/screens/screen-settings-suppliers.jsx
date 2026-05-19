'use client';
import React, { useState } from 'react';
import { Icons, Av } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle, MultiSelectChips, BulkExcelButton } from '../lib/settings-shared';
import { MATERIAL_CATEGORIES } from './screen-settings-materials';
import { SUBCONTRACT_CATEGORIES } from './screen-settings-subcontracts';

/*
  Settings → Supplier List
  - Multi-select Category (sourced from Material + SubContract category masters)
  - No rating (removed)
  - Status: Active / Blacklist
  - Summary card: supplier count only
  - Bulk Excel
  - Categories hidden in list — visible in expanded "ดูเพิ่มเติม" row
*/

const SUPPLIER_DATA = [];

const SAMPLE_SUPPLIER_ROWS = [
  { name:'บจก. ทรัพย์ก่อสร้าง',  tax:'0105560123456', address:'…กรุงเทพฯ', categories:'งานโครงสร้าง',          contactName:'คุณสมศักดิ์', contactPhone:'081-111-2222', contactEmail:'somsak@example.com', credit:'30 วัน' },
  { name:'หจก. วัสดุไทย',         tax:'0103559876543', address:'…นนทบุรี',  categories:'งานพื้น-ผนัง,งานสี',  contactName:'คุณวิภา',     contactPhone:'089-333-4444', contactEmail:'wipha@example.com',  credit:'45 วัน' },
  { name:'หจก. ช่างไฟทอง',        tax:'0103562444555', address:'…นครปฐม',   categories:'งานระบบไฟฟ้า',          contactName:'ช่างทอง',     contactPhone:'081-555-6666', contactEmail:'-',                  credit:'งวด'    },
];

const SUPPLIER_BULK_COLUMNS = [
  { key:'name',          name:'ชื่อบริษัท',     required:true },
  { key:'tax',           name:'Tax ID',         required:true },
  { key:'address',       name:'ที่อยู่',         required:true },
  { key:'categories',    name:'หมวด (คั่นด้วย ,)', required:true },
  { key:'contactName',   name:'ชื่อผู้ติดต่อ',    required:true },
  { key:'contactPhone',  name:'โทรศัพท์',        required:true },
  { key:'contactEmail',  name:'อีเมล',           required:false },
  { key:'credit',        name:'เครดิตเทอม',      required:false },
];

// Composite category list — pulled from Material + SubContract category masters
function getCategoryOptions() {
  const matCats = (MATERIAL_CATEGORIES || []).map(c => c.name);
  const subCats = (SUBCONTRACT_CATEGORIES || []).map(c => c.name);
  // Merge & dedupe, preserving order
  const seen = new Set();
  const merged = [];
  [...matCats, ...subCats].forEach(c => {
    if (!seen.has(c)) { seen.add(c); merged.push(c); }
  });
  return merged.length ? merged : ['งานโครงสร้าง','งานก่ออิฐ-ฉาบปูน','งานหลังคา','งานพื้น-ผนัง','งานสุขภัณฑ์','งานสี','งานระบบไฟฟ้า'];
}

export function ScreenSettingsSuppliers({ go }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('ทั้งหมด');
  const [addOpen, setAddOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const filtered = SUPPLIER_DATA.filter(s => {
    if (filter !== 'ทั้งหมด' && s.status !== filter) return false;
    if (q) {
      const v = q.toLowerCase();
      const hit = s.name.toLowerCase().includes(v) || s.code.toLowerCase().includes(v) || s.tax.includes(q) || s.contact.name.toLowerCase().includes(v);
      if (!hit) return false;
    }
    return true;
  });

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Settings · Master Data</div>
          <h1 className="h-display">Supplier List</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:640 }}>
            ทะเบียนคู่ค้าและผู้รับเหมา · Auto-Run รหัส <span className="font-mono" style={{ color:'var(--ink-2)' }}>SUP-NNNNN</span> ·
            หมวดดึงจาก Material และ SubContract
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <BulkExcelButton entity="Supplier" columns={SUPPLIER_BULK_COLUMNS} sampleRows={SAMPLE_SUPPLIER_ROWS} />
          <button className="btn">{Icons.download} Export</button>
          <button className="btn primary" onClick={() => setAddOpen(true)}>{Icons.plus} เพิ่ม Supplier</button>
        </div>
      </div>

      <SettingsStatStrip stats={[
        {
          label:'Supplier ทั้งหมด',
          value: SUPPLIER_DATA.length,
          sub: <span style={{ display:'inline-flex', gap:14, fontSize:12 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--moss)' }} />
              <span style={{ color:'var(--ink-3)' }}>Active</span>
              <strong style={{ color:'var(--ink)' }}>{SUPPLIER_DATA.filter(s=>s.status==='Active').length}</strong>
            </span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--clay)' }} />
              <span style={{ color:'var(--ink-3)' }}>Blacklist</span>
              <strong style={{ color:'var(--ink)' }}>{SUPPLIER_DATA.filter(s=>s.status==='Blacklist').length}</strong>
            </span>
          </span>,
        },
      ]} />

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', gap:4 }}>
          {['ทั้งหมด','Active','Blacklist'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className="btn sm" style={{
              background: filter === f ? 'var(--ink)' : 'transparent',
              color: filter === f ? 'var(--paper)' : 'var(--ink-2)',
              borderColor: filter === f ? 'var(--ink)' : 'var(--rule)',
              padding:'5px 12px',
            }}>{f}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหา ชื่อ / รหัส / Tax ID…" />
          <span style={{ fontSize:12, color:'var(--ink-3)' }}>
            แสดง <strong style={{ color:'var(--ink)' }}>{filtered.length}</strong> รายการ
          </span>
        </div>
      </div>

      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:'10%' }}>รหัส</th>
              <th style={{ width:'28%' }}>ชื่อบริษัท</th>
              <th>Tax ID</th>
              <th>ผู้ติดต่อหลัก</th>
              <th>เครดิต</th>
              <th>สถานะ</th>
              <th style={{ width:120, textAlign:'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล — คลิก "เพิ่ม Supplier" เพื่อสร้างรายการแรก
              </td></tr>
            )}
            {filtered.map(s => (
              <React.Fragment key={s.code}>
                <tr>
                  <td className="font-mono" style={{ fontSize:11.5, color:'var(--ink-2)', fontWeight:500 }}>{s.code}</td>
                  <td>
                    <div style={{ display:'inline-flex', gap:10, alignItems:'center' }}>
                      <Av initials={s.name.slice(0,2)} kind={s.kind} />
                      <span style={{ fontWeight:500 }}>{s.name}</span>
                    </div>
                  </td>
                  <td className="font-mono" style={{ fontSize:11.5, color:'var(--ink-3)' }}>{s.tax}</td>
                  <td>
                    <div style={{ fontSize:12.5 }}>{s.contact.name}</div>
                    <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>{s.contact.phone}</div>
                  </td>
                  <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{s.credit}</td>
                  <td><StatusPill status={s.status} /></td>
                  <td style={{ textAlign:'right' }}>
                    <button
                      className="btn ghost sm"
                      onClick={() => setExpanded(expanded === s.code ? null : s.code)}
                      style={{ padding:'4px 10px', color:'var(--ink-2)', fontSize:11.5 }}
                    >
                      {expanded === s.code ? 'ซ่อน' : 'ดูเพิ่มเติม'}
                      <span style={{ display:'inline-block', marginLeft:4, transform: expanded === s.code ? 'rotate(180deg)':'rotate(0)', transition:'transform 0.15s' }}>
                        {Icons.chevronD}
                      </span>
                    </button>
                  </td>
                </tr>
                {expanded === s.code && (
                  <tr>
                    <td colSpan={7} style={{ background:'var(--surface-2)', padding:'20px 24px' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1.2fr', gap:32 }}>
                        <div>
                          <div className="eyebrow" style={{ marginBottom:8 }}>ที่อยู่</div>
                          <div style={{ fontSize:12.5, color:'var(--ink-2)', lineHeight:1.6 }}>{s.address}</div>
                        </div>
                        <div>
                          <div className="eyebrow" style={{ marginBottom:8 }}>ผู้ติดต่อหลัก</div>
                          <div style={{ fontSize:12.5, lineHeight:1.7 }}>
                            <div style={{ fontWeight:500 }}>{s.contact.name}</div>
                            <div style={{ color:'var(--ink-3)' }}>{s.contact.role}</div>
                            <div style={{ color:'var(--ink-2)', marginTop:4 }}>{s.contact.phone}</div>
                            <div style={{ color:'var(--ink-2)' }}>{s.contact.email}</div>
                          </div>
                        </div>
                        <div>
                          <div className="eyebrow" style={{ marginBottom:8 }}>หมวด</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                            {s.categories.map(c => (
                              <span key={c} style={{
                                padding:'3px 10px', borderRadius:4,
                                background:'var(--teal-soft)', color:'var(--teal-ink)',
                                fontSize:11.5, fontWeight:500,
                              }}>{c}</span>
                            ))}
                          </div>
                          <div className="eyebrow" style={{ margin:'14px 0 6px' }}>เพิ่มในระบบ</div>
                          <div style={{ fontSize:12, color:'var(--ink-2)' }}>{s.joined} · {s.rfqs} RFQ</div>
                          <div style={{ marginTop:12, display:'flex', gap:6 }}>
                            <button className="btn sm">{Icons.edit} แก้ไข</button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {addOpen && <AddSupplierModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddSupplierModal({ onClose }) {
  const catOptions = getCategoryOptions();
  const [form, setForm] = useState({
    name:'', tax:'', addressLine:'', district:'', province:'', zip:'',
    contactName:'', contactRole:'', contactPhone:'', contactEmail:'',
    categories:[], credit:'30 วัน', status:'Active',
  });
  const set = (k,v) => setForm({ ...form, [k]:v });
  const nextCode = `SUP-${String(SUPPLIER_DATA.length + 1).padStart(5,'0')}`;

  return (
    <SettingsModal eyebrow="เพิ่ม Supplier ใหม่" title="ข้อมูล Supplier" onClose={onClose} width={720}>
      <div style={{
        padding:'14px 16px', background:'var(--surface-2)',
        border:'1px solid var(--rule)', borderRadius:6, marginBottom:24,
        display:'flex', alignItems:'center', gap:16,
      }}>
        <div style={{ flex:1 }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>รหัส Supplier (auto-generate)</div>
          <div className="font-mono" style={{ fontSize:18, color:'var(--teal)' }}>{nextCode}</div>
        </div>
        <div style={{ fontSize:11, color:'var(--ink-3)', textAlign:'right' }}>
          รูปแบบ <strong>SUP-NNNNN</strong>
        </div>
      </div>

      <div className="eyebrow" style={{ marginBottom:12 }}>ข้อมูลบริษัท</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:24 }}>
        <SettingsField label="ชื่อบริษัท" required>
          <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="เช่น บจก. ทรัพย์ก่อสร้าง" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="Tax ID" required hint="13 หลัก">
          <input value={form.tax} onChange={e=>set('tax',e.target.value.replace(/\D/g,'').slice(0,13))} placeholder="0105556012345" style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
        </SettingsField>
      </div>

      <div className="eyebrow" style={{ marginBottom:12 }}>ที่อยู่</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:14, marginBottom:14 }}>
        <SettingsField label="ที่อยู่" required>
          <input value={form.addressLine} onChange={e=>set('addressLine',e.target.value)} placeholder="เลขที่ / หมู่ / ถนน / ตำบล / อำเภอ" style={settingsInputStyle} />
        </SettingsField>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 120px', gap:14, marginBottom:24 }}>
        <SettingsField label="เขต/อำเภอ">
          <input value={form.district} onChange={e=>set('district',e.target.value)} style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="จังหวัด">
          <input value={form.province} onChange={e=>set('province',e.target.value)} style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="รหัสไปรษณีย์">
          <input value={form.zip} onChange={e=>set('zip',e.target.value.replace(/\D/g,'').slice(0,5))} style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
        </SettingsField>
      </div>

      <div className="eyebrow" style={{ marginBottom:12 }}>ผู้ติดต่อหลัก (Primary Contact)</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:24 }}>
        <SettingsField label="ชื่อ-นามสกุล" required>
          <input value={form.contactName} onChange={e=>set('contactName',e.target.value)} placeholder="คุณ…" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="ตำแหน่ง">
          <input value={form.contactRole} onChange={e=>set('contactRole',e.target.value)} placeholder="เช่น Sales Manager" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="โทรศัพท์" required>
          <input value={form.contactPhone} onChange={e=>set('contactPhone',e.target.value)} placeholder="08X-XXX-XXXX" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="อีเมล">
          <input type="email" value={form.contactEmail} onChange={e=>set('contactEmail',e.target.value)} placeholder="contact@company.com" style={settingsInputStyle} />
        </SettingsField>
      </div>

      <div className="eyebrow" style={{ marginBottom:12 }}>ข้อมูลการค้า</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:14, marginBottom:14 }}>
        <SettingsField label="หมวด (เลือกได้หลายหมวด)" required hint={`ดึงจาก Material และ SubContract · ${catOptions.length} หมวด`}>
          <MultiSelectChips
            options={catOptions}
            value={form.categories}
            onChange={v => set('categories', v)}
            placeholder="คลิกหมวดด้านล่างเพื่อเพิ่ม…"
          />
        </SettingsField>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <SettingsField label="เครดิตเทอม">
          <select value={form.credit} onChange={e=>set('credit',e.target.value)} style={settingsInputStyle}>
            <option>เงินสด</option><option>15 วัน</option><option>30 วัน</option><option>45 วัน</option><option>60 วัน</option><option>งวด</option>
          </select>
        </SettingsField>
        <SettingsField label="สถานะ">
          <StatusToggle options={['Active','Blacklist']} value={form.status} onChange={v => set('status', v)} />
        </SettingsField>
      </div>
    </SettingsModal>
  );
}
