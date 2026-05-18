/* global React, Icons, Chip, Av, money, settingsInputStyle, SettingsField */
/*
  Compare → Upload Ref
  After PDF was taken out for external approval and selection was made,
  user uploads the signed reference doc back into the system.
*/

const { useState: useStateUR } = React;

function ScreenCompareUploadRef({ go }) {
  const [filename, setFilename] = useStateUR('');
  const [selectedSupplier, setSelectedSupplier] = useStateUR('');
  const [approvedBy, setApprovedBy] = useStateUR('');
  const [approvedDate, setApprovedDate] = useStateUR('');
  const [notes, setNotes] = useStateUR('');
  const [uploaded, setUploaded] = useStateUR(false);

  const canSave = filename && selectedSupplier && approvedBy && approvedDate;

  if (uploaded) {
    return (
      <div className="page">
        <button className="btn ghost sm" onClick={() => go('compare')} style={{ marginBottom: 20, marginLeft: -8 }}>
          {Icons.back} กลับไป Compare
        </button>

        <div className="page-head" style={{ alignItems:'flex-start' }}>
          <div className="page-title">
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
              <span className="font-mono" style={{ fontSize:12, color:'var(--ink-3)' }}>CMP-2025-038</span>
              <span style={{
                display:'inline-flex', alignItems:'center', gap:6,
                fontSize:11, fontWeight:500, padding:'2px 10px', borderRadius:999,
                background:'var(--moss-soft)', color:'#2F4A1A',
              }}>
                <span style={{ width:6, height:6, borderRadius:999, background:'var(--moss)' }} />
                เลือกแล้ว · มี Ref
              </span>
            </div>
            <h1 className="h-display">Upload Ref สำเร็จ</h1>
            <p style={{ fontSize:14, color:'var(--ink-3)', maxWidth:560, lineHeight:1.6, margin:'8px 0 0' }}>
              เอกสารอ้างอิงและการเลือก Supplier ถูกบันทึกในระบบเรียบร้อย — สถานะของเอกสารเปรียบเทียบเปลี่ยนเป็น <strong style={{ color:'var(--ink-2)' }}>Decided</strong>
            </p>
            <div style={{ display:'flex', gap:8, marginTop:24 }}>
              <button className="btn primary" onClick={() => go('compare-detail')}>ดูเอกสารเปรียบเทียบ</button>
              <button className="btn" onClick={() => go('compare')}>กลับไปรายการ</button>
            </div>
          </div>
        </div>

        {/* Recap card */}
        <div className="card" style={{ padding:0, overflow:'hidden', marginTop:24 }}>
          <div style={{ padding:'14px 24px', background:'var(--surface-2)', borderBottom:'1px solid var(--rule)' }}>
            <span className="eyebrow">สรุปการตัดสินใจ</span>
          </div>
          <div style={{ padding:'24px 24px', display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:32 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom:6 }}>Supplier ที่เลือก</div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:20, lineHeight:1.2 }}>{selectedSupplier}</div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom:6 }}>อนุมัติโดย</div>
              <div style={{ fontSize:14, fontWeight:500 }}>{approvedBy}</div>
              <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:2 }}>เมื่อ {approvedDate}</div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom:6 }}>ไฟล์ Ref</div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <div style={{
                  width:24, height:30, background:'var(--clay)', color:'#fff',
                  borderRadius:3, display:'grid', placeItems:'center',
                  fontSize:8, fontWeight:600, letterSpacing:0.5, flexShrink:0,
                }}>PDF</div>
                <span style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>{filename}</span>
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom:6 }}>สถานะ</div>
              <span style={{
                display:'inline-flex', alignItems:'center', gap:6,
                fontSize:11.5, fontWeight:500, padding:'4px 12px', borderRadius:999,
                background:'var(--moss-soft)', color:'#2F4A1A',
              }}>
                <span style={{ width:6, height:6, borderRadius:999, background:'var(--moss)' }} />
                Decided
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => go('compare')} style={{ marginBottom: 20, marginLeft: -8 }}>
        {Icons.back} กลับไป Compare
      </button>

      <div className="page-head" style={{ alignItems:'flex-start' }}>
        <div className="page-title">
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
            <span className="font-mono" style={{ fontSize:12, color:'var(--ink-3)' }}>CMP-2025-038</span>
            <Chip kind="active">รอ Upload Ref</Chip>
          </div>
          <h1 className="h-display">Upload เอกสารอ้างอิงกลับ</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', maxWidth:580, lineHeight:1.6, margin:'8px 0 0' }}>
            หลังจากนำ PDF ไปอนุมัติและเลือก Supplier ในระบบภายนอกแล้ว — Upload เอกสารที่เซ็นแล้วกลับมาเป็นหลักฐาน เพื่อปิดเอกสารเปรียบเทียบนี้
          </p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:32, alignItems:'flex-start' }}>
        {/* Form */}
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
          <div className="card" style={{ padding:'20px 24px' }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:16 }}>
              <span style={{
                width:22, height:22, borderRadius:999, background:'var(--paper-2)',
                color:'var(--ink-2)', display:'inline-grid', placeItems:'center',
                fontSize:11, fontWeight:600, fontFamily:'var(--font-mono)',
                alignSelf:'center', flexShrink:0,
              }}>1</span>
              <div style={{ flex:1 }}>
                <h3 className="h-card" style={{ marginBottom:2 }}>เลือกไฟล์ Ref</h3>
                <p style={{ fontSize:12, color:'var(--ink-3)', margin:0 }}>PDF เอกสารเปรียบเทียบที่เซ็นอนุมัติแล้ว · รองรับ .pdf .jpg .png</p>
              </div>
            </div>

            <label style={{
              display:'block', padding:'32px 24px',
              border:'2px dashed var(--rule-2)', borderRadius:8,
              background:'var(--surface-2)', textAlign:'center', cursor:'pointer',
            }}>
              <div style={{ fontSize:32, color:'var(--ink-4)', marginBottom:8 }}>↑</div>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--ink-2)', marginBottom:4 }}>
                ลากไฟล์มาที่นี่ หรือ <span style={{ color:'var(--teal)', textDecoration:'underline' }}>เลือกไฟล์</span>
              </div>
              <div style={{ fontSize:11, color:'var(--ink-3)' }}>รองรับ .pdf .jpg .png · ไม่เกิน 10 MB</div>
              <input type="file" accept=".pdf,.jpg,.png" style={{ display:'none' }}
                onChange={e => setFilename(e.target.files?.[0]?.name || 'CMP-2025-038_Signed.pdf')} />
            </label>

            {!filename && (
              <button className="btn ghost sm" onClick={() => setFilename('CMP-2025-038_Signed.pdf')}
                style={{ marginTop:12 }}>
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

          <div className="card" style={{ padding:'20px 24px' }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:16 }}>
              <span style={{
                width:22, height:22, borderRadius:999, background:'var(--paper-2)',
                color:'var(--ink-2)', display:'inline-grid', placeItems:'center',
                fontSize:11, fontWeight:600, fontFamily:'var(--font-mono)',
                alignSelf:'center', flexShrink:0,
              }}>2</span>
              <div style={{ flex:1 }}>
                <h3 className="h-card" style={{ marginBottom:2 }}>ระบุผลการตัดสินใจ</h3>
                <p style={{ fontSize:12, color:'var(--ink-3)', margin:0 }}>Supplier ที่ถูกเลือก และผู้อนุมัติ</p>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <SettingsField label="Supplier ที่เลือก" required>
                <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} style={settingsInputStyle}>
                  <option value="">— เลือก —</option>
                  <option>เอเชียสตีล</option>
                  <option>รุ่งเรืองสตีล</option>
                  <option>SCG Distribution</option>
                </select>
              </SettingsField>
              <SettingsField label="วันที่อนุมัติ" required>
                <input type="date" value={approvedDate} onChange={e => setApprovedDate(e.target.value)} style={settingsInputStyle} />
              </SettingsField>
              <SettingsField label="ผู้อนุมัติ" required>
                <input value={approvedBy} onChange={e => setApprovedBy(e.target.value)}
                  placeholder="เช่น กิตติพงศ์ วงศ์ทอง (PM)" style={settingsInputStyle} />
              </SettingsField>
              <SettingsField label="เหตุผลในการเลือก">
                <input value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="เช่น ราคาต่ำสุด + ส่งเร็ว" style={settingsInputStyle} />
              </SettingsField>
            </div>
          </div>
        </div>

        {/* Right: original compare summary */}
        <div className="card" style={{ padding:20 }}>
          <div className="eyebrow" style={{ marginBottom:12 }}>เอกสารเปรียบเทียบ</div>
          <div style={{ fontSize:14, fontWeight:500, marginBottom:4 }}>เหล็กเส้น & ปูน ล็อต Q2</div>
          <div className="font-mono" style={{ fontSize:11.5, color:'var(--ink-3)', marginBottom:14 }}>CMP-2025-038</div>

          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {[
              ['โหมด','จาก RFQ'],
              ['โครงการ','IE-LV04 · Initial Living รังสิต'],
              ['รายการ','5 รายการ'],
              ['Supplier','3 ราย'],
              ['สร้าง','17 พ.ค. 68'],
            ].map(([k,v],i,a) => (
              <div key={k} style={{
                display:'flex', justifyContent:'space-between', gap:12,
                padding:'8px 0', borderBottom: i < a.length-1 ? '1px solid var(--rule)' : 'none',
              }}>
                <span style={{ fontSize:11.5, color:'var(--ink-3)' }}>{k}</span>
                <span style={{ fontSize:12.5, color:'var(--ink)', textAlign:'right' }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop:16, padding:'12px 14px', background:'var(--teal-soft)', borderRadius:6 }}>
            <div className="eyebrow" style={{ marginBottom:4, color:'var(--teal-ink)' }}>AI แนะนำ</div>
            <div style={{ fontSize:13, color:'var(--teal-ink)' }}>
              <strong>รุ่งเรืองสตีล</strong> · ประหยัด <span style={{ color:'var(--moss)' }}>฿37,000</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div style={{
        position:'fixed', left:240, right:0, bottom:0,
        background:'var(--surface)', borderTop:'1px solid var(--rule)',
        padding:'16px 48px', display:'flex', alignItems:'center', gap:24,
        boxShadow:'0 -8px 24px -12px rgba(20,18,14,0.10)', zIndex:10,
      }}>
        <div style={{ fontSize:12.5, color:'var(--ink-3)' }}>
          {canSave ? '✓ พร้อมบันทึก' : 'กรุณากรอกข้อมูลให้ครบ'}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button className="btn ghost" onClick={() => go('compare')}>ยกเลิก</button>
          <button className="btn primary" disabled={!canSave}
            onClick={() => setUploaded(true)}
            style={{ padding:'10px 20px', opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'not-allowed' }}>
            {Icons.check} บันทึก Ref & เปลี่ยนสถานะเป็น Decided
          </button>
        </div>
      </div>
    </div>
  );
}

window.ScreenCompareUploadRef = ScreenCompareUploadRef;
