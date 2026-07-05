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
            <PasswordInput value={oldPwd} onChange={e => setOldPwd(e.target.value)}
              autoComplete="current-password" />
          </Field>

          <Field label="รหัสผ่านใหม่" hint="อย่างน้อย 8 ตัวอักษร">
            <PasswordInput value={newPwd} onChange={e => setNewPwd(e.target.value)}
              minLength={8} autoComplete="new-password" />
          </Field>

          <Field label="ยืนยันรหัสผ่านใหม่">
            <PasswordInput value={newPwd2} onChange={e => setNewPwd2(e.target.value)}
              autoComplete="new-password" />
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

      {/* Two-factor authentication */}
      <section style={{ marginTop: 48 }}>
        <h2 className="h-section">ยืนยันตัวตนสองขั้น (2FA)</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4, marginBottom: 16 }}>
          เพิ่มรหัส 6 หลักจากแอป Authenticator (Google/Microsoft Authenticator, 1Password ฯลฯ)
          ทุกครั้งที่เข้าสู่ระบบด้วยรหัสผ่าน — บัญชีที่เข้าผ่าน Google ใช้ 2FA ของ Google อยู่แล้ว
        </p>
        <TwoFactorSection />
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

/* ===== Password input with show/hide toggle ===== */

function PasswordInput({ value, onChange, autoComplete, minLength }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value} onChange={onChange}
        style={{ ...inputStyle, paddingRight: 44 }}
        required minLength={minLength} autoComplete={autoComplete}
      />
      <button
        type="button" onClick={() => setShow(s => !s)} tabIndex={-1}
        aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        title={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        style={{
          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 6,
          display: 'grid', placeItems: 'center', color: 'var(--ink-4)',
        }}
      >
        {show ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

/* ===== 2FA enrollment ===== */

function TwoFactorSection() {
  const [status, setStatus]   = useState(null);   // {enabled, required}
  const [enroll, setEnroll]   = useState(null);   // {qr, secret, otpauth}
  const [code, setCode]       = useState('');
  const [busy, setBusy]       = useState(false);
  const [msg, setMsg]         = useState({ msg: '', tone: '' });

  async function load() {
    try {
      const r = await fetch('/api/auth/2fa');
      if (r.ok) setStatus(await r.json());
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function post(payload) {
    setBusy(true); setMsg({ msg: '', tone: '' });
    try {
      const r = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      setBusy(false);
      if (!r.ok) { setMsg({ msg: d.error || 'ไม่สำเร็จ', tone: 'err' }); return null; }
      return d;
    } catch {
      setBusy(false);
      setMsg({ msg: 'เครือข่ายขัดข้อง', tone: 'err' });
      return null;
    }
  }

  async function start() {
    const d = await post({ action: 'start' });
    if (d) { setEnroll(d); setCode(''); }
  }

  async function verify(e) {
    e.preventDefault();
    const d = await post({ action: 'verify', code });
    if (d) {
      setEnroll(null); setCode('');
      setMsg({ msg: '✓ เปิดใช้ 2FA เรียบร้อย — ครั้งต่อไปที่เข้าสู่ระบบจะถามรหัสจากแอป', tone: 'ok' });
      load();
    }
  }

  async function disable(e) {
    e.preventDefault();
    if (!confirm('ปิดการยืนยันตัวตนสองขั้น?')) return;
    const d = await post({ action: 'disable', code });
    if (d) {
      setCode('');
      setMsg({ msg: 'ปิด 2FA แล้ว', tone: 'ok' });
      load();
    }
  }

  if (!status) return <div className="card" style={{ padding: 24, maxWidth: 520, fontSize: 13, color: 'var(--ink-3)' }}>กำลังโหลด…</div>;

  return (
    <div className="card" style={{ padding: 28, maxWidth: 520 }}>
      {msg.msg && <StatusBox tone={msg.tone}>{msg.msg}</StatusBox>}

      {status.required && !status.enabled && (
        <div style={{ background: '#F0E4C5', border: '1px solid #E6D4A8', color: '#6B5121', borderRadius: 6, padding: '10px 14px', fontSize: 12.5, marginBottom: 16, lineHeight: 1.55 }}>
          ⚠ นโยบายของระบบบังคับใช้ 2FA สำหรับผู้ดูแลระบบ — กรุณาตั้งค่าด้านล่าง
        </div>
      )}

      {status.enabled ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--moss, #4a7c59)' }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>เปิดใช้งานอยู่</span>
          </div>
          <form onSubmit={disable}>
            <Field label="ปิด 2FA — ยืนยันด้วยรหัสจากแอปก่อน">
              <input
                type="text" inputMode="numeric" maxLength={6} value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000" style={{ ...inputStyle, width: 160, fontFamily: 'var(--font-mono)', letterSpacing: '0.3em', textAlign: 'center' }}
              />
            </Field>
            <button type="submit" className="btn" disabled={busy || code.length !== 6} style={{ color: 'var(--clay)' }}>
              ปิดการใช้งาน 2FA
            </button>
          </form>
        </>
      ) : enroll ? (
        <>
          <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 12 }}>1) สแกน QR ด้วยแอป Authenticator</div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enroll.qr} alt="2FA QR" width={180} height={180} style={{ borderRadius: 8, border: '1px solid var(--rule)' }} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>หรือกรอก secret เอง:</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, background: 'var(--surface-2)', padding: '8px 10px', borderRadius: 6, wordBreak: 'break-all', userSelect: 'all' }}>
                {enroll.secret}
              </div>
            </div>
          </div>
          <form onSubmit={verify}>
            <Field label="2) กรอกรหัส 6 หลักจากแอปเพื่อยืนยัน">
              <input
                type="text" inputMode="numeric" maxLength={6} value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000" autoFocus
                style={{ ...inputStyle, width: 160, fontFamily: 'var(--font-mono)', letterSpacing: '0.3em', textAlign: 'center' }}
              />
            </Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn primary" disabled={busy || code.length !== 6}>
                {busy ? 'กำลังตรวจ…' : 'ยืนยันและเปิดใช้'}
              </button>
              <button type="button" className="btn" onClick={() => { setEnroll(null); setCode(''); }}>ยกเลิก</button>
            </div>
          </form>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--rule-2)' }} />
            <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>ยังไม่ได้เปิดใช้</span>
          </div>
          <button className="btn primary" onClick={start} disabled={busy}>
            {busy ? 'กำลังสร้าง…' : '🔐 เปิดใช้ 2FA'}
          </button>
        </>
      )}
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
