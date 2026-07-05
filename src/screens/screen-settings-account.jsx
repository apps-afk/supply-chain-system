'use client';
import React, { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';

const ROLE_LABEL = {
  admin:       'ผู้ดูแลระบบ',
  hr_manager:  'ผู้จัดการ HR',
  procurement: 'ฝ่ายจัดซื้อ',
  accountant:  'ฝ่ายบัญชี',
  manager:     'ผู้จัดการ',
  user:        'ผู้ใช้งานทั่วไป',
};

export function ScreenSettingsAccount() {
  const { data: session } = useSession();

  /* Profile state */
  const [profile, setProfile] = useState(null);   // server data
  const [form,    setForm]    = useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg,    setProfileMsg]    = useState({ msg: '', tone: '' });

  /* Password state — changing a password ALWAYS requires the current one.
     There is no "reset without old password while logged in" path: a stolen
     session cookie must not be enough to lock the real owner out. Users who
     truly forgot use the login-page forgot-password flow (admin-actioned). */
  const [oldPwd,   setOldPwd]   = useState('');
  const [newPwd,   setNewPwd]   = useState('');
  const [newPwd2,  setNewPwd2]  = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg,    setPwdMsg]    = useState({ msg: '', tone: '' });

  async function loadProfile() {
    setLoading(true); setLoadErr('');
    try {
      const res = await fetch('/api/account/profile');
      const data = await res.json();
      if (res.ok && data.profile) {
        setProfile(data.profile);
        setForm({
          name:  data.profile.name  || '',
          email: data.profile.email || '',
          phone: data.profile.phone || '',
        });
      } else {
        // Previously: silent failure left the screen stuck on "loading…".
        // Surface the real reason so the user can react (e.g., session expired).
        setLoadErr(data?.error || `โหลดข้อมูลไม่สำเร็จ (HTTP ${res.status})`);
      }
    } catch {
      setLoadErr('เครือข่ายขัดข้อง');
    }
    setLoading(false);
  }
  useEffect(() => { loadProfile(); }, []);

  const dirty = profile && (
    form.name  !== (profile.name  || '') ||
    form.email !== (profile.email || '') ||
    form.phone !== (profile.phone || '')
  );

  async function saveProfile(e) {
    e.preventDefault();
    setProfileMsg({ msg: '', tone: '' });
    if (!form.name.trim()) return setProfileMsg({ msg: 'ชื่อไม่ควรว่าง', tone: 'err' });
    setSavingProfile(true);
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileMsg({ msg: data.error || 'บันทึกไม่สำเร็จ', tone: 'err' });
      } else if (data.emailChanged) {
        setProfileMsg({ msg: 'เปลี่ยนอีเมลแล้ว — กำลังพาออกจากระบบเพื่อเข้าใหม่...', tone: 'ok' });
        setTimeout(() => signOut({ callbackUrl: '/login' }), 1800);
      } else {
        setProfileMsg({ msg: 'บันทึกสำเร็จ', tone: 'ok' });
        await loadProfile();
        setTimeout(() => setProfileMsg({ msg: '', tone: '' }), 2500);
      }
    } catch {
      setProfileMsg({ msg: 'เครือข่ายขัดข้อง', tone: 'err' });
    }
    setSavingProfile(false);
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwdMsg({ msg: '', tone: '' });
    if (newPwd.length < 8) return setPwdMsg({ msg: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร', tone: 'err' });
    if (newPwd !== newPwd2) return setPwdMsg({ msg: 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน', tone: 'err' });

    setSavingPwd(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwdMsg({ msg: data.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ', tone: 'err' });
      } else {
        setPwdMsg({ msg: 'เปลี่ยนรหัสผ่านสำเร็จ', tone: 'ok' });
        setOldPwd(''); setNewPwd(''); setNewPwd2('');
      }
    } catch {
      setPwdMsg({ msg: 'เครือข่ายขัดข้อง', tone: 'err' });
    }
    setSavingPwd(false);
  }

  if (loading) {
    return (
      <div className="page">
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="page">
        <div style={{
          padding: '20px 24px', margin: 40,
          background: '#FDE8E4', color: '#8B2A1A',
          border: '1px solid #F5C0B4', borderRadius: 6, fontSize: 13,
        }}>
          {loadErr || 'ไม่พบข้อมูลบัญชี — กรุณาลองเข้าสู่ระบบใหม่'}
        </div>
      </div>
    );
  }

  const initials = (profile.name || profile.email || 'U').slice(0, 2).toUpperCase();
  const roleText = ROLE_LABEL[profile.role] || profile.role || '—';

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">ตั้งค่า</div>
          <h1 className="h-display">บัญชีของฉัน</h1>
        </div>
      </div>

      {/* Profile */}
      <section style={{ marginTop: 36 }}>
        <h2 className="h-section">ข้อมูลส่วนตัว</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4, marginBottom: 16 }}>
          แก้ไขชื่อ, อีเมล และเบอร์โทรของคุณ การเปลี่ยนอีเมลจะต้องเข้าสู่ระบบใหม่
        </p>

        <form onSubmit={saveProfile} className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--teal-soft)', color: 'var(--teal)',
              display: 'grid', placeItems: 'center',
              fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 600,
              flexShrink: 0,
            }}>{initials}</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {profileMsg.msg && <StatusBox tone={profileMsg.tone}>{profileMsg.msg}</StatusBox>}

              <Field label="ชื่อ-นามสกุล">
                <input
                  type="text" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={inputStyle} required
                />
              </Field>

              <Field
                label="อีเมล"
                hint={profile.isBuiltin
                  ? 'บัญชีระบบ — ไม่สามารถเปลี่ยนอีเมลได้'
                  : 'เปลี่ยนอีเมลแล้วต้องเข้าสู่ระบบใหม่ ต้องเป็น @initialestate.com'}
              >
                <input
                  type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  style={{ ...inputStyle, ...(profile.isBuiltin ? readOnlyStyle : {}) }}
                  readOnly={profile.isBuiltin}
                  required
                />
              </Field>

              <Field label="เบอร์โทรศัพท์" hint="ตัวอย่าง 0812345678 หรือ +66812345678">
                <input
                  type="tel" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  style={inputStyle}
                  placeholder="0812345678"
                />
              </Field>

              <ReadOnlyRow label="บทบาท" value={roleText} hint="ติดต่อผู้ดูแลระบบเพื่อเปลี่ยน" />
              <ReadOnlyRow label="รหัสผู้ใช้" value={profile.id} mono />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                {dirty && (
                  <button
                    type="button" className="btn"
                    onClick={() => setForm({
                      name:  profile.name  || '',
                      email: profile.email || '',
                      phone: profile.phone || '',
                    })}
                  >ยกเลิก</button>
                )}
                <button
                  type="submit" className="btn primary"
                  disabled={!dirty || savingProfile}
                >{savingProfile ? 'กำลังบันทึก…' : 'บันทึก'}</button>
              </div>
            </div>
          </div>
        </form>
      </section>

      {/* Password */}
      <section style={{ marginTop: 48 }}>
        <h2 className="h-section">เปลี่ยนรหัสผ่าน</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4, marginBottom: 16 }}>
          ต้องยืนยันรหัสผ่านปัจจุบันก่อนทุกครั้ง · แนะนำอย่างน้อย 8 ตัวอักษร ผสมตัวอักษร ตัวเลข และสัญลักษณ์
          <br />ลืมรหัสผ่านปัจจุบัน? ออกจากระบบแล้วใช้ "ลืมรหัสผ่าน" ที่หน้าเข้าสู่ระบบ (ผู้ดูแลจะรีเซ็ตให้)
        </p>

        <form onSubmit={savePassword} className="card" style={{ padding: 28, maxWidth: 520 }}>
          {pwdMsg.msg && <StatusBox tone={pwdMsg.tone}>{pwdMsg.msg}</StatusBox>}

          <Field label="รหัสผ่านปัจจุบัน">
            <input
              type="password" value={oldPwd}
              onChange={e => setOldPwd(e.target.value)}
              style={inputStyle}
              required
              autoComplete="current-password"
            />
          </Field>

          <Field label="รหัสผ่านใหม่" hint="อย่างน้อย 8 ตัวอักษร">
            <input
              type="password" value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              style={inputStyle} required minLength={8}
              autoComplete="new-password"
            />
          </Field>

          <Field label="ยืนยันรหัสผ่านใหม่">
            <input
              type="password" value={newPwd2}
              onChange={e => setNewPwd2(e.target.value)}
              style={inputStyle} required
              autoComplete="new-password"
            />
          </Field>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              type="submit" className="btn primary"
              disabled={savingPwd}
            >
              {savingPwd ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
            </button>
          </div>
        </form>
      </section>

      {/* Sign out */}
      <section style={{ marginTop: 56, paddingTop: 24, borderTop: '1px solid var(--rule)' }}>
        <h2 className="h-section" style={{ marginBottom: 8 }}>ออกจากระบบ</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 16 }}>
          ออกจากระบบและกลับไปยังหน้าเข้าสู่ระบบ
        </p>
        <button className="btn" onClick={() => signOut({ callbackUrl: '/login' })}>
          ออกจากระบบ
        </button>
      </section>
    </div>
  );
}

