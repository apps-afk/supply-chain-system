'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Icons, Av } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle } from '../lib/settings-shared';

/*
  Settings → Supplier List
  Data is now stored in DB and fetched from /api/suppliers.
  Whitelisted fields:
    code, name, type, contact_name, email, phone,
    address, tax_id, payment_terms, rating, notes, active
*/

export function ScreenSettingsSuppliers({ go }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [q, setQ]             = useState('');
  const [filter, setFilter]   = useState('ทั้งหมด');
  const [editing, setEditing] = useState(null); // null | 'new' | object
  const [expanded, setExpanded] = useState(null);

  async function load() {
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/suppliers');
      const data = await res.json();
      if (!res.ok) setErr(data.error || 'โหลดข้อมูลไม่สำเร็จ');
      else setItems(data.items || []);
    } catch {
      setErr('เครือข่ายขัดข้อง');
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function remove(s) {
    if (!confirm(`ลบ Supplier "${s.name}"?`)) return;
    try {
      const res = await fetch('/api/suppliers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      alert('เครือข่ายขัดข้อง');
    }
    load();
  }

  // Derive a 3-state status from either the new `status` column or the
  // legacy `active` boolean (for rows that pre-date the migration).
  const statusOf = (s) => s.status || (s.active === false ? 'Non-Active' : 'Active');

  const filtered = useMemo(() => {
    const v = q.toLowerCase();
    return items.filter(s => {
      if (filter !== 'ทั้งหมด' && statusOf(s) !== filter) return false;
      if (q) {
        const hit =
          s.name?.toLowerCase().includes(v) ||
          s.code?.toLowerCase().includes(v) ||
          s.tax_id?.includes(q) ||
          s.contact_name?.toLowerCase().includes(v);
        if (!hit) return false;
      }
      return true;
    });
  }, [items, filter, q]);

  const { activeCount, inactiveCount, blacklistCount } = useMemo(() => {
    let active = 0, inactive = 0, blacklist = 0;
    for (const s of items) {
      const st = statusOf(s);
      if (st === 'Active') active++;
      else if (st === 'Blacklist') blacklist++;
      else inactive++;
    }
    return { activeCount: active, inactiveCount: inactive, blacklistCount: blacklist };
  }, [items]);

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Settings · Master Data</div>
          <h1 className="h-display">Supplier List</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:640 }}>
            ทะเบียนคู่ค้าและผู้รับเหมา
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn primary" onClick={() => setEditing('new')}>{Icons.plus} เพิ่ม Supplier</button>
        </div>
      </div>

      <SettingsStatStrip stats={[
        {
          label:'Supplier ทั้งหมด',
          value: items.length,
          sub: <span style={{ display:'inline-flex', gap:14, fontSize:12, flexWrap:'wrap' }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--moss)' }} />
              <span style={{ color:'var(--ink-3)' }}>Active</span>
              <strong style={{ color:'var(--ink)' }}>{activeCount}</strong>
            </span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--ink-4)' }} />
              <span style={{ color:'var(--ink-3)' }}>Non-Active</span>
              <strong style={{ color:'var(--ink)' }}>{inactiveCount}</strong>
            </span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--clay)' }} />
              <span style={{ color:'var(--ink-3)' }}>Blacklist</span>
              <strong style={{ color:'var(--ink)' }}>{blacklistCount}</strong>
            </span>
          </span>,
        },
      ]} />

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', gap:4 }}>
          {['ทั้งหมด','Active','Non-Active','Blacklist'].map(f => (
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

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>
      )}

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
              <th style={{ width:160, textAlign:'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล — คลิก "เพิ่ม Supplier" เพื่อสร้างรายการแรก
              </td></tr>
            ) : filtered.map(s => (
              <React.Fragment key={s.id}>
                <tr>
                  <td className="font-mono" style={{ fontSize:11.5, color:'var(--ink-2)', fontWeight:500 }}>{s.code}</td>
                  <td>
                    <div style={{ display:'inline-flex', gap:10, alignItems:'center' }}>
                      <Av initials={(s.name || '').slice(0,2)} kind={s.type} />
                      <span style={{ fontWeight:500 }}>{s.name}</span>
                    </div>
                  </td>
                  <td className="font-mono" style={{ fontSize:11.5, color:'var(--ink-3)' }}>{s.tax_id || '—'}</td>
                  <td>
                    <div style={{ fontSize:12.5 }}>{s.contact_name || '—'}</div>
                    <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>{s.phone || ''}</div>
                  </td>
                  <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{s.payment_terms || '—'}</td>
                  <td><StatusPill status={statusOf(s)} /></td>
                  <td style={{ textAlign:'right' }}>
                    <button
                      className="btn ghost sm"
                      onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                      style={{ padding:'4px 10px', color:'var(--ink-2)', fontSize:11.5 }}
                    >
                      {expanded === s.id ? 'ซ่อน' : 'ดูเพิ่มเติม'}
                      <span style={{ display:'inline-block', marginLeft:4, transform: expanded === s.id ? 'rotate(180deg)':'rotate(0)', transition:'transform 0.15s' }}>
                        {Icons.chevronD}
                      </span>
                    </button>
                    <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }} onClick={() => setEditing(s)} title="แก้ไข">{Icons.edit}</button>
                    <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--clay)' }} onClick={() => remove(s)} title="ลบ">×</button>
                  </td>
                </tr>
                {expanded === s.id && (
                  <tr>
                    <td colSpan={7} style={{ background:'var(--surface-2)', padding:'20px 24px' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1.2fr', gap:32 }}>
                        <div>
                          <div className="eyebrow" style={{ marginBottom:8 }}>ที่อยู่</div>
                          <div style={{ fontSize:12.5, color:'var(--ink-2)', lineHeight:1.6 }}>{s.address || '—'}</div>
                          <div className="eyebrow" style={{ margin:'14px 0 6px' }}>ประเภท</div>
                          <div style={{ fontSize:12, color:'var(--ink-2)' }}>{s.type ? s.type.split(',').map(t => t.trim()).filter(Boolean).join(' · ') : '—'}</div>
                        </div>
                        <div>
                          <div className="eyebrow" style={{ marginBottom:8 }}>ผู้ติดต่อหลัก</div>
                          <div style={{ fontSize:12.5, lineHeight:1.7 }}>
                            <div style={{ fontWeight:500 }}>{s.contact_name || '—'}</div>
                            <div style={{ color:'var(--ink-2)', marginTop:4 }}>{s.phone || ''}</div>
                            <div style={{ color:'var(--ink-2)' }}>{s.email || ''}</div>
                          </div>
                        </div>
                        <div>
                          <div className="eyebrow" style={{ marginBottom:8 }}>หมายเหตุ</div>
                          <div style={{ fontSize:12, color:'var(--ink-2)' }}>{s.notes || '—'}</div>
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

      {editing && (
        <SupplierModal
          item={editing === 'new' ? null : editing}
          existingCodes={items.map(s => s.code).filter(Boolean)}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// Build the next SUP-NNNNN code by scanning existing codes for the
// highest numeric suffix and adding 1. Falls back to 1 if no SUP-* codes
// exist yet. Race window: two simultaneous "new" modals would compute
// the same code — the second save hits the unique constraint and the
// user sees a clear error to retry.
function nextSupplierCode(existing) {
  let max = 0;
  for (const c of existing || []) {
    const m = /^SUP-(\d+)$/.exec(String(c).trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `SUP-${String(max + 1).padStart(5, '0')}`;
}

// Parse a payment_terms string back to {has, days} for the toggle UI.
// We store as either '' (no credit) or 'NN วัน'. Old data with values
// like 'เงินสด' / 'งวด' falls through to has=false.
function parsePaymentTerms(str) {
  if (!str) return { has: false, days: '' };
  const m = /(\d+)\s*วัน/.exec(String(str));
  if (m) return { has: true, days: m[1] };
  return { has: false, days: '' };
}

// Parse the comma-separated `type` field into a {material, subcontract} pair.
function parseType(str) {
  const s = String(str || '').toLowerCase();
  return { material: s.includes('material'), subcontract: s.includes('subcontract') };
}

function SupplierModal({ item, existingCodes, onClose, onSaved }) {
  const isEdit = !!item;
  const initialTerms = parsePaymentTerms(item?.payment_terms);
  const initialType  = parseType(item?.type);
  const [form, setForm] = useState({
    // For new suppliers the code is auto-generated and read-only. Editing
    // existing suppliers keeps the original code.
    code:          item?.code || nextSupplierCode(existingCodes),
    name:          item?.name          || '',
    typeMaterial:    initialType.material,
    typeSubcontract: initialType.subcontract,
    contact_name:  item?.contact_name  || '',
    email:         item?.email         || '',
    phone:         item?.phone         || '',
    address:       item?.address       || '',
    tax_id:        item?.tax_id        || '',
    hasCredit:     initialTerms.has,
    creditDays:    initialTerms.days,
    notes:         item?.notes         || '',
    status:        item?.status || (item?.active === false ? 'Non-Active' : 'Active'),
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    setErr('');
    if (!form.name.trim()) {
      setErr('กรอกชื่อบริษัท'); return;
    }
    if (!form.typeMaterial && !form.typeSubcontract) {
      setErr('เลือกประเภทอย่างน้อย 1 อย่าง (Material / SubContract)'); return;
    }
    if (form.hasCredit) {
      const n = parseInt(form.creditDays, 10);
      if (!Number.isFinite(n) || n <= 0) {
        setErr('กรอกจำนวนวันเครดิตเทอม (ตัวเลขมากกว่า 0)'); return;
      }
    }
    setBusy(true);
    const typeParts = [];
    if (form.typeMaterial)    typeParts.push('Material');
    if (form.typeSubcontract) typeParts.push('SubContract');
    const payload = {
      code:          form.code,
      name:          form.name,
      type:          typeParts.join(','),
      contact_name:  form.contact_name,
      email:         form.email,
      phone:         form.phone,
      address:       form.address,
      tax_id:        form.tax_id,
      payment_terms: form.hasCredit ? `${parseInt(form.creditDays, 10)} วัน` : '',
      notes:         form.notes,
      status:        form.status,
      // Keep legacy boolean in sync — old screens / queries that look at
      // `active` should still see Blacklist as inactive.
      active:        form.status === 'Active',
    };
    if (isEdit) payload.id = item.id;
    const res = await fetch('/api/suppliers', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      // Likely cause of failure on POST: unique-constraint collision on
      // code from two simultaneous "new" modals. Tell the user to retry.
      const friendly = !isEdit && /duplicate|unique/i.test(data.error || '')
        ? 'รหัส Supplier ถูกใช้ไปแล้ว — กดยกเลิกแล้วเปิดใหม่เพื่อสร้างรหัสถัดไป'
        : (data.error || 'บันทึกไม่สำเร็จ');
      setErr(friendly); setBusy(false); return;
    }
    setBusy(false);
    onSaved();
  }

  return (
    <SettingsModal eyebrow={isEdit ? 'แก้ไข Supplier' : 'เพิ่ม Supplier ใหม่'} title={isEdit ? item.name : 'Supplier ใหม่'} onClose={onClose} width={720}>
      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
      )}

      <div className="eyebrow" style={{ marginBottom:12 }}>ข้อมูลบริษัท</div>
      <div style={{ display:'grid', gridTemplateColumns:'140px 1fr 1fr', gap:14, marginBottom:24 }}>
        <SettingsField label="รหัส" hint={isEdit ? 'แก้ไม่ได้' : 'ระบบสร้างให้อัตโนมัติ'}>
          <input value={form.code} readOnly disabled
                 style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)', background:'var(--paper-2)', color:'var(--ink-3)' }} />
        </SettingsField>
        <SettingsField label="ชื่อบริษัท" required>
          <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="เช่น บจก. ทรัพย์ก่อสร้าง" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="ประเภท" required hint="เลือกได้ทั้ง 2 อย่าง">
          <div style={{ display:'flex', gap:14, alignItems:'center', height:32 }}>
            <label style={{ display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
              <input type="checkbox" checked={form.typeMaterial}
                onChange={e=>set('typeMaterial', e.target.checked)}
                style={{ width:15, height:15, accentColor:'var(--teal)' }} />
              Material
            </label>
            <label style={{ display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
              <input type="checkbox" checked={form.typeSubcontract}
                onChange={e=>set('typeSubcontract', e.target.checked)}
                style={{ width:15, height:15, accentColor:'var(--teal)' }} />
              SubContract
            </label>
          </div>
        </SettingsField>
        <SettingsField label="Tax ID" hint="13 หลัก">
          <input value={form.tax_id} onChange={e=>set('tax_id',e.target.value.replace(/\D/g,'').slice(0,13))} placeholder="0105556012345" style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
        </SettingsField>
        <div style={{ gridColumn:'2 / -1' }}>
          <SettingsField label="ที่อยู่">
            <input value={form.address} onChange={e=>set('address',e.target.value)} placeholder="เลขที่ / หมู่ / ถนน / ตำบล / อำเภอ / จังหวัด" style={settingsInputStyle} />
          </SettingsField>
        </div>
      </div>

      <div className="eyebrow" style={{ marginBottom:12 }}>ผู้ติดต่อหลัก</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:24 }}>
        <SettingsField label="ชื่อ-นามสกุล">
          <input value={form.contact_name} onChange={e=>set('contact_name',e.target.value)} placeholder="คุณ…" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="โทรศัพท์">
          <input value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="08X-XXX-XXXX" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="อีเมล">
          <input type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="contact@company.com" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="เครดิตเทอม">
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <StatusToggle options={['ไม่มี','มี']}
              value={form.hasCredit ? 'มี' : 'ไม่มี'}
              onChange={v => set('hasCredit', v === 'มี')} />
            {form.hasCredit && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <input type="number" min={1} step={1} value={form.creditDays}
                  onChange={e=>set('creditDays', e.target.value.replace(/\D/g,''))}
                  placeholder="30"
                  style={{ ...settingsInputStyle, width:80, fontFamily:'var(--font-mono)' }} />
                <span style={{ fontSize:12, color:'var(--ink-3)' }}>วัน</span>
              </div>
            )}
          </div>
        </SettingsField>
      </div>

      <div className="eyebrow" style={{ marginBottom:12 }}>อื่นๆ</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <SettingsField label="สถานะ">
          <select value={form.status} onChange={e=>set('status', e.target.value)} style={settingsInputStyle}>
            <option value="Active">Active</option>
            <option value="Non-Active">Non-Active</option>
            <option value="Blacklist">Blacklist</option>
          </select>
        </SettingsField>
        <div />
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="หมายเหตุ">
            <textarea value={form.notes} onChange={e=>set('notes', e.target.value)}
                      placeholder="(ไม่บังคับ)"
                      style={{ ...settingsInputStyle, minHeight:60, resize:'vertical', fontFamily:'inherit' }} />
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
