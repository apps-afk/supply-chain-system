'use client';
import React, { useState } from 'react';
import { Icons, Chip, Av, money } from '../lib/shell';
import { SettingsSearchBox } from '../lib/settings-shared';
/*
  Contract module — upload-driven AI review workflow.

  Flow:
    1. Upload Contract  → status: Uploaded
    2. Confirm to run AI → user confirms cost/time of analysis
    3. AI Reviewing → status: Reviewing (synthetic 100% in demo, just a step)
    4. AI Report ready → status: Reviewed — show findings + risks
    5. Send to Legal team → status: With Legal
    6. Upload Final (signed) → status: Final — closed loop

  Routes:
    #contract        → list
    #contract-detail → detail of one contract following the flow
*/

/* =================== List =================== */

const CT_STATUS = {
  Uploaded:  { bg:'#F0E4C5',           fg:'#6B5121',         dot:'var(--ochre)',  label:'รอตรวจ AI' },
  Reviewing: { bg:'var(--teal-soft)',  fg:'var(--teal-ink)', dot:'var(--teal)',   label:'AI กำลังตรวจ' },
  Reviewed:  { bg:'#DEE7E3',           fg:'#1F4D40',         dot:'var(--teal)',   label:'AI ตรวจเสร็จ' },
  Legal:     { bg:'var(--chip-recv-bg)', fg:'var(--chip-recv-fg)', dot:'var(--ochre)', label:'รอกฎหมาย' },
  Final:     { bg:'var(--moss-soft)',  fg:'#2F4A1A',         dot:'var(--moss)',   label:'Final · ใช้งานได้' },
};

const CONTRACT_LIST = [];

