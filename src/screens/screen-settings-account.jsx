'use client';
import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';

export function ScreenSettingsAccount() {
  const { data: session } = useSession();
  const user = session?.user;

  const [oldPwd,  setOldPwd]  = useState('');
  const [newPwd,  setNewPwd]  = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [status,  setStatus]  = useState({ msg: '', tone: '' });
  const [busy,    setBusy]    = useState(false);

  async function handleChangePassword(e) {
    e.preventDefault();
    setStatus({ msg: '', tone: '' });
    if (newPwd.length < 8) {
      return setStatus({ msg: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร', tone: 'err' });
    }
    if (newPwd !== newPwd2) {
      return setStatus({ msg: 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน', tone: 'err' });
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ msg: data.error || 'เกิดข้อผิดพลาด', tone: 'err' });
      } else {
        setStatus({ msg: 'เปลี่ยนรหัสผ่านสำเร็จ', tone: 'ok' });
        setOldPwd(''); setNewPwd(''); setNewPwd2('');
      }
    } catch {
      setStatus({ msg: 'เครือข่ายขัดข้อง', tone: 'err' });
    }
    setBusy(false);
  }

  const initials = (user?.name || user?.email || 'U').slice(0, 2).toUpperCase();
  const roleLabel = user?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งานทั่วไป';

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">ตั้งค่า</div>
          <h1 className="h-display">บัญชีของฉัน</h1>
        </div>
      </div>

      {/* Profile */}
      <section style={{ marginTop: 40 }}>
        <h2 className="h-section">ข้อมูลส่วนตัว</h2>
        <div className="card" style={{ marginTop: 16, padding: '24px 28px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--teal-soft)', color: 'var(--teal)',
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600,
          }}>{initials}</div>
          <div style={{ flex: 1 }}>
            <ProfileRow label="ชื่อ-นามสกุล" value={user?.name || '—'} />
            <ProfileRow label="อีเมล"        value={user?.email || '—'} mono />
            <ProfileRow label="บทบาท"        value={roleLabel} />
            <ProfileRow label="รหัสผู้ใช้"   value={user?.id || '—'} mono last />
          </div>
        </div>
      </section>

      {/* Password */}
      <section style={{ marginTop: 48 }}>
        <h2 className="h-section">เปลี่ยนรหัสผ่าน</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4, marginBottom: 16 }}>
          แนะนำให้ใช้รหัสผ่านที่มีอย่างน้อย 8 ตัวอักษร ผสมตัวอักษร ตัวเลข และสัญลักษณ์
        </p>

        <form onSubmit={handleChangePassword} className="card" style={{ padding: 24, maxWidth: 480 }}>
          {status.msg && (
            <div style={{
              padding: '10px 14px', borderRadius: 6, marginBottom: 14, fontSize: 13,
              background:  status.tone === 'ok' ? '#DEE7E3' : '#FDE8E4',
              color:       status.tone === 'ok' ? '#1F4D40' : '#8B2A1A',
              border:      `1px solid ${status.tone === 'ok' ? '#B3CCC4' : '#F5C0B4'}`,
            }}>{status.msg}</div>
          )}

          <Field label="รหัสผ่านปัจจุบัน"   value={oldPwd}  onChange={setOldPwd}  type="password" autoComplete="current-password" />
          <Field label="รหัสผ่านใหม่"         value={newPwd}  onChange={setNewPwd}  type="password" autoComplete="new-password" />
          <Field label="ยืนยันรหัสผ่านใหม่"  value={newPwd2} onChange={setNewPwd2} type="password" autoComplete="new-password" last />

          <button type="submit" className="btn primary" disabled={busy} style={{ marginTop: 6 }}>
            {busy ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
          </button>
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

function ProfileRow({ label, value, mono, last }) {
  return (
    <div style={{
      display: 'flex', padding: '10px 0',
      borderBottom: last ? 'none' : '1px solid var(--rule)',
    }}>
      <div style={{ width: 140, fontSize: 13, color: 'var(--ink-3)' }}>{label}</div>
      <div style={{
        fontSize: 14, color: 'var(--ink)',
        fontFamily: mono ? 'var(--font-mono)' : undefined,
      }}>{value}</div>
    </div>
  );
}

function Field({ label, value, onChange, type='text', autoComplete, last }) {
  return (
    <div style={{ marginBottom: last ? 18 : 14 }}>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 500,
        color: 'var(--ink-2)', marginBottom: 6, letterSpacing: '0.02em',
      }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        style={{
          width: '100%', padding: '10px 12px',
          border: '1px solid var(--rule-2)', borderRadius: 6,
          fontSize: 14, fontFamily: 'var(--font-sans)',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