/* ===== UI primitives ===== */

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 500,
        color: 'var(--ink-2)', marginBottom: 6, letterSpacing: '0.02em',
      }}>{label}</label>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 5 }}>{hint}</div>
      )}
    </div>
  );
}

function ReadOnlyRow({ label, value, mono, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 12, fontWeight: 500, color: 'var(--ink-2)',
        marginBottom: 6, letterSpacing: '0.02em',
      }}>{label}</div>
      <div style={{
        padding: '10px 12px',
        border: '1px solid var(--rule)',
        background: 'var(--surface-2)',
        borderRadius: 6, fontSize: 14,
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        color: 'var(--ink-2)',
      }}>{value}</div>
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 5 }}>{hint}</div>
      )}
    </div>
  );
}

function StatusBox({ tone, children }) {
  const ok = tone === 'ok';
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 6,
      marginBottom: 14, fontSize: 13,
      background: ok ? '#DEE7E3' : '#FDE8E4',
      color:      ok ? '#1F4D40' : '#8B2A1A',
      border:     `1px solid ${ok ? '#B3CCC4' : '#F5C0B4'}`,
    }}>{children}</div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 12px',
  border: '1px solid var(--rule-2)', borderRadius: 6,
  fontSize: 14, fontFamily: 'var(--font-sans)',
  outline: 'none', boxSizing: 'border-box',
  background: 'var(--surface)',
  color: 'var(--ink)',
};

const readOnlyStyle = {
  background: 'var(--surface-2)',
  color: 'var(--ink-2)',
  cursor: 'not-allowed',
};
