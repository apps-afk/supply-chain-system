'use client';
import React, { useState, useEffect } from 'react';
import { Icons } from '../lib/shell';
import { settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle, unitMatches } from '../lib/settings-shared';

const TYPE_OPTIONS = ['count', 'length', 'area', 'volume', 'weight', 'time', 'other'];
const TYPE_LABEL = {
  count:  'นับชิ้น',
  length: 'ความยาว',
  area:   'พื้นที่',
  volume: 'ปริมาตร',
  weight: 'น้ำหนัก',
  time:   'เวลา',
  other:  'อื่นๆ',
};

// SI + commonly-used Thai units. Seeded by the "เพิ่มชุดมาตรฐาน" button.
// Insertion is idempotent — the API rejects duplicate `code` on the unique
// constraint, so re-clicking is safe.
const SI_UNITS = [
  // Length
  { code:'m',   name:'เมตร',       name_en:'meter',       type:'length', aliases:'m.,เมตร' },
  { code:'cm',  name:'เซนติเมตร',  name_en:'centimeter',  type:'length', aliases:'ซม.,c.m.' },
  { code:'mm',  name:'มิลลิเมตร',  name_en:'millimeter',  type:'length', aliases:'มม.,m.m.' },
  { code:'km',  name:'กิโลเมตร',   name_en:'kilometer',   type:'length', aliases:'กม.,k.m.' },
  { code:'μm',  name:'ไมโครเมตร',  name_en:'micrometer',  type:'length', aliases:'um,micron' },
  { code:'nm',  name:'นาโนเมตร',   name_en:'nanometer',   type:'length', aliases:'' },
  { code:'in',  name:'นิ้ว',        name_en:'inch',         type:'length', aliases:'นิ้ว,"' },
  { code:'ft',  name:'ฟุต',         name_en:'foot',         type:'length', aliases:'ฟุต,\'' },
  { code:'yd',  name:'หลา',         name_en:'yard',         type:'length', aliases:'หลา' },
  // Area
  { code:'m²',   name:'ตารางเมตร',     name_en:'square meter',     type:'area', aliases:'sq.m,m2,m^2,ตร.ม.,ตารางเมตร,เมตร2' },
  { code:'cm²',  name:'ตารางเซนติเมตร', name_en:'square centimeter', type:'area', aliases:'sq.cm,cm2,ตร.ซม.' },
  { code:'km²',  name:'ตารางกิโลเมตร',  name_en:'square kilometer',  type:'area', aliases:'sq.km,km2,ตร.กม.' },
  { code:'ft²',  name:'ตารางฟุต',       name_en:'square foot',        type:'area', aliases:'sq.ft,ft2,ตร.ฟ.' },
  { code:'in²',  name:'ตารางนิ้ว',       name_en:'square inch',        type:'area', aliases:'sq.in,in2,ตร.น.' },
  { code:'ha',   name:'เฮกตาร์',         name_en:'hectare',            type:'area', aliases:'hectare' },
  { code:'ไร่',   name:'ไร่',             name_en:'rai',                type:'area', aliases:'rai' },
  { code:'งาน',  name:'งาน',             name_en:'ngan',               type:'area', aliases:'ngan' },
  { code:'ตร.ว.', name:'ตารางวา',         name_en:'square wah',         type:'area', aliases:'sq.wa,wah' },
  // Volume
  { code:'m³',   name:'ลูกบาศก์เมตร',     name_en:'cubic meter',       type:'volume', aliases:'cu.m,m3,m^3,ลบ.ม.,ลูกบาศก์เมตร,คิว,คิวบ์' },
  { code:'cm³',  name:'ลูกบาศก์เซนติเมตร', name_en:'cubic centimeter',  type:'volume', aliases:'cc,cm3,cm^3,ลบ.ซม.' },
  { code:'L',    name:'ลิตร',             name_en:'liter',             type:'volume', aliases:'l,ลิตร,ล.' },
  { code:'mL',   name:'มิลลิลิตร',        name_en:'milliliter',        type:'volume', aliases:'ml,มล.' },
  { code:'gal',  name:'แกลลอน',          name_en:'gallon',            type:'volume', aliases:'gallon,แกลลอน' },
  // Weight
  { code:'kg',   name:'กิโลกรัม',  name_en:'kilogram',  type:'weight', aliases:'กก.,kgs' },
  { code:'g',    name:'กรัม',      name_en:'gram',      type:'weight', aliases:'ก.,gram' },
  { code:'mg',   name:'มิลลิกรัม', name_en:'milligram', type:'weight', aliases:'มก.' },
  { code:'t',    name:'ตัน',       name_en:'tonne',     type:'weight', aliases:'ton,ตัน,Mg' },
  { code:'lb',   name:'ปอนด์',     name_en:'pound',     type:'weight', aliases:'pound,ปอนด์' },
  // Time
  { code:'s',    name:'วินาที',   name_en:'second',  type:'time', aliases:'sec,วินาที' },
  { code:'min',  name:'นาที',     name_en:'minute',  type:'time', aliases:'นาที' },
  { code:'h',    name:'ชั่วโมง',   name_en:'hour',    type:'time', aliases:'hr,hour,ชม.,ชั่วโมง' },
  { code:'วัน',  name:'วัน',       name_en:'day',     type:'time', aliases:'day,d' },
  { code:'สัปดาห์', name:'สัปดาห์', name_en:'week',    type:'time', aliases:'week,wk' },
  { code:'เดือน', name:'เดือน',    name_en:'month',   type:'time', aliases:'month,mo' },
  { code:'ปี',   name:'ปี',         name_en:'year',    type:'time', aliases:'year,yr' },
  // Count
  { code:'ชิ้น',  name:'ชิ้น',    name_en:'piece',   type:'count', aliases:'pcs,pc,piece,ea,each' },
  { code:'ใบ',   name:'ใบ',     name_en:'sheet',   type:'count', aliases:'sheet,leaf' },
  { code:'ตัว',  name:'ตัว',    name_en:'unit',    type:'count', aliases:'tua' },
  { code:'คู่',   name:'คู่',     name_en:'pair',    type:'count', aliases:'pair,pr' },
  { code:'เส้น', name:'เส้น',   name_en:'strand',  type:'count', aliases:'strand,line,rod' },
  { code:'แท่ง', name:'แท่ง',   name_en:'bar',     type:'count', aliases:'bar,stick' },
  { code:'ม้วน', name:'ม้วน',   name_en:'roll',    type:'count', aliases:'roll' },
  { code:'ถุง',  name:'ถุง',    name_en:'bag',     type:'count', aliases:'bag,sack' },
  { code:'กล่อง', name:'กล่อง', name_en:'box',     type:'count', aliases:'box,carton' },
  { code:'ซอง', name:'ซอง',    name_en:'envelope', type:'count', aliases:'envelope,packet,pack' },
  { code:'คน',  name:'คน',     name_en:'person',  type:'count', aliases:'person,manday' },
  { code:'งาน', name:'งาน (เหมา)', name_en:'job', type:'count', aliases:'job,lot,เหมา' },
  // Other
  { code:'%',     name:'เปอร์เซ็นต์', name_en:'percent',   type:'other', aliases:'percent,เปอร์เซ็นต์' },
  { code:'ครั้ง', name:'ครั้ง',        name_en:'time',      type:'other', aliases:'time,occurrence' },
];
const TYPE_BADGE = {
  count:  { bg:'var(--teal-soft)', fg:'var(--teal-ink)' },
  length: { bg:'#DEE7E3',          fg:'#1F4D40' },
  area:   { bg:'#E3EAD3',          fg:'#3D5224' },
  volume: { bg:'#F0E4C5',          fg:'#6B5121' },
  weight: { bg:'#EADBD3',          fg:'#6B3F2E' },
  time:   { bg:'var(--paper-2)',   fg:'var(--ink-2)' },
  other:  { bg:'var(--paper-2)',   fg:'var(--ink-3)' },
};

