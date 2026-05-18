/* global React, Icons, Chip, Av, settingsInputStyle, SettingsField, SettingsModal, SettingsStatStrip, SettingsSearchBox, StatusPill, StatusToggle */
/*
  Settings → Users (ผู้ใช้งาน)
  - Auto-run code EMP-NNNNN
  - Name, ตำแหน่ง, เบอร์โทร
  - Login: Username / Password (masked with reveal)
*/

const { useState: useStateUR } = React;

const USER_DATA = [
  { code:'EMP-00001', name:'นวพร ศรีวัฒน์',     role:'Procurement Officer',  phone:'081-234-5678', username:'navaporn',  password:'Sup#2024@nav',   status:'Active',     lastLogin:'17 พ.ค. 14:22', kind:'np' },
  { code:'EMP-00002', name:'ภัทรพล ทองดี',      role:'Procurement Manager',  phone:'089-111-2233', username:'pattarapol', password:'P@tt2024!nav',   status:'Active',     lastLogin:'17 พ.ค. 11:08', kind:'default' },
  { code:'EMP-00003', name:'สุดารัตน์ ใจดี',      role:'Site Engineer',        phone:'085-555-7788', username:'sudarat',   password:'Sud@rat2024!',  status:'Active',     lastLogin:'17 พ.ค. 09:45', kind:'sc' },
  { code:'EMP-00004', name:'กิตติพงศ์ วงศ์ทอง',  role:'Project Manager',      phone:'081-888-4422', username:'kittipong',  password:'K!ttipong2024',  status:'Active',     lastLogin:'16 พ.ค. 17:32', kind:'aw' },
  { code:'EMP-00005', name:'จิราวรรณ พรหมา',     role:'Accountant',           phone:'087-654-3210', username:'jirawan',    password:'J!rawan2024@',   status:'Active',     lastLogin:'17 พ.ค. 13:50', kind:'rr' },
  { code:'EMP-00006', name:'ธนากร เจริญสุข',    role:'Admin',                phone:'088-222-1199', username:'thanakorn',  password:'Th@n@2024nav',   status:'Active',     lastLogin:'17 พ.ค. 08:15', kind:'default' },
  { code:'EMP-00007', name:'อรอุมา สุวรรณ',     role:'IT Admin',             phone:'081-456-7890', username:'orn-uma',    password:'IT@dmin2024!',   status:'Active',     lastLogin:'17 พ.ค. 14:55', kind:'default' },
  { code:'EMP-00008', name:'มานพ ก่อสร้าง',     role:'Site Foreman',         phone:'089-333-4455', username:'manop',      password:'M@nop2024sit',   status:'Active',     lastLogin:'16 พ.ค. 16:08', kind:'default' },
  { code:'EMP-00009', name:'รัชนีกร ทิพย์',       role:'Procurement Officer',  phone:'086-777-8899', username:'ratchanee',  password:'R@tch@nee24!',   status:'Active',     lastLogin:'15 พ.ค. 18:22', kind:'np' },
  { code:'EMP-00010', name:'วิทยา ก้าวหน้า',     role:'Site Engineer',        phone:'080-444-3322', username:'witthaya',   password:'W!tthaya24!@',   status:'Non-Active', lastLogin:'12 ก.พ. 11:08', kind:'default' },
];

const ROLE_OPTIONS = [
  'Procurement Officer',
  'Procurement Manager',
  'Site Engineer',
  'Project Manager',
  'Site Foreman',
  'Accountant',
  'Admin',
  'IT Admin',
];

