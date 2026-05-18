/* global React, Icons, Chip, settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle, BulkExcelButton, PROJECT_TYPES_DATA */
/*
  Settings → Project List
  - Removed RFQ count column
  - Type pulled from Project Types master (managed separately)
  - Status: Active / Closed
  - Summary splits units & contracts by Active / Closed
  - Bulk Excel template support
*/

const { useState: useStatePR } = React;

const PROJECT_DATA = [
  { code:'IE-LV01', short:'LV01', name:'Initial Living บางนา',     type:'Townhome', status:'Active', units:48,  start:'2024-08-15', contracts:18 },
  { code:'IE-LV04', short:'LV04', name:'Initial Living รังสิต',     type:'Townhome', status:'Active', units:64,  start:'2024-10-01', contracts:22 },
  { code:'IE-VL02', short:'VL02', name:'Initial Villa',              type:'Villa',    status:'Active', units:18,  start:'2024-12-20', contracts:8 },
  { code:'IE-TH03', short:'TH03', name:'Initial Town',               type:'Townhome', status:'Active', units:32,  start:'2025-01-10', contracts:14 },
  { code:'IE-LV02', short:'LV02', name:'Initial Living ลาดพร้าว',    type:'Townhome', status:'Active', units:42,  start:'2025-06-01', contracts:0 },
  { code:'IE-CD05', short:'CD05', name:'Initial Condo อ่อนนุช',      type:'Condo',    status:'Active', units:124, start:'2025-09-01', contracts:0 },
  { code:'IE-VL01', short:'VL01', name:'Initial Villa หัวหิน',       type:'Villa',    status:'Closed', units:8,   start:'2023-05-10', contracts:38 },
  { code:'IE-LV03', short:'LV03', name:'Initial Living ปทุมวัน',     type:'Townhome', status:'Closed', units:24,  start:'2022-11-05', contracts:32 },
];

const SAMPLE_PROJECT_ROWS = [
  { short:'LV05', name:'Initial Living สาทร',   type:'Townhome', units:36, start:'2025-08-01', status:'Active' },
  { short:'VL03', name:'Initial Villa ภูเก็ต',   type:'Villa',    units:12, start:'2025-10-15', status:'Active' },
  { short:'TH04', name:'Initial Town ราชพฤกษ์', type:'Townhome', units:48, start:'2025-12-01', status:'Active' },
];

const PROJECT_BULK_COLUMNS = [
  { key:'short',  name:'Short Code',  required:true },
  { key:'name',   name:'ชื่อโครงการ', required:true },
  { key:'type',   name:'ประเภท',      required:true },
  { key:'units',  name:'จำนวนยูนิต',   required:false },
  { key:'start',  name:'วันเริ่มงาน',    required:false },
  { key:'status', name:'สถานะ',         required:false },
];