export function ScreenContractList({ go }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('ทั้งหมด');
  const [uploadOpen, setUploadOpen] = useState(false);

  const filtered = CONTRACT_LIST.filter(c => {
    if (filter !== 'ทั้งหมด' && c.status !== filter) return false;
    if (q) {
      const v = q.toLowerCase();
      if (!(c.no.toLowerCase().includes(v) || c.title.includes(q) || c.supplier.includes(q) || c.project.includes(q))) return false;
    }
    return true;
  });

  const stats = ['Uploaded','Reviewing','Reviewed','Legal','Final'].map(s => ({
    s,
    count: CONTRACT_LIST.filter(c => c.status === s).length,
  }));

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Module 4 · สัญญา</div>
          <h1 className="h-display">สัญญา (Contracts)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:640 }}>
            อัพโหลดสัญญาที่ทำแล้วภายนอก ระบบจะให้ AI ตรวจสอบและออก Report
            · ทีมส่ง Report ให้กฎหมายตรวจ แล้ว Upload ไฟล์ Final กลับเข้าระบบ
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn primary" onClick={() => setUploadOpen(true)}>{Icons.upload} อัพโหลดสัญญา</button>
        </div>
      </div>

      {/* 5-status pipeline */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:12,
        marginBottom:32,
      }}>
        {stats.map((s,i) => {
          const sp = CT_STATUS[s.s];
          const isMine = filter === s.s;
          return (
            <button key={s.s} onClick={() => setFilter(filter === s.s ? 'ทั้งหมด' : s.s)}
              className="card" style={{
                padding:'16px 18px', textAlign:'left',
                border:'1px solid', cursor:'pointer',
                borderColor: isMine ? sp.dot : 'var(--rule)',
                background: isMine ? 'var(--surface)' : 'var(--surface)',
                boxShadow: isMine ? `inset 0 0 0 1px ${sp.dot}` : 'none',
                fontFamily:'inherit',
              }}>
              <div className="eyebrow" style={{
                display:'inline-flex', alignItems:'center', gap:6,
                fontSize:10, color: sp.fg, marginBottom:6,
              }}>
                <span style={{ width:6, height:6, borderRadius:999, background:sp.dot }} />
                {sp.label}
              </div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:32, lineHeight:1 }}>{s.count}</div>
              <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:6 }}>
                {i === 0 && 'ยังไม่กดคอนเฟิร์มให้ AI ตรวจ'}
                {i === 1 && 'AI กำลังประมวลผล'}
                {i === 2 && 'Report พร้อมส่งฝ่ายกฎหมาย'}
                {i === 3 && 'อยู่ที่ทีมกฎหมาย'}
                {i === 4 && 'ปิดงาน · ใช้งานในระบบ'}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4 }}>
          {['ทั้งหมด', ...Object.keys(CT_STATUS)].map(f => (
            <button key={f} onClick={() => setFilter(f)} className="btn sm" style={{
              background: filter === f ? 'var(--ink)' : 'transparent',
              color: filter === f ? 'var(--paper)' : 'var(--ink-2)',
              borderColor: filter === f ? 'var(--ink)' : 'var(--rule)',
              padding:'5px 12px',
            }}>{f === 'ทั้งหมด' ? 'ทั้งหมด' : CT_STATUS[f].label}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหา CT / โครงการ / ผู้รับเหมา…" />
          <span style={{ fontSize:12, color:'var(--ink-3)' }}>
            <strong style={{ color:'var(--ink)' }}>{filtered.length}</strong> ฉบับ
          </span>
        </div>
      </div>

      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:'12%' }}>เลขที่</th>
              <th>หัวข้อ / โครงการ</th>
              <th>คู่สัญญา</th>
              <th className="num-col">มูลค่า</th>
              <th className="num-col">ประเด็น AI</th>
              <th>กิจกรรมล่าสุด</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
                ยังไม่มีข้อมูล
              </td></tr>
            ) : filtered.map(c => {
              const sp = CT_STATUS[c.status];
              return (
                <tr key={c.no} onClick={() => go('contract-detail')} style={{ cursor:'pointer' }}>
                  <td>
                    <div className="font-mono" style={{ fontSize:12, color:'var(--ink-2)', fontWeight:500 }}>{c.no}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight:500 }}>{c.title}</div>
                    <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:2 }}>{c.project}</div>
                  </td>
                  <td>
                    <span style={{ display:'inline-flex', gap:8, alignItems:'center' }}>
                      <Av initials={c.supplier.slice(0,2)} kind={c.supKind} />
                      <span style={{ fontSize:12.5 }}>{c.supplier}</span>
                    </span>
                  </td>
                  <td className="num-col num" style={{ fontWeight:500 }}>{money(c.value)}</td>
                  <td className="num-col">
                    {c.findings > 0
                      ? <span style={{
                          display:'inline-flex', alignItems:'center', gap:6,
                          fontSize:11.5, color:'var(--clay)',
                        }}>
                          {Icons.alert} {c.findings} ข้อ
                        </span>
                      : <span style={{ fontSize:11.5, color:'var(--ink-4)' }}>—</span>}
                  </td>
                  <td style={{ fontSize:12, color:'var(--ink-3)' }}>{c.lastAt}</td>
                  <td>
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:6,
                      fontSize:11, fontWeight:500, padding:'2px 10px', borderRadius:999,
                      background: sp.bg, color: sp.fg,
                    }}>
                      <span style={{ width:6, height:6, borderRadius:999, background: sp.dot }} />
                      {sp.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {uploadOpen && <UploadContractModal onClose={() => setUploadOpen(false)} go={go} />}
    </div>
  );
}