function ScreenSettingsUsers({ go }) {
  const [q, setQ]             = useStateUR('');
  const [filter, setFilter]   = useStateUR('ทั้งหมด');
  const [roleFilter, setRole] = useStateUR('ทั้งหมด');
  const [reveal, setReveal]   = useStateUR(new Set()); // codes whose pw is visible
  const [addOpen, setAddOpen] = useStateUR(false);

  const togglePw = (code) => {
    const next = new Set(reveal);
    next.has(code) ? next.delete(code) : next.add(code);
    setReveal(next);
  };

  const filtered = USER_DATA.filter(u => {
    if (filter !== 'ทั้งหมด' && u.status !== filter) return false;
    if (roleFilter !== 'ทั้งหมด' && u.role !== roleFilter) return false;
    if (q) {
      const v = q.toLowerCase();
      if (!(u.name.includes(q) || u.code.toLowerCase().includes(v) || u.username.toLowerCase().includes(v) || u.role.toLowerCase().includes(v))) return false;
    }
    return true;
  });

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Settings · Master Data</div>
          <h1 className="h-display">ผู้ใช้งาน (Users)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:620 }}>
            ทะเบียนพนักงานและสิทธิ์เข้าใช้ระบบ — Auto-Run รหัส <span className="font-mono" style={{ color:'var(--ink-2)' }}>EMP-NNNNN</span>
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn">{Icons.download} Export</button>
          <button className="btn primary" onClick={() => setAddOpen(true)}>{Icons.plus} เพิ่มผู้ใช้งาน</button>
        </div>
      </div>

      <SettingsStatStrip stats={[
        {
          label:'ผู้ใช้งานทั้งหมด',
          value: USER_DATA.length,
          sub: <span style={{ display:'inline-flex', gap:14, fontSize:12 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--moss)' }} />
              <span style={{ color:'var(--ink-3)' }}>Active</span>
              <strong style={{ color:'var(--ink)' }}>{USER_DATA.filter(u=>u.status==='Active').length}</strong>
            </span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--ink-4)' }} />
              <span style={{ color:'var(--ink-3)' }}>Non-Active</span>
              <strong style={{ color:'var(--ink)' }}>{USER_DATA.filter(u=>u.status==='Non-Active').length}</strong>
            </span>
          </span>,
        },
      ]} />

      {/* Filters */}
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
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
        <span style={{ width:1, height:20, background:'var(--rule)', margin:'0 4px' }} />
        <select value={roleFilter} onChange={e => setRole(e.target.value)} style={{
          ...settingsInputStyle, width:'auto', padding:'5px 28px 5px 12px', fontSize:12.5,
        }}>
          <option value="ทั้งหมด">ทุกตำแหน่ง</option>
          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหา ชื่อ / รหัส / username…" />
          <span style={{ fontSize:12, color:'var(--ink-3)' }}>
            แสดง <strong style={{ color:'var(--ink)' }}>{filtered.length}</strong> รายการ
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:'10%' }}>รหัส</th>
              <th style={{ width:'24%' }}>ชื่อ-นามสกุล</th>
              <th>ตำแหน่ง</th>
              <th>เบอร์โทร</th>
              <th>Username</th>
              <th>Password</th>
              <th>สถานะ</th>
              <th style={{ width:48 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const shown = reveal.has(u.code);
              return (
                <tr key={u.code}>
                  <td className="font-mono" style={{ fontSize:11.5, color:'var(--ink-2)', fontWeight:500 }}>{u.code}</td>
                  <td>
                    <div style={{ display:'inline-flex', gap:10, alignItems:'center' }}>
                      <Av initials={u.name.slice(0,1)} kind={u.kind} />
                      <div>
                        <div style={{ fontWeight:500 }}>{u.name}</div>
                        <div style={{ fontSize:11, color:'var(--ink-4)', marginTop:2 }}>เข้าระบบล่าสุด · {u.lastLogin}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize:12.5, color:'var(--ink-2)' }}>{u.role}</td>
                  <td className="font-mono" style={{ fontSize:12, color:'var(--ink-2)' }}>{u.phone}</td>
                  <td className="font-mono" style={{ fontSize:12, color:'var(--ink-2)' }}>{u.username}</td>
                  <td>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                      <span className="font-mono" style={{
                        fontSize:12, color: shown ? 'var(--ink-2)' : 'var(--ink-3)',
                        letterSpacing: shown ? 0 : 2,
                      }}>
                        {shown ? u.password : '••••••••••'}
                      </span>
                      <button
                        className="btn ghost sm"
                        onClick={() => togglePw(u.code)}
                        style={{ padding:'2px 6px', color:'var(--ink-3)', fontSize:11 }}
                        title={shown ? 'ซ่อนรหัส' : 'แสดงรหัส'}
                      >
                        {shown ? '🔒' : '👁'}
                      </button>
                    </span>
                  </td>
                  <td><StatusPill status={u.status} /></td>
                  <td style={{ textAlign:'right' }}>
                    <button className="btn ghost sm" style={{ padding:'2px 6px', color:'var(--ink-3)' }}>{Icons.edit}</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding:48, textAlign:'center', fontSize:13, color:'var(--ink-3)' }}>ไม่พบผู้ใช้งานที่ตรงกับเงื่อนไข</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {addOpen && <AddUserModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddUserModal({ onClose }) {
  const [form, setForm] = useStateUR({
    name:'', role: ROLE_OPTIONS[0], phone:'',
    username:'', password:'', passwordConfirm:'',
    status:'Active',
  });
  const [showPw, setShowPw] = useStateUR(false);
  const set = (k,v) => setForm({ ...form, [k]:v });

  const nextCode = `EMP-${String(USER_DATA.length + 1).padStart(5,'0')}`;

  // Password strength heuristics
  const pw = form.password;
  const checks = {
    length:    pw.length >= 8,
    upper:     /[A-Z]/.test(pw),
    lower:     /[a-z]/.test(pw),
    number:    /[0-9]/.test(pw),
    special:   /[^A-Za-z0-9]/.test(pw),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const strengthLabel = score <= 1 ? 'อ่อน' : score <= 3 ? 'พอใช้' : score <= 4 ? 'ดี' : 'แข็งแกร่ง';
  const strengthColor = score <= 1 ? 'var(--clay)' : score <= 3 ? 'var(--ochre)' : 'var(--moss)';

  const match = pw.length > 0 && pw === form.passwordConfirm;

  return (
    <SettingsModal eyebrow="เพิ่มผู้ใช้งานใหม่" title="ข้อมูลผู้ใช้งาน" onClose={onClose} width={680}>
      <div style={{
        padding:'14px 16px', background:'var(--surface-2)',
        border:'1px solid var(--rule)', borderRadius:6, marginBottom:24,
        display:'flex', alignItems:'center', gap:16,
      }}>
        <div style={{ flex:1 }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>รหัสพนักงาน (auto-generate)</div>
          <div className="font-mono" style={{ fontSize:18, color:'var(--teal)' }}>{nextCode}</div>
        </div>
        <div style={{ fontSize:11, color:'var(--ink-3)', textAlign:'right' }}>
          รูปแบบ <strong>EMP-NNNNN</strong>
        </div>
      </div>

      {/* Section: identity */}
      <div className="eyebrow" style={{ marginBottom:12 }}>ข้อมูลพนักงาน</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:24 }}>
        <SettingsField label="ชื่อ-นามสกุล" required>
          <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="เช่น นวพร ศรีวัฒน์" style={settingsInputStyle} />
        </SettingsField>
        <SettingsField label="ตำแหน่ง" required>
          <select value={form.role} onChange={e=>set('role', e.target.value)} style={settingsInputStyle}>
            {ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}
          </select>
        </SettingsField>
        <SettingsField label="เบอร์โทร" required>
          <input value={form.phone} onChange={e=>set('phone', e.target.value)} placeholder="08X-XXX-XXXX" style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }} />
        </SettingsField>
        <SettingsField label="สถานะ">
          <StatusToggle options={['Active','Non-Active']} value={form.status} onChange={v => set('status', v)} />
        </SettingsField>
      </div>

      {/* Section: login */}
      <div className="eyebrow" style={{ marginBottom:12 }}>ข้อมูลการเข้าใช้ระบบ (Login)</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:14 }}>
        <SettingsField label="Username" required hint="ใช้ตัวอักษรพิมพ์เล็ก ตัวเลข จุด ขีดล่าง · 4–20 ตัวอักษร">
          <input
            value={form.username}
            onChange={e=>set('username', e.target.value.toLowerCase().replace(/[^a-z0-9._]/g,'').slice(0,20))}
            placeholder="เช่น navaporn"
            style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)' }}
          />
        </SettingsField>

        <SettingsField label="Password" required hint="อย่างน้อย 8 ตัวอักษร ผสมตัวเลข พิมพ์ใหญ่ พิมพ์เล็ก และอักขระพิเศษ">
          <div style={{ position:'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              value={form.password}
              onChange={e=>set('password', e.target.value)}
              placeholder="ตั้งรหัสผ่าน"
              style={{ ...settingsInputStyle, fontFamily:'var(--font-mono)', paddingRight:48 }}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              style={{
                position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                background:'transparent', border:0, padding:'4px 6px',
                cursor:'pointer', fontSize:14,
              }}
            >{showPw ? '🔒' : '👁'}</button>
          </div>

          {/* Strength bar */}
          {pw.length > 0 && (
            <div style={{ marginTop:8 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:11.5, color:'var(--ink-3)' }}>ความแข็งแกร่ง</span>
                <span style={{ fontSize:11.5, color:strengthColor, fontWeight:500 }}>{strengthLabel}</span>
              </div>
              <div style={{ display:'flex', gap:4 }}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{
                    flex:1, height:4, borderRadius:2,
                    background: i <= score ? strengthColor : 'var(--rule)',
                    transition:'background 0.15s',
                  }} />
                ))}
              </div>
              <div style={{ display:'flex', gap:14, marginTop:8, flexWrap:'wrap', fontSize:10.5, color:'var(--ink-3)' }}>
                <CheckItem ok={checks.length}  label="≥ 8 ตัวอักษร" />
                <CheckItem ok={checks.upper}   label="A–Z" />
                <CheckItem ok={checks.lower}   label="a–z" />
                <CheckItem ok={checks.number}  label="0–9" />
                <CheckItem ok={checks.special} label="อักขระพิเศษ" />
              </div>
            </div>
          )}
        </SettingsField>

        <SettingsField label="ยืนยัน Password" required>
          <div style={{ position:'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              value={form.passwordConfirm}
              onChange={e=>set('passwordConfirm', e.target.value)}
              placeholder="พิมพ์รหัสผ่านอีกครั้ง"
              style={{
                ...settingsInputStyle, fontFamily:'var(--font-mono)', paddingRight:48,
                borderColor: form.passwordConfirm.length > 0
                  ? (match ? 'var(--moss)' : 'var(--clay)')
                  : 'var(--rule-2)',
              }}
            />
            {form.passwordConfirm.length > 0 && (
              <span style={{
                position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
                fontSize:11, color: match ? 'var(--moss)' : 'var(--clay)', fontWeight:500,
              }}>{match ? '✓ ตรงกัน' : '✗ ไม่ตรงกัน'}</span>
            )}
          </div>
        </SettingsField>
      </div>
    </SettingsModal>
  );
}

function CheckItem({ ok, label }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      color: ok ? 'var(--moss)' : 'var(--ink-4)',
    }}>
      <span>{ok ? '✓' : '○'}</span>
      {label}
    </span>
  );
}

window.ScreenSettingsUsers = ScreenSettingsUsers;