export function ScreenSettingsUnits() {
  const [units, setUnits]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [q, setQ]               = useState('');
  const [filter, setFilter]     = useState('ทั้งหมด');
  const [editing, setEditing]   = useState(null);   // null | 'new' | unit object
  const [seeding, setSeeding]   = useState(null);   // null | { done, total, errors }

  async function load() {
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/units');
      const data = await res.json();
      if (!res.ok) setErr(data.error || 'โหลดข้อมูลไม่สำเร็จ');
      else setUnits(data.items || []);
    } catch {
      setErr('เครือข่ายขัดข้อง');
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Bulk-seed the SI/Thai unit catalog. Loops POST so existing entries (by
  // unique `code`) get silently skipped via the 400 response. We collect
  // errors but don't surface them per-row — a final summary is enough.
  async function seedSI() {
    if (!confirm(`เพิ่มชุดหน่วยมาตรฐาน ${SI_UNITS.length} หน่วย?\nหน่วยที่มีรหัสซ้ำจะถูกข้าม (ไม่ทับของเดิม)`)) return;
    const existingCodes = new Set(units.map(u => u.code));
    const toAdd = SI_UNITS.filter(u => !existingCodes.has(u.code));
    if (toAdd.length === 0) {
      alert('มีครบทุกหน่วยแล้ว — ไม่มีอะไรต้องเพิ่ม');
      return;
    }
    setSeeding({ done: 0, total: toAdd.length, errors: [] });
    const errors = [];
    let done = 0;
    for (const u of toAdd) {
      try {
        const res = await fetch('/api/units', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...u, active: true }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          errors.push(`${u.code}: ${d.error || 'ผิดพลาด'}`);
        }
      } catch (e) {
        errors.push(`${u.code}: ${e.message}`);
      }
      done++;
      setSeeding({ done, total: toAdd.length, errors: [...errors] });
    }
    await load();
    alert(`เพิ่มสำเร็จ ${done - errors.length} / ${done}\n${errors.length ? 'ผิดพลาด:\n' + errors.slice(0,5).join('\n') : ''}`);
    setSeeding(null);
  }

  async function remove(u) {
    if (!confirm(`ลบหน่วย "${u.name}"?`)) return;
    try {
      const res = await fetch('/api/units', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'เกิดข้อผิดพลาด');
      }
    } catch { alert('เครือข่ายขัดข้อง'); }
    load();
  }

  const filtered = units.filter(u => {
    if (filter !== 'ทั้งหมด' && u.type !== filter) return false;
    // Match across code / Thai name / English name / aliases with
    // normalization (so "คิว", "ลบ.ม.", "m^3" all find ลูกบาศก์เมตร).
    if (q && !unitMatches(u, q)) return false;
    return true;
  });

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">ตั้งค่า · ข้อมูลหลัก</div>
          <h1 className="h-display">หน่วยนับ</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:600 }}>
            หน่วยนับสำหรับวัสดุและงานจ้าง เช่น ชิ้น เมตร ตารางเมตร กิโลกรัม ฯลฯ
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" onClick={seedSI} disabled={!!seeding}>
            {seeding ? `กำลังเพิ่ม… ${seeding.done}/${seeding.total}` : `${Icons.download} เพิ่มชุดมาตรฐาน (SI)`}
          </button>
          <button className="btn primary" onClick={() => setEditing('new')}>{Icons.plus} เพิ่มหน่วย</button>
        </div>
      </div>

      <SettingsStatStrip stats={[
        { label:'หน่วยทั้งหมด', value: units.length, sub:`${units.filter(u=>u.active).length} ใช้งานอยู่` },
        { label:'นับชิ้น',     value: units.filter(u=>u.type==='count').length, sub:'เช่น ชิ้น, ใบ' },
        { label:'มิติ',         value: units.filter(u=>['length','area','volume'].includes(u.type)).length, sub:'ยาว · พื้นที่ · ปริมาตร' },
        { label:'น้ำหนัก',     value: units.filter(u=>u.type==='weight').length, sub:'กก., ตัน' },
      ]} />

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {['ทั้งหมด', ...TYPE_OPTIONS].map(f => (
            <button key={f} onClick={() => setFilter(f)} className="btn sm" style={{
              background: filter === f ? 'var(--ink)' : 'transparent',
              color: filter === f ? 'var(--paper)' : 'var(--ink-2)',
              borderColor: filter === f ? 'var(--ink)' : 'var(--rule)',
              padding:'5px 12px',
            }}>{f === 'ทั้งหมด' ? f : TYPE_LABEL[f]}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหาหน่วย…" />
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
              <th style={{ width:'14%' }}>สัญลักษณ์</th>
              <th>ชื่อภาษาไทย</th>
              <th>ภาษาอังกฤษ</th>
              <th>Alias</th>
              <th style={{ width:120 }}>ประเภท</th>
              <th style={{ width:110 }}>สถานะ</th>
              <th style={{ width:80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล — คลิก "เพิ่มหน่วย" เพื่อสร้างรายการแรก
              </td></tr>
            ) : filtered.map(u => {
              const c = TYPE_BADGE[u.type] || TYPE_BADGE.other;
              return (
                <tr key={u.id}>
                  <td className="font-mono" style={{ fontSize:14, color:'var(--ink)', fontWeight:500 }}>{u.code}</td>
                  <td style={{ fontWeight:500 }}>{u.name}</td>
                  <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{u.name_en || '—'}</td>
                  <td style={{ fontSize:11.5, color:'var(--ink-3)', fontFamily:'var(--font-mono)', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.aliases || '—'}</td>
                  <td>
                    <span style={{
                      display:'inline-block', padding:'2px 10px', borderRadius:999,
                      fontSize:11, fontWeight:500, background:c.bg, color:c.fg,
                    }}>{TYPE_LABEL[u.type] || u.type}</span>
                  </td>
                  <td><StatusPill status={u.active ? 'Active' : 'Non-Active'} /></td>
                  <td style={{ textAlign:'right' }}>
                    <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }} onClick={() => setEditing(u)} title="แก้ไข">{Icons.edit}</button>
                    <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--clay)' }} onClick={() => remove(u)} title="ลบ">×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <UnitModal
          unit={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function UnitModal({ unit, onClose, onSaved }) {
  const isEdit = !!unit;
  const [form, setForm] = useState({
    code:    unit?.code    || '',
    name:    unit?.name    || '',
    name_en: unit?.name_en || '',
    aliases: unit?.aliases || '',
    type:    unit?.type    || 'count',
    notes:   unit?.notes   || '',
    active:  unit?.active !== false,
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
    const payload = isEdit ? { ...form, id: unit.id } : form;
    const res = await fetch('/api/units', {
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
    <SettingsModal eyebrow={isEdit ? 'แก้ไขหน่วย' : 'เพิ่มหน่วยใหม่'} title={isEdit ? unit.name : 'หน่วยใหม่'} onClose={onClose} width={680}>
      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:14 }}>{err}</div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'140px 1fr 1fr', gap:14 }}>
        <SettingsField label="สัญลักษณ์" required hint="เช่น m, kg, ชิ้น">
          <input value={form.code} onChange={e=>set('code', e.target.value)} placeholder="m" style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
        </SettingsField>
        <SettingsField label="ชื่อภาษาไทย" required>
          <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เช่น เมตร" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="ชื่อภาษาอังกฤษ">
          <input value={form.name_en} onChange={e=>set('name_en', e.target.value)} placeholder="meter" style={settingsInputStyle} />
        </SettingsField>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="Alias / ชื่อเรียกอื่น" hint="คั่นด้วยคอมม่า เช่น m.,เมตร,m">
            <input value={form.aliases} onChange={e=>set('aliases', e.target.value)} placeholder="m.,เมตร" style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
          </SettingsField>
        </div>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="ประเภท">
            <select value={form.type} onChange={e=>set('type', e.target.value)} style={settingsInputStyle}>
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </SettingsField>
        </div>
        <div style={{ gridColumn:'1 / -1' }}>
          <SettingsField label="หมายเหตุ">
            <input value={form.notes} onChange={e=>set('notes', e.target.value)} placeholder="(ไม่บังคับ)" style={settingsInputStyle} />
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