function UploadContractModal({ onClose, go }) {
  const [filename, setFilename] = useState('');
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(20,18,14,0.32)',
      display:'grid', placeItems:'center', zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} className="card"
           style={{ width:560, padding:0, boxShadow:'var(--sh-pop)' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)' }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>อัพโหลดสัญญาใหม่</div>
          <h3 className="h-section">เลือกไฟล์สัญญา</h3>
        </div>
        <div style={{ padding:24 }}>
          <p style={{ fontSize:13, color:'var(--ink-2)', margin:'0 0 16px', lineHeight:1.6 }}>
            อัพโหลดไฟล์ PDF ของสัญญาที่ทำแล้วภายนอก ระบบจะยังไม่เริ่มตรวจสอบจนกว่าจะกด <strong>คอนเฟิร์มให้ AI ตรวจ</strong> ในขั้นถัดไป
          </p>
          <label style={{
            display:'block', padding:'32px 24px',
            border:'2px dashed var(--rule-2)', borderRadius:8,
            background:'var(--surface-2)', textAlign:'center', cursor:'pointer',
          }}>
            <div style={{ fontSize:32, color:'var(--ink-4)', marginBottom:8 }}>↑</div>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--ink-2)', marginBottom:4 }}>
              ลากไฟล์มาที่นี่ หรือ <span style={{ color:'var(--teal)', textDecoration:'underline' }}>เลือกไฟล์</span>
            </div>
            <div style={{ fontSize:11, color:'var(--ink-3)' }}>รองรับ .pdf · ไม่เกิน 20 MB</div>
            <input type="file" accept=".pdf" style={{ display:'none' }}
              onChange={e => setFilename(e.target.files?.[0]?.name || 'Contract.pdf')} />
          </label>
          {!filename && (
            <button className="btn ghost sm" style={{ marginTop:12 }}
              onClick={() => setFilename('CT-2024-021_Subcontract_Plumbing.pdf')}>
              ใช้ไฟล์ตัวอย่าง (สำหรับ Demo)
            </button>
          )}
          {filename && (
            <div style={{
              marginTop:14, display:'flex', gap:12, alignItems:'center',
              padding:'12px 14px', background:'var(--surface-2)',
              border:'1px solid var(--rule)', borderRadius:6,
            }}>
              <div style={{
                width:36, height:44, background:'var(--clay)', color:'#fff',
                borderRadius:3, display:'grid', placeItems:'center',
                fontSize:9, fontWeight:600, letterSpacing:0.5, flexShrink:0,
              }}>PDF</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{filename}</div>
                <div style={{ fontSize:11, color:'var(--moss)', marginTop:2 }}>✓ พร้อมอัพโหลด</div>
              </div>
              <button className="btn ghost sm" onClick={() => setFilename('')} style={{ color:'var(--ink-4)' }}>×</button>
            </div>
          )}
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', background:'var(--surface-2)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" disabled={!filename}
            onClick={() => { onClose(); go('contract-detail'); }}
            style={{ opacity: filename ? 1 : 0.5, cursor: filename ? 'pointer' : 'not-allowed' }}>
            {Icons.check} อัพโหลด & ไปที่สัญญาฉบับนี้
          </button>
        </div>
      </div>
    </div>
  );
}

/* =================== Detail (workflow-driven) =================== */

