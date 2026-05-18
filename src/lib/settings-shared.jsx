'use client';
import React, { useState } from 'react';
import { Icons, Chip } from './shell';

export const settingsInputStyle = {
  padding: '9px 12px',
  fontSize: 13,
  border: '1px solid var(--rule-2)',
  borderRadius: 6,
  background: 'var(--paper)',
  color: 'var(--ink)',
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
};

export function SettingsField({ label, required, hint, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500 }}>
        {label} {required && <span style={{ color: 'var(--clay)' }}>*</span>}
      </span>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{hint}</span>}
    </label>
  );
}

export function SettingsModal({ title, eyebrow, onClose, onSave, children, width = 600 }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(20,18,14,0.32)',
        display: 'grid', placeItems: 'center',
        zIndex: 50,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        className="card"
        style={{ width, padding: 0, boxShadow: 'var(--sh-pop)', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--rule)' }}>
          {eyebrow && <div className="eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
          <h3 className="h-section">{title}</h3>
        </div>
        <div style={{ padding: 24, overflowY: 'auto' }}>{children}</div>
        <div style={{
          padding: '14px 24px', borderTop: '1px solid var(--rule)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          background: 'var(--surface-2)',
        }}>
          <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={onSave || onClose}>{Icons.check} บันทึก</button>
        </div>
      </div>
    </div>
  );
}

export function SettingsStatStrip({ stats }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 0,
      borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)',
      padding: '24px 0', marginBottom: 32,
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{ paddingLeft: i === 0 ? 0 : 28, borderLeft: i === 0 ? 'none' : '1px solid var(--rule)' }}>
          <div className="stat">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SettingsSearchBox({ value, onChange, placeholder = 'ค้นหา…' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
      border: '1px solid var(--rule-2)', borderRadius: 6,
      background: 'var(--surface)', width: 240,
    }}>
      {Icons.search}
      <input
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ flex: 1, border: 0, outline: 0, background: 'transparent', fontSize: 13 }}
      />
    </div>
  );
}

export function StatusPill({ status }) {
  const map = {
    'Active':     { bg: 'var(--moss-soft)', fg: '#2F4A1A', dot: 'var(--moss)' },
    'Non-Active': { bg: 'var(--paper-2)',   fg: 'var(--ink-3)', dot: 'var(--ink-4)' },
    'Closed':     { bg: 'var(--paper-2)',   fg: 'var(--ink-3)', dot: 'var(--ink-4)' },
    'Blacklist':  { bg: 'var(--clay-soft)', fg: '#6B2D1A',     dot: 'var(--clay)' },
    'Planning':   { bg: 'var(--chip-recv-bg)', fg: 'var(--chip-recv-fg)', dot: 'var(--ochre)' },
  };
  const c = map[status] || map['Non-Active'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11, fontWeight: 500, padding: '2px 10px',
      borderRadius: 999, background: c.bg, color: c.fg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c.dot }} />
      {status}
    </span>
  );
}

export function StatusToggle({ options, value, onChange }) {
  return (
    <div style={{ display:'flex', gap:0, border:'1px solid var(--rule-2)', borderRadius:6, overflow:'hidden', width:'fit-content' }}>
      {options.map((opt, i) => (
        <button key={opt} type="button" onClick={() => onChange(opt)} style={{
          padding:'8px 16px', fontSize:13,
          background: value === opt ? 'var(--ink)' : 'var(--surface)',
          color: value === opt ? 'var(--paper)' : 'var(--ink-2)',
          border:'none', cursor:'pointer', fontFamily:'inherit',
          borderRight: i < options.length - 1 ? '1px solid var(--rule-2)' : 'none',
        }}>{opt}</button>
      ))}
    </div>
  );
}

