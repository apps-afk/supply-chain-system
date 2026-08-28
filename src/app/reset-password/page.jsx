'use client';
import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function PasswordInput({ value, onChange, placeholder = '••••••••', autoComplete, autoFocus, minLength }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <input
        type={show ? 'text' : 'password'}
        value={value} onChange={onChange}
        placeholder={placeholder} required minLength={minLength}
        autoComplete={autoComplete} autoFocus={autoFocus}
        style={{ ...S.input, marginBottom: 0, paddingRight: 44 }}
      />
      <button
        type="button" onClick={() => setShow(s => !s)} tabIndex={-1}
        aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'grid', placeItems: 'center', color: 'var(--ink-4)' }}
      >
        {show ? '🙈' : '👁️'}
      </button>
    </div>
  );
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const email = params.get('email') || '';
  const token = params.get('token') || '';

  const [pass, setPass]   = useState('');
  const [pass2, setPass2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const missingLink = !email || !token;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (pass.length < 8) { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    if (pass !== pass2) { setError('รหัสผ่านไม่ตรงกัน'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password: pass }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'เกิดข้อผิดพลาด');
      else setDone(true);
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่'); }
    setLoading(false);
  }

  return (
    <div style={S.page}>
      <div style={S.topAccent} />
      <div style={S.card}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500, textAlign: 'center', marginBottom: 4 }}>
          ตั้งรหัสผ่านใหม่
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', marginBottom: 22 }}>
          INITIAL Supply Chain
        </div>

        {missingLink ? (
          <div style={S.errBox}>ลิงก์ไม่ถูกต้อง — กรุณาขอลิงก์ตั้งรหัสผ่านใหม่จากหน้าเข้าสู่ระบบอีกครั้ง</div>
        ) : done ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>ตั้งรหัสผ่านใหม่สำเร็จ</div>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 20 }}>
              ใช้รหัสผ่านใหม่เข้าสู่ระบบได้เลย
            </p>
            <a href="/login" style={{ ...S.submitBtn, display: 'block', textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box' }}>
              ไปหน้าเข้าสู่ระบบ
            </a>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 16 }}>
              บัญชี: <strong>{email}</strong>
            </div>
            {error && <div style={S.errBox}>{error}</div>}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={S.label}>รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</label>
              <PasswordInput value={pass} onChange={e => setPass(e.target.value)} minLength={8} autoComplete="new-password" autoFocus />
              <label style={S.label}>ยืนยันรหัสผ่านใหม่</label>
              <PasswordInput value={pass2} onChange={e => setPass2(e.target.value)} minLength={8} autoComplete="new-password" />
              <button type="submit" disabled={loading} style={{ ...S.submitBtn, marginTop: 4, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'กำลังบันทึก…' : 'ตั้งรหัสผ่านใหม่'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={S.page} />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'var(--paper)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px 48px' },
  topAccent: { position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#2B3060 0%,#C09535 50%,#2B3060 100%)' },
  card: { background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--rule)', boxShadow: '0 8px 40px -12px rgba(20,18,14,0.16),0 2px 8px -2px rgba(20,18,14,0.06)', padding: '36px 36px 28px', width: '100%', maxWidth: 400 },
  label: { fontSize: 12, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 5, letterSpacing: '0.02em' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid var(--rule-2)', borderRadius: 6, fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', fontFamily: 'var(--font-sans)', marginBottom: 12, boxSizing: 'border-box' },
  submitBtn: { width: '100%', padding: '11px 0', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em' },
  errBox: { background: '#FDE8E4', border: '1px solid #F5C0B4', color: '#8B2A1A', borderRadius: 6, padding: '10px 14px', fontSize: 13, marginBottom: 16, lineHeight: 1.5 },
};