export function ScreenContract({ go }) {
  // phase: 'Uploaded' | 'Reviewing' | 'Reviewed' | 'Legal' | 'Final'
  const [phase, setPhase] = useState('Uploaded');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [legalOpen,   setLegalOpen]   = useState(false);
  const [finalOpen,   setFinalOpen]   = useState(false);

  const sp = CT_STATUS[phase];

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => go('contract')} style={{ marginBottom:20, marginLeft:-8 }}>
        {Icons.back} กลับไปสัญญาทั้งหมด
      </button>

      <div className="page-head" style={{ alignItems:'flex-start' }}>
        <div className="page-title">
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
            <span className="font-mono" style={{ fontSize:12, color:'var(--ink-3)' }}>—</span>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:6,
              fontSize:11, fontWeight:500, padding:'2px 10px', borderRadius:999,
              background: sp.bg, color: sp.fg,
            }}>
              <span style={{ width:6, height:6, borderRadius:999, background: sp.dot }} />
              {sp.label}
            </span>
          </div>
          <h1 className="h-display">ยังไม่มีข้อมูล</h1>
          <div style={{ display:'flex', gap:24, marginTop:12, fontSize:13, color:'var(--ink-3)', flexWrap:'wrap' }}>
            <span>โครงการ <strong style={{ color:'var(--ink-2)' }}>—</strong></span>
            <span>ผู้รับเหมา <strong style={{ color:'var(--ink-2)' }}>—</strong></span>
            <span>มูลค่า <strong style={{ color:'var(--ink-2)' }}>—</strong></span>
          </div>
        </div>
      </div>

      {/* Workflow stepper — horizontal */}
      <div style={{ marginBottom:32, padding:'18px 22px', background:'var(--surface-2)', border:'1px solid var(--rule)', borderRadius:8 }}>
        <div className="eyebrow" style={{ marginBottom:14 }}>ขั้นตอนตรวจสอบสัญญา</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:0, alignItems:'flex-start' }}>
          {[
            { key:'Uploaded',  label:'1. อัพโหลดสัญญา', sub:'รับไฟล์จากภายนอก' },
            { key:'Reviewing', label:'2. AI กำลังตรวจ',  sub:'หลังกดคอนเฟิร์ม' },
            { key:'Reviewed',  label:'3. AI Report',     sub:'รายการที่ต้องแก้' },
            { key:'Legal',     label:'4. ส่งฝ่ายกฎหมาย', sub:'รอผลตรวจ' },
            { key:'Final',     label:'5. Upload Final',  sub:'ไฟล์สัญญาสุดท้าย' },
          ].map((s, i, arr) => {
            const order = ['Uploaded','Reviewing','Reviewed','Legal','Final'];
            const cur   = order.indexOf(phase);
            const idx   = order.indexOf(s.key);
            const isDone = idx < cur;
            const isCur  = idx === cur;
            return (
              <div key={s.key} style={{ position:'relative', paddingRight: i < arr.length - 1 ? 20 : 0 }}>
                {i < arr.length - 1 && (
                  <div style={{
                    position:'absolute', top:14, left:36, right:0, height:2,
                    background: idx < cur ? 'var(--teal)' : 'var(--rule)',
                  }} />
                )}
                <div style={{ display:'flex', alignItems:'flex-start', gap:10, position:'relative', zIndex:1 }}>
                  <span style={{
                    width:28, height:28, borderRadius:999,
                    background: isCur ? 'var(--teal)' : isDone ? 'var(--teal-soft)' : 'var(--rule)',
                    color: isCur ? 'var(--paper)' : 'var(--teal-ink)',
                    display:'inline-grid', placeItems:'center',
                    fontSize:12, fontWeight:600, fontFamily:'var(--font-mono)',
                    flexShrink:0, border: isCur ? '2px solid var(--teal-ink)' : 'none',
                  }}>{isDone ? '✓' : i+1}</span>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:12.5, fontWeight: isCur ? 600 : 500,
                                  color: isCur ? 'var(--ink)' : isDone ? 'var(--ink-2)' : 'var(--ink-4)' }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize:11, color: isCur ? 'var(--ink-3)' : 'var(--ink-4)', marginTop:3, lineHeight:1.4 }}>
                      {s.sub}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:32 }}>
        <div>
          {/* Phase 1: Uploaded → confirm gate */}
          {phase === 'Uploaded' && (
            <div className="card" style={{ padding:32, textAlign:'center' }}>
              <div style={{ marginBottom:16, display:'inline-flex', alignItems:'center', gap:10, padding:'4px 12px', borderRadius:999, background:'#F0E4C5', color:'#6B5121', fontSize:11, fontWeight:500 }}>
                <span style={{ width:6, height:6, borderRadius:999, background:'var(--ochre)' }} />
                ขั้นตอนถัดไป · รอผู้ใช้คอนเฟิร์ม
              </div>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:24 }}>
                <div style={{
                  width:64, height:80, background:'var(--clay)', color:'#fff',
                  borderRadius:6, display:'grid', placeItems:'center',
                  fontSize:14, fontWeight:600, letterSpacing:0.5,
                }}>PDF</div>
              </div>
              <div style={{ fontSize:14, fontWeight:500, marginBottom:6 }}>—</div>
              <div style={{ fontSize:11.5, color:'var(--ink-3)', marginBottom:24 }}>ยังไม่มีข้อมูล</div>
              <h2 className="h-section" style={{ marginBottom:8 }}>คอนเฟิร์มให้ AI ตรวจสอบสัญญานี้?</h2>
              <p style={{ fontSize:13.5, color:'var(--ink-2)', lineHeight:1.7, margin:'0 auto 24px', maxWidth:480 }}>
                ระบบจะใช้ AI วิเคราะห์ข้อความในสัญญาเทียบกับ Template มาตรฐานของบริษัท
                และออก Report รายการประเด็นที่ต้องแก้ไข ใช้เวลาประมาณ <strong>1–2 นาที</strong>
              </p>
              <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                <button className="btn ghost">ยกเลิก / ลบไฟล์</button>
                <button className="btn primary" onClick={() => setConfirmOpen(true)} style={{ padding:'10px 24px' }}>
                  {Icons.sparkles} คอนเฟิร์มให้ AI ตรวจสอบ
                </button>
              </div>
            </div>
          )}

          {/* Phase 2: Reviewing — animated waiting state */}
          {phase === 'Reviewing' && (
            <div className="card" style={{ padding:32, textAlign:'center' }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
                <span style={{
                  width:48, height:48, borderRadius:999,
                  background:'var(--teal)', color:'var(--paper)',
                  display:'inline-grid', placeItems:'center', fontSize:18, fontWeight:600,
                }}>AI</span>
              </div>
              <h2 className="h-section" style={{ marginBottom:8 }}>AI กำลังตรวจสอบสัญญา…</h2>
              <p style={{ fontSize:13, color:'var(--ink-3)', maxWidth:420, margin:'0 auto 20px', lineHeight:1.6 }}>
                กำลังเทียบสัญญากับ Template มาตรฐาน · ตรวจสอบเงื่อนไข · สรุปประเด็นที่ต้องแก้
              </p>
              <div style={{ width:'80%', maxWidth:420, height:6, margin:'0 auto', background:'var(--rule)', borderRadius:999, overflow:'hidden' }}>
                <div style={{ height:'100%', width:'68%', background:'var(--teal)', borderRadius:999 }} />
              </div>
              <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:8 }}>ประมาณ 30 วินาที</div>
              <button className="btn sm" onClick={() => setPhase('Reviewed')} style={{ marginTop:24 }}>
                (ข้าม · ดู Report สำหรับ demo)
              </button>
            </div>
          )}

          {/* Phase 3+: AI Report */}
          {(phase === 'Reviewed' || phase === 'Legal' || phase === 'Final') && (
            <AIReportPanel
              phase={phase}
              onSendToLegal={() => setLegalOpen(true)}
              onUploadFinal={() => setFinalOpen(true)}
            />
          )}
        </div>

        {/* Right rail */}
        <aside style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="card">
            <h3 className="h-card" style={{ marginBottom:14 }}>ข้อมูลสัญญา</h3>
            <KV label="เลขที่สัญญา" value="—" mono />
            <KV label="ประเภท" value="—" />
            <KV label="RFQ อ้างอิง" value="—" mono />
            <KV label="มูลค่ารวม" value="—" />
            <KV label="เซ็นเมื่อ" value="—" />
            <KV label="ระยะเวลา" value="—" />
          </div>

          <div className="card">
            <h3 className="h-card" style={{ marginBottom:14 }}>ไฟล์</h3>
            <div style={{ textAlign:'center', padding:20, color:'var(--ink-3)', fontSize:12.5 }}>
              ยังไม่มีข้อมูล
            </div>
          </div>

          {/* Demo helper: jump to any phase */}
          <div className="card" style={{ background:'var(--surface-2)' }}>
            <div className="eyebrow" style={{ marginBottom:8 }}>Demo · ทดสอบแต่ละขั้นตอน</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {['Uploaded','Reviewing','Reviewed','Legal','Final'].map(p => (
                <button key={p} onClick={() => setPhase(p)} className="btn sm" style={{
                  background: phase === p ? 'var(--ink)' : 'transparent',
                  color: phase === p ? 'var(--paper)' : 'var(--ink-2)',
                  borderColor: phase === p ? 'var(--ink)' : 'var(--rule)',
                  fontSize:10.5, padding:'4px 8px',
                }}>{CT_STATUS[p].label}</button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {confirmOpen && (
        <ConfirmAIModal
          onConfirm={() => { setConfirmOpen(false); setPhase('Reviewing'); setTimeout(() => setPhase('Reviewed'), 2000); }}
          onClose={() => setConfirmOpen(false)} />
      )}
      {legalOpen && (
        <SendToLegalModal
          onSend={() => { setLegalOpen(false); setPhase('Legal'); }}
          onClose={() => setLegalOpen(false)} />
      )}
      {finalOpen && (
        <UploadFinalModal
          onUpload={() => { setFinalOpen(false); setPhase('Final'); }}
          onClose={() => setFinalOpen(false)} />
      )}
    </div>
  );
}

/* =================== AI Report panel =================== */
function AIReportPanel({ phase, onSendToLegal, onUploadFinal }) {
  const findings = [];

  return (
    <>
      <div className="card" style={{ padding:28, background:'var(--surface-2)', marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom:6 }}>AI Risk Report</div>
            <h2 className="h-section" style={{ margin:0 }}>สรุปประเด็นที่ต้องแก้</h2>
          </div>
          <Chip kind="ai">Claude Sonnet</Chip>
        </div>

        <div style={{ padding:'24px 0', textAlign:'center', color:'var(--ink-3)', fontSize:13 }}>
          ยังไม่มีข้อมูล
        </div>

        <div style={{ display:'flex', gap:8, marginTop:24, paddingTop:20, borderTop:'1px solid var(--rule)' }}>
          <button className="btn">{Icons.download} ดาวน์โหลด Report</button>
          {phase === 'Reviewed' && (
            <button className="btn primary" onClick={onSendToLegal}>
              {Icons.external} ส่ง Report ให้ฝ่ายกฎหมาย
            </button>
          )}
          {phase === 'Legal' && (
            <>
              <div style={{ flex:1, padding:'8px 14px', background:'var(--chip-recv-bg)', color:'var(--chip-recv-fg)', borderRadius:6, fontSize:12, display:'flex', alignItems:'center', gap:8 }}>
                <span>{Icons.clock}</span> รอผลตรวจจากฝ่ายกฎหมาย
              </div>
              <button className="btn primary" onClick={onUploadFinal}>
                {Icons.upload} Upload Final
              </button>
            </>
          )}
          {phase === 'Final' && (
            <div style={{ flex:1, padding:'8px 14px', background:'var(--moss-soft)', color:'#2F4A1A', borderRadius:6, fontSize:12, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ color:'var(--moss)' }}>{Icons.check}</span>
              Upload Final เรียบร้อย — สัญญานี้พร้อมใช้งาน
            </div>
          )}
        </div>
      </div>

      <h3 className="h-section" style={{ marginBottom:16 }}>รายการที่ต้องแก้ ({findings.length} ข้อ)</h3>
      {findings.length === 0 ? (
        <div className="card" style={{ padding:40, textAlign:'center', color:'var(--ink-3)', fontSize:13 }}>
          ยังไม่มีข้อมูล
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {findings.map((f, i) => (
            <Finding key={i} {...f} />
          ))}
        </div>
      )}
    </>
  );
}

/* =================== Modals =================== */

function ConfirmAIModal({ onConfirm, onClose }) {
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(20,18,14,0.32)',
      display:'grid', placeItems:'center', zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} className="card"
           style={{ width:480, padding:0, boxShadow:'var(--sh-pop)' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)' }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>ก่อนเริ่มตรวจสอบ</div>
          <h3 className="h-section">ยืนยันให้ AI ตรวจสอบ</h3>
        </div>
        <div style={{ padding:24 }}>
          <p style={{ margin:'0 0 14px', fontSize:13.5, color:'var(--ink-2)', lineHeight:1.7 }}>
            AI จะอ่านเนื้อหาสัญญาทั้งฉบับและออก Report ภายใน 1–2 นาที — กรุณายืนยันก่อนเริ่ม
          </p>
          <ul style={{ margin:0, paddingLeft:18, fontSize:12.5, color:'var(--ink-3)', lineHeight:1.9 }}>
            <li>ระบบจะส่งข้อมูลไป AI Service ที่บริษัทใช้</li>
            <li>ผลที่ได้เป็นเพียงคำแนะนำ — ต้องตรวจสอบโดยฝ่ายกฎหมายอีกครั้ง</li>
            <li>เริ่มได้ทันที · กดยกเลิกได้ระหว่างประมวลผล</li>
          </ul>
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', background:'var(--surface-2)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={onConfirm}>
            {Icons.sparkles} ยืนยัน · เริ่มตรวจสอบ
          </button>
        </div>
      </div>
    </div>
  );
}