export function MultiSelectChips({ options, value, onChange, placeholder = 'เลือกหมวด…' }) {
  const has = (opt) => value.includes(opt);
  const toggle = (opt) => onChange(has(opt) ? value.filter(v => v !== opt) : [...value, opt]);

  return (
    <div style={{
      border:'1px solid var(--rule-2)', borderRadius:6, background:'var(--paper)',
      padding: value.length > 0 ? '8px 10px 6px' : '0',
      minHeight: 38, display:'flex', flexDirection:'column', gap:8,
    }}>
      {value.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {value.map(v => (
            <span key={v} style={{
              display:'inline-flex', alignItems:'center', gap:6,
              padding:'3px 6px 3px 10px', borderRadius:4,
              background:'var(--teal-soft)', color:'var(--teal-ink)',
              fontSize:12, fontWeight:500,
            }}>
              {v}
              <button type="button" onClick={() => toggle(v)} style={{
                background:'transparent', border:0, padding:'0 2px', cursor:'pointer',
                color:'var(--teal-ink)', fontSize:14, lineHeight:1, fontFamily:'inherit',
              }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{
        display:'flex', flexWrap:'wrap', gap:4,
        padding: value.length > 0 ? '4px 0 2px' : '8px 10px',
        borderTop: value.length > 0 ? '1px dashed var(--rule)' : 'none',
      }}>
        {value.length === 0 && (
          <span style={{ fontSize:12, color:'var(--ink-4)', marginRight:6, alignSelf:'center' }}>{placeholder}</span>
        )}
        {options.map(opt => has(opt) ? null : (
          <button key={opt} type="button" onClick={() => toggle(opt)} style={{
            padding:'3px 9px', fontSize:11.5, fontFamily:'inherit',
            border:'1px solid var(--rule)', borderRadius:4,
            background:'transparent', color:'var(--ink-2)', cursor:'pointer',
          }}>+ {opt}</button>
        ))}
      </div>
    </div>
  );
}

export function BulkExcelButton({ label = 'Bulk Excel', entity, columns, sampleRows = [] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        {Icons.upload} {label}
      </button>
      {open && <BulkExcelModal entity={entity} columns={columns} sampleRows={sampleRows} onClose={() => setOpen(false)} />}
    </>
  );
}

export function BulkExcelModal({ entity, columns, sampleRows, onClose }) {
  const [step, setStep] = useState(1);
  const [filename, setFilename] = useState('');

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(20,18,14,0.32)',
      display:'grid', placeItems:'center', zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} className="card"
           style={{ width: 720, padding:0, boxShadow:'var(--sh-pop)', maxHeight:'88vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)' }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>เพิ่ม{entity}จำนวนมาก</div>
          <h3 className="h-section">Bulk Excel — Import {entity}</h3>
        </div>

        <div style={{ display:'flex', borderBottom:'1px solid var(--rule)', background:'var(--surface-2)' }}>
          {[
            { n:1, label:'ดาวน์โหลด Template' },
            { n:2, label:'กรอกข้อมูลและอัพโหลด' },
            { n:3, label:'ตรวจสอบและยืนยัน' },
          ].map((s, i, arr) => {
            const isCur = step === s.n;
            const isDone = step > s.n;
            return (
              <div key={s.n} style={{
                flex:1, padding:'14px 20px',
                borderRight: i < arr.length - 1 ? '1px solid var(--rule)' : 'none',
                display:'flex', alignItems:'center', gap:10,
                color: isCur ? 'var(--ink)' : isDone ? 'var(--ink-3)' : 'var(--ink-4)',
                fontWeight: isCur ? 500 : 400, fontSize:12.5,
              }}>
                <span style={{
                  width:22, height:22, borderRadius:999,
                  background: isCur ? 'var(--teal)' : isDone ? 'var(--teal-soft)' : 'var(--rule)',
                  color: isCur ? 'var(--paper)' : 'var(--teal-ink)',
                  display:'inline-grid', placeItems:'center', fontSize:11, fontWeight:600, flexShrink:0,
                }}>{isDone ? '✓' : s.n}</span>
                {s.label}
              </div>
            );
          })}
        </div>

        <div style={{ padding:24, overflowY:'auto' }}>
          {step === 1 && (
            <div>
              <p style={{ fontSize:13.5, color:'var(--ink-2)', margin:'0 0 16px', lineHeight:1.6 }}>
                ดาวน์โหลดไฟล์ Template Excel ที่มีคอลัมน์มาตรฐาน — เปิดด้วย Excel / Google Sheets แล้วกรอกข้อมูลทีละแถว · 1 แถว = 1 รายการ
              </p>
              <div className="eyebrow" style={{ marginBottom:8 }}>คอลัมน์ใน Template</div>
              <div style={{ border:'1px solid #D6CFBC', borderRadius:6, overflow:'hidden', background:'#FCFAF5', marginBottom:16 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11.5, fontFamily:'var(--font-mono)' }}>
                  <thead>
                    <tr style={{ background:'#E8E3D6' }}>
                      <th style={{ width:32, padding:'6px 8px', fontSize:10, color:'var(--ink-2)', textAlign:'center', borderRight:'1px solid #D6CFBC' }}></th>
                      {columns.map((c, i) => (
                        <th key={i} style={{ padding:'6px 10px', fontSize:10, color:'var(--ink-2)', textAlign:'left', borderRight: i < columns.length - 1 ? '1px solid #D6CFBC' : 'none', fontWeight:500 }}>
                          {String.fromCharCode(65 + i)} · {c.name}
                          {c.required && <span style={{ color:'var(--clay)', marginLeft:4 }}>*</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleRows.slice(0,3).map((row, ri) => (
                      <tr key={ri} style={{ borderTop:'1px solid #E5DFD0', background: ri % 2 ? '#FAF7F0' : '#FCFAF5' }}>
                        <td style={{ padding:'6px 8px', color:'var(--ink-4)', borderRight:'1px solid #E5DFD0', textAlign:'center', fontSize:10 }}>{ri+2}</td>
                        {columns.map((c, ci) => (
                          <td key={ci} style={{ padding:'6px 10px', color:'var(--ink-2)', borderRight: ci < columns.length - 1 ? '1px solid #E5DFD0' : 'none', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:160 }}>
                            {row[c.key] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {[...Array(2)].map((_,i) => (
                      <tr key={'e'+i} style={{ borderTop:'1px solid #E5DFD0', height:24 }}>
                        <td style={{ padding:'4px 8px', color:'var(--ink-4)', borderRight:'1px solid #E5DFD0', textAlign:'center', fontSize:10 }}>{sampleRows.length+i+2}</td>
                        {columns.map((c, ci) => <td key={ci} style={{ borderRight: ci < columns.length - 1 ? '1px solid #E5DFD0' : 'none' }}></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display:'flex', gap:12, alignItems:'center', padding:'14px 16px', background:'var(--surface-2)', border:'1px solid var(--rule)', borderRadius:6 }}>
                <div style={{
                  width:36, height:44, background:'#1F6F47', color:'#fff',
                  borderRadius:3, display:'grid', placeItems:'center',
                  fontSize:9, fontWeight:600, letterSpacing:0.5, flexShrink:0,
                }}>XLSX</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>Template_{entity}.xlsx</div>
                  <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>
                    {columns.length} คอลัมน์ · มีตัวอย่างและ data validation
                  </div>
                </div>
                <button className="btn primary" onClick={() => setStep(2)}>{Icons.download} ดาวน์โหลด</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p style={{ fontSize:13.5, color:'var(--ink-2)', margin:'0 0 16px', lineHeight:1.6 }}>
                เปิดไฟล์ที่ดาวน์โหลด กรอกข้อมูล จากนั้นลากไฟล์มาวางที่นี่ หรือกดเลือกไฟล์
              </p>
              <label style={{
                display:'block', padding:'40px 24px',
                border:'2px dashed var(--rule-2)', borderRadius:8,
                background:'var(--surface-2)', textAlign:'center', cursor:'pointer',
                marginBottom:16,
              }}>
                <div style={{ fontSize:32, color:'var(--ink-4)', marginBottom:8 }}>↑</div>
                <div style={{ fontSize:13, fontWeight:500, color:'var(--ink-2)', marginBottom:4 }}>
                  ลากไฟล์ Excel มาที่นี่ หรือ <span style={{ color:'var(--teal)', textDecoration:'underline' }}>เลือกไฟล์</span>
                </div>
                <div style={{ fontSize:11, color:'var(--ink-3)' }}>รองรับ .xlsx · ไม่เกิน 10 MB</div>
                <input type="file" accept=".xlsx,.xls" style={{ display:'none' }}
                       onChange={e => { setFilename(e.target.files?.[0]?.name || 'data.xlsx'); setStep(3); }} />
              </label>
              <button className="btn ghost sm" onClick={() => { setFilename(`${entity}_sample.xlsx`); setStep(3); }}>
                ใช้ข้อมูลตัวอย่าง (สำหรับ Demo)
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{
                padding:'14px 16px', background:'var(--moss-soft)',
                border:'1px solid var(--moss)', borderRadius:6, marginBottom:20,
                display:'flex', gap:12, alignItems:'center',
              }}>
                <span style={{ color:'var(--moss)' }}>{Icons.check}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'#2F4A1A' }}>ตรวจสอบไฟล์เรียบร้อย — พบ {sampleRows.length} รายการ</div>
                  <div style={{ fontSize:11.5, color:'#2F4A1A', marginTop:2 }}>{filename} · ไม่พบข้อผิดพลาด · พร้อมนำเข้า</div>
                </div>
              </div>
              <div className="eyebrow" style={{ marginBottom:8 }}>ตัวอย่างข้อมูลที่จะนำเข้า</div>
              <div style={{ border:'1px solid var(--rule)', borderRadius:6, overflow:'hidden', marginBottom:8 }}>
                <table className="tbl" style={{ fontSize:12 }}>
                  <thead>
                    <tr>
                      <th style={{ width:32 }}>#</th>
                      {columns.slice(0,4).map((c,i) => <th key={i}>{c.name}</th>)}
                      <th style={{ width:80 }}>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampleRows.map((row, i) => (
                      <tr key={i}>
                        <td style={{ color:'var(--ink-3)' }}>{i+1}</td>
                        {columns.slice(0,4).map((c,ci) => (
                          <td key={ci} style={{ fontSize:11.5, color:'var(--ink-2)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {row[c.key] || '—'}
                          </td>
                        ))}
                        <td><Chip kind="active">{Icons.check} OK</Chip></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize:11, color:'var(--ink-3)' }}>
                * ระบบจะ Auto-Run รหัสให้ทุกรายการเมื่อกด "นำเข้าทั้งหมด"
              </div>
            </div>
          )}
        </div>

        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--surface-2)' }}>
          <div style={{ fontSize:12, color:'var(--ink-3)' }}>
            {step === 1 && 'ขั้นตอนที่ 1 จาก 3'}
            {step === 2 && 'ขั้นตอนที่ 2 จาก 3'}
            {step === 3 && `พร้อมนำเข้า ${sampleRows.length} รายการ`}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {step > 1 && <button className="btn ghost" onClick={() => setStep(step - 1)}>{Icons.back} ก่อนหน้า</button>}
            {step < 3
              ? <button className="btn" onClick={onClose}>ยกเลิก</button>
              : (
                <>
                  <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
                  <button className="btn primary" onClick={onClose}>{Icons.check} นำเข้าทั้งหมด</button>
                </>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