function ScreenSettingsProjects({ go }) {
  const [q, setQ] = useStatePR('');
  const [filter, setFilter] = useStatePR('ทั้งหมด');
  const [addOpen, setAddOpen] = useStatePR(false);

  const filtered = PROJECT_DATA.filter(p => {
    if (filter !== 'ทั้งหมด' && p.status !== filter) return false;
    if (q && !(p.name.includes(q) || p.code.toLowerCase().includes(q.toLowerCase()) || p.short.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  // Compute split stats
  const active   = PROJECT_DATA.filter(p => p.status === 'Active');
  const closed   = PROJECT_DATA.filter(p => p.status === 'Closed');
  const activeUnits     = active.reduce((s,p)=>s+p.units,0);
  const closedUnits     = closed.reduce((s,p)=>s+p.units,0);
  const activeContracts = active.reduce((s,p)=>s+p.contracts,0);
  const closedContracts = closed.reduce((s,p)=>s+p.contracts,0);

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Settings · Master Data</div>
          <h1 className="h-display">โครงการ (Project List)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:620 }}>
            ทะเบียนโครงการทั้งหมด — Short Code ใช้สร้างรหัส <span className="font-mono" style={{ color:'var(--ink-2)' }}>IE-[Short Code]</span> · ประเภทโครงการ <button onClick={() => go('settings-project-types')} style={{ background:'none', border:0, padding:0, color:'var(--teal)', textDecoration:'underline', cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>ตั้งค่าใน Project Type</button>
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <BulkExcelButton entity="โครงการ" columns={PROJECT_BULK_COLUMNS} sampleRows={SAMPLE_PROJECT_ROWS} />
          <button className="btn">{Icons.download} Export</button>
          <button className="btn primary" onClick={() => setAddOpen(true)}>{Icons.plus} เพิ่มโครงการ</button>
        </div>
      </div>

      {/* Summary with Active/Closed splits */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:0,
        borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)',
        padding:'24px 0', marginBottom:32,
      }}>
        <div>
          <div className="stat-label">โครงการทั้งหมด</div>
          <div className="stat-value">{PROJECT_DATA.length}</div>
          <div style={{ display:'flex', gap:14, marginTop:8, fontSize:12 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--moss)' }} />
              <span style={{ color:'var(--ink-3)' }}>Active</span>
              <strong style={{ color:'var(--ink)' }}>{active.length}</strong>
            </span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--ink-4)' }} />
              <span style={{ color:'var(--ink-3)' }}>Closed</span>
              <strong style={{ color:'var(--ink)' }}>{closed.length}</strong>
            </span>
          </div>
        </div>

        <div style={{ paddingLeft:28, borderLeft:'1px solid var(--rule)' }}>
          <div className="stat-label">หน่วยรวม (ยูนิต)</div>
          <div className="stat-value">{(activeUnits + closedUnits).toLocaleString()}</div>
          <div style={{ display:'flex', gap:14, marginTop:8, fontSize:12 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--moss)' }} />
              <span style={{ color:'var(--ink-3)' }}>Active</span>
              <strong style={{ color:'var(--ink)' }}>{activeUnits} หลัง</strong>
            </span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--ink-4)' }} />
              <span style={{ color:'var(--ink-3)' }}>Closed</span>
              <strong style={{ color:'var(--ink)' }}>{closedUnits} หลัง</strong>
            </span>
          </div>
        </div>

        <div style={{ paddingLeft:28, borderLeft:'1px solid var(--rule)' }}>
          <div className="stat-label">สัญญาที่ผูก</div>
          <div className="stat-value">{activeContracts + closedContracts}</div>
          <div style={{ display:'flex', gap:14, marginTop:8, fontSize:12 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--moss)' }} />
              <span style={{ color:'var(--ink-3)' }}>Active</span>
              <strong style={{ color:'var(--ink)' }}>{activeContracts} ฉบับ</strong>
            </span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--ink-4)' }} />
              <span style={{ color:'var(--ink-3)' }}>Closed</span>
              <strong style={{ color:'var(--ink)' }}>{closedContracts} ฉบับ</strong>
            </span>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4 }}>
          {['ทั้งหมด','Active','Closed'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className="btn sm" style={{
              background: filter === f ? 'var(--ink)' : 'transparent',
              color: filter === f ? 'var(--paper)' : 'var(--ink-2)',
              borderColor: filter === f ? 'var(--ink)' : 'var(--rule)',
              padding:'5px 12px',
            }}>{f}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหาโครงการ…" />
          <span style={{ fontSize:12, color:'var(--ink-3)' }}>
            แสดง <strong style={{ color:'var(--ink)' }}>{filtered.length}</strong> รายการ
          </span>
        </div>
      </div>

      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:90 }}>Short Code</th>
              <th style={{ width:110 }}>รหัส</th>
              <th>ชื่อโครงการ</th>
              <th>ประเภท</th>
              <th className="num-col">ยูนิต</th>
              <th>เริ่มงาน</th>
              <th className="num-col">สัญญา</th>
              <th>สถานะ</th>
              <th style={{ width:48 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.code}>
                <td>
                  <span style={{
                    display:'inline-block', padding:'3px 10px', borderRadius:4,
                    background:'var(--teal-soft)', color:'var(--teal-ink)',
                    fontFamily:'var(--font-mono)', fontSize:11.5, fontWeight:600, letterSpacing:0.02,
                  }}>{p.short}</span>
                </td>
                <td className="font-mono" style={{ fontSize:12, color:'var(--ink-2)' }}>{p.code}</td>
                <td style={{ fontWeight:500 }}>{p.name}</td>
                <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{p.type}</td>
                <td className="num-col num" style={{ color:'var(--ink-2)' }}>{p.units}</td>
                <td style={{ fontSize:12, color:'var(--ink-3)' }}>{p.start}</td>
                <td className="num-col num" style={{ color:'var(--ink-2)' }}>{p.contracts}</td>
                <td><StatusPill status={p.status} /></td>
                <td style={{ textAlign:'right' }}>
                  <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }}>{Icons.edit}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addOpen && <AddProjectModal go={go} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddProjectModal({ go, onClose }) {
  const activeTypes = (window.PROJECT_TYPES_DATA || []).filter(t => t.status === 'Active');
  const [form, setForm] = useStatePR({
    short: '',
    name: '',
    type: activeTypes[0]?.name || '',
    units: '',
    start: '',
    status: 'Active',
  });
  const set = (k,v) => setForm({ ...form, [k]:v });
  const previewCode = form.short ? `IE-${form.short.toUpperCase()}` : 'IE-—';

  return (
    <SettingsModal eyebrow="เพิ่มโครงการ" title="โครงการใหม่" onClose={onClose}>
      <div style={{
        padding:'14px 16px', background:'var(--surface-2)',
        border:'1px solid var(--rule)', borderRadius:6, marginBottom:20,
        display:'flex', alignItems:'center', gap:16,
      }}>
        <div style={{ flex:1 }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>รหัสโครงการ (auto-generate)</div>
          <div className="font-mono" style={{ fontSize:18, color: form.short ? 'var(--teal)' : 'var(--ink-4)' }}>{previewCode}</div>
        </div>
        <div style={{ fontSize:11, color:'var(--ink-3)', maxWidth:200, textAlign:'right' }}>
          รหัสจะสร้างจาก <strong>IE-</strong> + Short Code
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:16 }}>
        <SettingsField label="Short Code" required hint="2–4 ตัวอักษร · ใช้ในรหัส">
          <input value={form.short} onChange={e=>set('short', e.target.value.toUpperCase())} placeholder="เช่น LV05"
                 style={{ ...settingsInputStyle, textTransform:'uppercase', fontFamily:'var(--font-mono)' }} maxLength={6} />
        </SettingsField>
        <SettingsField label="ชื่อโครงการ" required>
          <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เช่น Initial Living สาทร" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="ประเภท" hint={<span>เพิ่ม/แก้ไขได้ที่ <button onClick={()=>go('settings-project-types')} style={{ background:'none', border:0, padding:0, color:'var(--teal)', textDecoration:'underline', cursor:'pointer' }}>Project Type</button></span>}>
          <select value={form.type} onChange={e=>set('type', e.target.value)} style={settingsInputStyle}>
            {activeTypes.map(t => <option key={t.code} value={t.name}>{t.name}</option>)}
          </select>
        </SettingsField>
        <SettingsField label="จำนวนยูนิต">
          <input type="number" value={form.units} onChange={e=>set('units', e.target.value)} placeholder="0" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="วันเริ่มงาน">
          <input type="date" value={form.start} onChange={e=>set('start', e.target.value)} style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="สถานะ">
          <StatusToggle options={['Active','Closed']} value={form.status} onChange={v => set('status', v)} />
        </SettingsField>
      </div>
    </SettingsModal>
  );
}

window.ScreenSettingsProjects = ScreenSettingsProjects;
