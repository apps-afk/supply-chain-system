/* global React, Icons, settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle, BulkExcelButton */
/*
  Settings → Project Type List
  Single-level master — used by Projects page to pick type
*/

const { useState: useStatePT } = React;

const PROJECT_TYPES_DATA = [
  { code:'PT-001', name:'Townhome',         desc:'ทาวน์โฮม / ทาวน์เฮ้าส์',          status:'Active',     projects:3 },
  { code:'PT-002', name:'Villa',            desc:'บ้านเดี่ยวระดับพรีเมียม',          status:'Active',     projects:2 },
  { code:'PT-003', name:'Condo',            desc:'อาคารชุดพักอาศัย',                status:'Active',     projects:1 },
  { code:'PT-004', name:'Detached House',   desc:'บ้านเดี่ยว',                       status:'Active',     projects:0 },
  { code:'PT-005', name:'Mixed-use',        desc:'พักอาศัยและพาณิชย์',              status:'Active',     projects:0 },
  { code:'PT-006', name:'Home Office',      desc:'บ้านพร้อมพื้นที่สำนักงาน',         status:'Non-Active', projects:0 },
];

// Expose for cross-screen lookup
window.PROJECT_TYPES_DATA = PROJECT_TYPES_DATA;

function ScreenSettingsProjectTypes({ go }) {
  const [q, setQ] = useStatePT('');
  const [filter, setFilter] = useStatePT('ทั้งหมด');
  const [addOpen, setAddOpen] = useStatePT(false);

  const filtered = PROJECT_TYPES_DATA.filter(p => {
    if (filter !== 'ทั้งหมด' && p.status !== filter) return false;
    if (q && !(p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Settings · Master Data</div>
          <h1 className="h-display">ประเภทโครงการ (Project Type)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:600 }}>
            ใช้ในการแยกประเภทของโครงการ — Auto-Run รหัส <span className="font-mono" style={{ color:'var(--ink-2)' }}>PT-NNN</span>
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn primary" onClick={() => setAddOpen(true)}>{Icons.plus} เพิ่มประเภท</button>
        </div>
      </div>

      <SettingsStatStrip stats={[
        { label:'ประเภททั้งหมด', value: PROJECT_TYPES_DATA.length, sub:`${PROJECT_TYPES_DATA.filter(p=>p.status==='Active').length} Active` },
      ]} />

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', gap:4 }}>
          {['ทั้งหมด','Active','Non-Active'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className="btn sm" style={{
              background: filter === f ? 'var(--ink)' : 'transparent',
              color: filter === f ? 'var(--paper)' : 'var(--ink-2)',
              borderColor: filter === f ? 'var(--ink)' : 'var(--rule)',
              padding:'5px 12px',
            }}>{f}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหาประเภท…" />
        </div>
      </div>

      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:100 }}>รหัส</th>
              <th style={{ width:'24%' }}>ชื่อประเภท</th>
              <th>คำอธิบาย</th>
              <th className="num-col">โครงการที่ใช้</th>
              <th style={{ width:120 }}>สถานะ</th>
              <th style={{ width:48 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.code}>
                <td className="font-mono" style={{ fontSize:12, color:'var(--ink-2)', fontWeight:500 }}>{p.code}</td>
                <td style={{ fontWeight:500 }}>{p.name}</td>
                <td style={{ fontSize:12.5, color:'var(--ink-3)' }}>{p.desc}</td>
                <td className="num-col num" style={{ color:'var(--ink-2)' }}>{p.projects}</td>
                <td><StatusPill status={p.status} /></td>
                <td style={{ textAlign:'right' }}>
                  <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }}>{Icons.edit}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addOpen && <AddProjectTypeModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddProjectTypeModal({ onClose }) {
  const [form, setForm] = useStatePT({ name:'', desc:'', status:'Active' });
  const set = (k,v) => setForm({ ...form, [k]:v });
  const nextCode = `PT-${String(PROJECT_TYPES_DATA.length + 1).padStart(3,'0')}`;

  return (
    <SettingsModal eyebrow="เพิ่มประเภทโครงการ" title="ประเภทใหม่" onClose={onClose} width={520}>
      <div style={{
        padding:'14px 16px', background:'var(--surface-2)',
        border:'1px solid var(--rule)', borderRadius:6, marginBottom:20,
      }}>
        <div className="eyebrow" style={{ marginBottom:4 }}>รหัส (auto-generate)</div>
        <div className="font-mono" style={{ fontSize:18, color:'var(--teal)' }}>{nextCode}</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:14 }}>
        <SettingsField label="ชื่อประเภท" required>
          <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เช่น Mixed-use" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="คำอธิบาย">
          <input value={form.desc} onChange={e=>set('desc', e.target.value)} placeholder="คำอธิบายสั้น ๆ" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="สถานะ">
          <StatusToggle options={['Active','Non-Active']} value={form.status} onChange={v => set('status', v)} />
        </SettingsField>
      </div>
    </SettingsModal>
  );
}

window.ScreenSettingsProjectTypes = ScreenSettingsProjectTypes;
