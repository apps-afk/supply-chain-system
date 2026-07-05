'use client';
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

const ROLES = [
  { value: 'admin',       label: 'ผู้ดูแลระบบ' },
  { value: 'hr_manager',  label: 'ผู้จัดการ HR' },
  { value: 'procurement', label: 'ฝ่ายจัดซื้อ' },
  { value: 'accountant',  label: 'ฝ่ายบัญชี' },
  { value: 'manager',     label: 'ผู้จัดการ' },
  { value: 'user',        label: 'ผู้ใช้งานทั่วไป' },
];

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()} at ${hh}:${mm}`;
}

export function ScreenSettingsTeam() {
  const { data: session } = useSession();
  const me = session?.user;
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [resetFor, setResetFor] = useState(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'โหลดข้อมูลไม่สำเร็จ');
        setUsers([]);
      } else {
        setUsers(data.users || []);
      }
    } catch {
      setError('เครือข่ายขัดข้อง');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function changeRole(email, role) {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      alert('เครือข่ายขัดข้อง');
    }
    load();
  }

  async function removeUser(email, name) {
    if (!confirm(`ต้องการลบผู้ใช้ "${name}" (${email}) ใช่หรือไม่?`)) return;
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      alert('เครือข่ายขัดข้อง');
    }
    load();
  }

  // Permission gate
  if (me && me.role !== 'admin') {
    return (
      <div className="page">
        <div className="page-head">
          <div className="page-title">
            <div className="eyebrow">จัดการผู้ใช้</div>
            <h1 className="h-display">ไม่มีสิทธิ์เข้าใช้งาน</h1>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 8 }}>
              หน้านี้สำหรับผู้ดูแลระบบเท่านั้น กรุณาติดต่อผู้ดูแลระบบ
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">จัดการผู้ใช้</div>
          <h1 className="h-display">ทีมงานและสิทธิ์</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 6 }}>
            จัดการบทบาทของสมาชิกในทีม
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={() => setShowAdd(true)}>
            <PlusIcon /> เพิ่ม User
          </button>
          <button className="btn" onClick={load}>
            <RefreshIcon /> รีเฟรช
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#FDE8E4', color: '#8B2A1A',
          padding: '10px 14px', borderRadius: 6, fontSize: 13,
          marginTop: 24, border: '1px solid #F5C0B4',
        }}>{error}</div>
      )}

      <div className="card" style={{ marginTop: 32, padding: 0, overflow: 'hidden' }}>
        <table className="tbl" style={{ tableLayout: 'auto' }}>
          <thead>
            <tr>
              <th style={{ width: '22%' }}>ผู้ใช้</th>
              <th style={{ width: '18%' }}>บทบาท</th>
              <th style={{ width: '17%' }}>เข้าระบบล่าสุด</th>
              <th style={{ width: '17%' }}>วันที่เพิ่ม</th>
              <th>อีเมล</th>
              <th style={{ width: 110, textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-3)' }}>
                กำลังโหลด…
              </td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-3)' }}>
                ยังไม่มีผู้ใช้
              </td></tr>
            ) : users.map(u => (
              <UserRow
                key={u.email}
                u={u}
                me={me}
                onChangeRole={changeRole}
                onDelete={removeUser}
                onResetPwd={() => setResetFor(u)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddUserModal
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); load(); }}
        />
      )}
      {resetFor && (
        <ResetPasswordModal
          user={resetFor}
          onClose={() => setResetFor(null)}
          onDone={() => { setResetFor(null); load(); }}
        />
      )}
    </div>
  );
}

function UserRow({ u, me, onChangeRole, onDelete, onResetPwd }) {
  const isMe = me?.email?.toLowerCase() === u.email.toLowerCase();
  const initials = (u.name || u.email).slice(0, 2).toUpperCase();
  const status = isMe ? 'คุณ' : (u.verified ? 'ยืนยันแล้ว' : 'รอยืนยัน');
  const lockDelete = isMe || u.isBuiltin;

  return (
    <tr>
      <td>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--paper-2)', color: 'var(--ink-2)',
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 500,
            flexShrink: 0,
          }}>{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{u.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
              {status}
              {u.legacyHash && (
                <span title="บัญชีนี้ยังใช้รหัสผ่านรูปแบบเก่า — จะอัพเกรดเป็นแบบปลอดภัยอัตโนมัติเมื่อเข้าสู่ระบบครั้งถัดไป"
                  style={{ marginLeft: 6, padding: '0 6px', borderRadius: 3, background: 'var(--ochre-soft)',
                           color: '#6B5121', fontSize: 9.5, fontWeight: 600, cursor: 'help' }}>
                  รหัสรูปแบบเก่า
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td>
        <select
          value={u.role}
          onChange={(e) => onChangeRole(u.email, e.target.value)}
          disabled={isMe}
          style={{
            padding: '7px 28px 7px 12px', borderRadius: 8,
            border: '1px solid var(--rule-2)', fontFamily: 'var(--font-sans)',
            fontSize: 13, background: 'var(--surface)', color: 'var(--ink)',
            cursor: isMe ? 'not-allowed' : 'pointer',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%236E6859' stroke-width='1.4' stroke-linecap='round'><path d='m3 4.5 3 3 3-3'/></svg>")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
            minWidth: 150,
          }}
        >
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </td>
      <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{fmtDate(u.lastLogin)}</td>
      <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{fmtDate(u.createdAt)}</td>
      <td style={{ fontSize: 13, color: 'var(--ink-2)', maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {u.email}
      </td>
      <td>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <IconBtn title="ตั้งรหัสผ่านใหม่" disabled={u.isBuiltin} onClick={onResetPwd}>
            <LockIcon />
          </IconBtn>
          <IconBtn title={`ส่งอีเมลถึง ${u.email}`} onClick={() => window.location.href = `mailto:${u.email}`}>
            <MailIcon />
          </IconBtn>
          <IconBtn title={lockDelete ? 'ไม่สามารถลบได้' : 'ลบผู้ใช้'} tone="err" disabled={lockDelete} onClick={() => onDelete(u.email, u.name)}>
            <TrashIcon />
          </IconBtn>
        </div>
      </td>
    </tr>
  );
}

function IconBtn({ title, onClick, disabled, tone, children }) {
  const color = disabled ? 'var(--ink-4)' : (tone === 'err' ? 'var(--clay)' : 'var(--ink-3)');
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 30, height: 30, padding: 0,
        display: 'grid', placeItems: 'center',
        background: 'none', border: 'none', borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color, opacity: disabled ? 0.45 : 1,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--paper-2)'; }}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >{children}</button>
  );
}

/* Modals */

function AddUserModal({ onClose, onCreated }) {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState('user');
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!email.toLowerCase().endsWith('@initialestate.com')) {
      return setErr('อนุญาตเฉพาะบัญชี @initialestate.com');
    }
    if (password.length < 8) {
      return setErr('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
    }
    setBusy(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error || 'เกิดข้อผิดพลาด');
      else onCreated();
    } catch {
      setErr('เครือข่ายขัดข้อง');
    }
    setBusy(false);
  }

  return (
    <ModalShell title="เพิ่มผู้ใช้ใหม่" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {err && <ErrBox>{err}</ErrBox>}
        <Field label="ชื่อ-นามสกุล" value={name} onChange={setName} required />
        <Field label="อีเมลบริษัท" value={email} onChange={setEmail} type="email" placeholder="yourname@initialestate.com" required />
        <Field label="รหัสผ่านเริ่มต้น" value={password} onChange={setPassword} type="password" placeholder="อย่างน้อย 8 ตัวอักษร" required />
        <div>
          <FieldLabel>บทบาท</FieldLabel>
          <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'กำลังเพิ่ม…' : 'เพิ่มผู้ใช้'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ResetPasswordModal({ user, onClose, onDone }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (password.length < 8) return setErr('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
    setBusy(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error || 'เกิดข้อผิดพลาด');
      else onDone();
    } catch {
      setErr('เครือข่ายขัดข้อง');
    }
    setBusy(false);
  }

  return (
    <ModalShell title="ตั้งรหัสผ่านใหม่" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>
          ตั้งรหัสผ่านใหม่ให้ <strong style={{ color: 'var(--ink)' }}>{user.name}</strong> ({user.email})
        </p>
        {err && <ErrBox>{err}</ErrBox>}
        <Field label="รหัสผ่านใหม่" value={password} onChange={setPassword} type="password" placeholder="อย่างน้อย 8 ตัวอักษร" required />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({ title, children, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(20,18,14,0.5)',
      display: 'grid', placeItems: 'center', zIndex: 100, padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', padding: 28, borderRadius: 12,
        width: '100%', maxWidth: 440,
        boxShadow: '0 16px 48px -12px rgba(20,18,14,0.3)',
      }}>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500,
          marginBottom: 18, color: 'var(--ink)',
        }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return <label style={{
    display: 'block', fontSize: 12, fontWeight: 500,
    color: 'var(--ink-2)', marginBottom: 5, letterSpacing: '0.02em',
  }}>{children}</label>;
}

function Field({ label, value, onChange, type='text', placeholder, required }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required}
        style={inputStyle}
      />
    </div>
  );
}

function ErrBox({ children }) {
  return <div style={{
    background: '#FDE8E4', color: '#8B2A1A',
    padding: '10px 14px', borderRadius: 6, fontSize: 13,
    border: '1px solid #F5C0B4',
  }}>{children}</div>;
}

const inputStyle = {
  width: '100%', padding: '10px 12px',
  border: '1px solid var(--rule-2)', borderRadius: 6,
  fontSize: 14, fontFamily: 'var(--font-sans)',
  outline: 'none', boxSizing: 'border-box',
  background: 'var(--surface)',
};

/* Icons */
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M7 2.5v9M2.5 7h9"/>
  </svg>
);
const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v3h-3M2 11V8h3M11.5 6A5 5 0 0 0 3 5.5M2.5 8a5 5 0 0 0 8.5.5"/>
  </svg>
);
const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="6.5" width="8" height="6" rx="1"/>
    <path d="M5 6.5V4.5a2 2 0 0 1 4 0v2"/>
  </svg>
);
const MailIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1.5" y="3" width="11" height="8" rx="1"/>
    <path d="m2 4 5 4 5-4"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 3.5h9M5 3.5v-1h4v1M3.5 3.5l.5 9a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5l.5-9"/>
  </svg>
);