function SendToLegalModal({ onSend, onClose }) {
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(20,18,14,0.32)',
      display:'grid', placeItems:'center', zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} className="card"
           style={{ width:560, padding:0, boxShadow:'var(--sh-pop)' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)' }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>ส่งให้ฝ่ายกฎหมายตรวจ</div>
          <h3 className="h-section">ส่ง AI Report ให้ฝ่ายกฎหมาย</h3>
        </div>
        <div style={{ padding:24, display:'flex', flexDirection:'column', gap:14 }}>
          <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <span style={{ fontSize:11.5, color:'var(--ink-3)', fontWeight:500 }}>ส่งถึง</span>
            <input value={to} onChange={e => setTo(e.target.value)}
              style={{
                padding:'9px 12px', fontSize:13, border:'1px solid var(--rule-2)',
                borderRadius:6, background:'var(--paper)', outline:'none', fontFamily:'inherit',
              }} />
          </label>
          <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <span style={{ fontSize:11.5, color:'var(--ink-3)', fontWeight:500 }}>ข้อความ</span>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              style={{
                padding:'9px 12px', fontSize:13, border:'1px solid var(--rule-2)',
                borderRadius:6, background:'var(--paper)', outline:'none',
                fontFamily:'inherit', minHeight:96, resize:'vertical',
              }} />
          </label>
          <div style={{ padding:'10px 14px', background:'var(--surface-2)', borderRadius:6, fontSize:11.5, color:'var(--ink-3)' }}>
            📎 จะแนบ AI Report และไฟล์สัญญาฉบับร่าง
          </div>
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', background:'var(--surface-2)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={onSend}>
            {Icons.external} ส่งให้ฝ่ายกฎหมาย
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadFinalModal({ onUpload, onClose }) {
  const [filename, setFilename] = useState('');
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(20,18,14,0.32)',
      display:'grid', placeItems:'center', zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} className="card"
           style={{ width:520, padding:0, boxShadow:'var(--sh-pop)' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)' }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>ขั้นสุดท้าย</div>
          <h3 className="h-section">อัพโหลดสัญญาฉบับ Final</h3>
        </div>
        <div style={{ padding:24 }}>
          <p style={{ fontSize:13, color:'var(--ink-2)', margin:'0 0 16px', lineHeight:1.6 }}>
            อัพโหลดไฟล์สัญญาที่ผ่านการตรวจสอบจากฝ่ายกฎหมายและเซ็นเรียบร้อย — เมื่อบันทึกแล้ว สถานะจะเปลี่ยนเป็น Final
          </p>
          <label style={{
            display:'block', padding:'24px 20px',
            border:'2px dashed var(--rule-2)', borderRadius:8,
            background:'var(--surface-2)', textAlign:'center', cursor:'pointer',
          }}>
            <div style={{ fontSize:24, color:'var(--ink-4)', marginBottom:6 }}>↑</div>
            <div style={{ fontSize:12.5, fontWeight:500, color:'var(--ink-2)' }}>
              ลากไฟล์ หรือ <span style={{ color:'var(--teal)', textDecoration:'underline' }}>เลือกไฟล์</span>
            </div>
            <input type="file" accept=".pdf" style={{ display:'none' }}
              onChange={e => setFilename(e.target.files?.[0]?.name || 'Contract_Final_Signed.pdf')} />
          </label>
          {!filename && (
            <button className="btn ghost sm" style={{ marginTop:10 }}
              onClick={() => setFilename('Contract_Final_Signed.pdf')}>
              ใช้ไฟล์ตัวอย่าง (สำหรับ Demo)
            </button>
          )}
          {filename && (
            <div style={{
              marginTop:14, display:'flex', gap:12, alignItems:'center',
              padding:'10px 14px', background:'var(--surface-2)',
              border:'1px solid var(--rule)', borderRadius:6,
            }}>
              <div style={{ width:30, height:36, background:'var(--clay)', color:'#fff',
                  borderRadius:3, display:'grid', placeItems:'center',
                  fontSize:8, fontWeight:600, letterSpacing:0.4, flexShrink:0 }}>PDF</div>
              <div style={{ flex:1, fontSize:12.5 }}>{filename}</div>
              <button className="btn ghost sm" onClick={() => setFilename('')} style={{ color:'var(--ink-4)' }}>×</button>
            </div>
          )}
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', background:'var(--surface-2)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" disabled={!filename} onClick={onUpload}
            style={{ opacity: filename ? 1 : 0.5, cursor: filename ? 'pointer' : 'not-allowed' }}>
            {Icons.check} บันทึก & ปิดสัญญา
          </button>
        </div>
      </div>
    </div>
  );
}

