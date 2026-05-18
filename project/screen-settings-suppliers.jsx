/* global React, Icons, Chip, Av, settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle, BulkExcelButton, MultiSelectChips */
/*
  Settings → Supplier List
  - Multi-select Category (sourced from Material + SubContract category masters)
  - No rating (removed)
  - Status: Active / Blacklist
  - Summary card: supplier count only
  - Bulk Excel
  - Categories hidden in list — visible in expanded "ดูเพิ่มเติม" row
*/

const { useState: useStateSP } = React;

const SUPPLIER_DATA = [
  { code:'SUP-00001', name:'เอเชียสตีล จำกัด',         kind:'aw',     tax:'0105556012345', address:'19/8 ม.4 ถ.บางนา-ตราด กม.18 ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540', contact:{ name:'คุณวีระ สุขสบาย',  phone:'081-234-5678', email:'sales@asiasteel.co.th',   role:'Sales Manager' }, categories:['งานโครงสร้าง'],                   credit:'45 วัน', rfqs:18, joined:'2022-03-15', status:'Active' },
  { code:'SUP-00002', name:'รุ่งเรืองสตีล',             kind:'rr',     tax:'0105548088876', address:'88 ถ.พระราม 2 แขวงท่าข้าม เขตบางขุนเทียน กรุงเทพฯ 10150',           contact:{ name:'คุณสมชาย ใจดี',   phone:'089-555-1212', email:'order@rungrueng.com',    role:'Sales' },         categories:['งานโครงสร้าง'],                   credit:'30 วัน', rfqs:24, joined:'2021-08-02', status:'Active' },
  { code:'SUP-00003', name:'SCG Distribution',          kind:'sc',     tax:'0107536000234', address:'1 ถ.ปูนซิเมนต์ไทย แขวงบางซื่อ เขตบางซื่อ กรุงเทพฯ 10800',         contact:{ name:'ฝ่ายขาย B2B',      phone:'02-586-3333',  email:'b2b@scg.co.th',          role:'B2B Sales' },     categories:['งานโครงสร้าง','งานหลังคา'],       credit:'60 วัน', rfqs:42, joined:'2020-01-10', status:'Active' },
  { code:'SUP-00004', name:'TOA Distribution',          kind:'default',tax:'0105519006789', address:'31/5 ม.3 ถ.บางนา-ตราด กม.23 ต.บางเสาธง อ.บางเสาธง จ.สมุทรปราการ', contact:{ name:'คุณนิด ศรีสว่าง',  phone:'02-294-0999',  email:'order@toagroup.com',    role:'Account Manager' },categories:['งานสี'],                          credit:'30 วัน', rfqs:18, joined:'2021-04-22', status:'Active' },
  { code:'SUP-00005', name:'COTTO Wholesale',           kind:'default',tax:'0107546001122', address:'1 ถ.ปูนซิเมนต์ไทย แขวงบางซื่อ เขตบางซื่อ กรุงเทพฯ 10800',         contact:{ name:'คุณปูน วงศ์ศรี',   phone:'02-555-2000',  email:'wholesale@cotto.com',   role:'Wholesale Mgr' },  categories:['งานสุขภัณฑ์'],                    credit:'45 วัน', rfqs:12, joined:'2022-09-14', status:'Active' },
  { code:'SUP-00006', name:'CPAC Roof',                 kind:'sc',     tax:'0107547007891', address:'1 ถ.ปูนซิเมนต์ไทย แขวงบางซื่อ เขตบางซื่อ กรุงเทพฯ 10800',         contact:{ name:'คุณบอย ดวงดี',    phone:'02-586-2222',  email:'roof@cpac.co.th',       role:'Sales' },         categories:['งานหลังคา'],                      credit:'45 วัน', rfqs:8,  joined:'2022-11-30', status:'Active' },
  { code:'SUP-00007', name:'Q-CON Direct',              kind:'default',tax:'0105536012023', address:'25/9 ม.7 ต.หนองปลาหมอ อ.หนองแค จ.สระบุรี 18140',                   contact:{ name:'คุณตั้ม รุ่งโรจน์', phone:'02-274-1234',  email:'direct@qcon.co.th',     role:'Sales Direct' },   categories:['งานก่ออิฐ-ฉาบปูน'],               credit:'30 วัน', rfqs:6,  joined:'2023-02-08', status:'Active' },
  { code:'SUP-00008', name:'ไทยเซรามิค',                kind:'default',tax:'0105509004456', address:'52 ม.3 ถ.พุทธมณฑลสาย 4 ต.กระทุ่มล้ม อ.สามพราน จ.นครปฐม',          contact:{ name:'คุณป้อม จันทร์เพ็ญ',phone:'02-318-7777',  email:'sales@thaicera.com',    role:'Sales Manager' }, categories:['งานพื้น-ผนัง'],                   credit:'30 วัน', rfqs:14, joined:'2021-06-18', status:'Active' },
  { code:'SUP-00009', name:'BCC Electric',              kind:'default',tax:'0105525003344', address:'18/24 ถ.รัชดาภิเษก แขวงดินแดง เขตดินแดง กรุงเทพฯ 10400',         contact:{ name:'คุณตา ไฟฟ้า',     phone:'02-291-8888',  email:'b2b@bcc.co.th',         role:'B2B' },           categories:['งานระบบไฟฟ้า'],                   credit:'30 วัน', rfqs:10, joined:'2022-04-05', status:'Active' },
  { code:'SUP-00010', name:'หจก. กระเบื้องช่าง',         kind:'default',tax:'0103562001234', address:'88/12 ซ.ลาดพร้าว 71 แขวงสะพานสอง เขตวังทองหลาง กรุงเทพฯ',         contact:{ name:'ช่างเอก เก่งกาจ',  phone:'081-789-4561', email:'-',                     role:'หัวหน้าทีม' },     categories:['งานพื้น-ผนัง','งานก่ออิฐ-ฉาบปูน'],credit:'งวด',   rfqs:14, joined:'2023-05-20', status:'Active' },
  { code:'SUP-00011', name:'หจก. ช่างไทย',              kind:'default',tax:'0103548007890', address:'25 ซ.รามคำแหง 24 แขวงหัวหมาก เขตบางกะปิ กรุงเทพฯ',                 contact:{ name:'ช่างแดง สู้สู้',    phone:'081-456-7890', email:'-',                     role:'หัวหน้าทีม' },     categories:['งานก่ออิฐ-ฉาบปูน','งานสี'],       credit:'งวด',   rfqs:22, joined:'2022-07-12', status:'Active' },
  { code:'SUP-00012', name:'พี.ที. คอนสตรัคชั่น',       kind:'default',tax:'0103554003322', address:'45 ม.5 ต.ลำลูกกา อ.ลำลูกกา จ.ปทุมธานี 12150',                      contact:{ name:'คุณพี ก่อสร้าง',   phone:'081-222-3333', email:'pt.con@gmail.com',      role:'ผู้รับเหมา' },     categories:['งานโครงสร้าง'],                   credit:'งวด',   rfqs:18, joined:'2023-01-04', status:'Active' },
  { code:'SUP-00013', name:'บจก. วัสดุภัณฑ์ปลอม',        kind:'default',tax:'0105560000000', address:'ที่อยู่ไม่ชัดเจน',                                                  contact:{ name:'ผู้ติดต่อ',         phone:'-',             email:'-',                      role:'-' },              categories:['งานโครงสร้าง'],                   credit:'-',     rfqs:1,  joined:'2023-09-12', status:'Blacklist' },
];

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
  const matCats = (window.MATERIAL_CATEGORIES || []).map(c => c.name);
  const subCats = (window.SUBCONTRACT_CATEGORIES || []).map(c => c.name);
  // Merge & dedupe, preserving order
  const seen = new Set();
  const merged = [];
  [...matCats, ...subCats].forEach(c => {
    if (!seen.has(c)) { seen.add(c); merged.push(c); }
  });
  return merged.length ? merged : ['งานโครงสร้าง','งานก่ออิฐ-ฉาบปูน','งานหลังคา','งานพื้น-ผนัง','งานสุขภัณฑ์','งานสี','งานระบบไฟฟ้า'];
}

function ScreenSettingsSuppliers({ go }) {
  const [q, setQ] = useStateSP('');
  const [filter, setFilter] = useStateSP('ทั้งหมด');
  const [addOpen, setAddOpen] = useStateSP(false);
  const [expanded, setExpanded] = useStateSP(null);

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
  const [form, setForm] = useStateSP({
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

window.ScreenSettingsSuppliers = ScreenSettingsSuppliers;