/* =================== Subcomponents =================== */

function Finding({ tone, title, clause, category, body, isPositive }) {
  const tones = {
    warn: 'var(--ochre)',
    err:  'var(--clay)',
    info: isPositive ? 'var(--moss)' : 'var(--teal)',
  };
  return (
    <div style={{
      background:'var(--surface)',
      border:'1px solid var(--rule)',
      borderLeft:`3px solid ${tones[tone]}`,
      borderRadius:6, padding:20,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:14, fontWeight:500 }}>{title}</span>
          {isPositive && <span style={{ color:'var(--moss)', fontSize:14 }}>✓</span>}
        </div>
        <div style={{ display:'flex', gap:8, fontSize:11, color:'var(--ink-3)' }}>
          <span style={{ fontFamily:'var(--font-mono)' }}>{clause}</span>
          <span>·</span>
          <span>{category}</span>
        </div>
      </div>
      <p style={{ fontSize:12.5, color:'var(--ink-2)', lineHeight:1.6, margin:0 }}>{body}</p>
    </div>
  );
}

function KV({ label, value, mono }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--rule)', fontSize:12.5 }}>
      <span style={{ color:'var(--ink-3)' }}>{label}</span>
      <span style={{
        color:'var(--ink)', fontWeight:500,
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        fontSize: mono ? 12 : 12.5,
      }}>{value}</span>
    </div>
  );
}

function FileItem({ name, size, tag, primary }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid var(--rule)' }}>
      <span style={{
        width:24, height:28, background: primary ? 'var(--clay)' : 'var(--paper-2)',
        color: primary ? '#fff' : (name.endsWith('.xlsx') ? 'var(--moss)' : 'var(--clay)'),
        borderRadius:3, display:'grid', placeItems:'center',
        fontSize:8, fontWeight:600, flexShrink:0,
      }}>{name.split('.').pop().toUpperCase()}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
        <div style={{ fontSize:10, color:'var(--ink-3)', marginTop:1 }}>{size} · {tag}</div>
      </div>
      <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }}>{Icons.download}</button>
    </div>
  );
}
