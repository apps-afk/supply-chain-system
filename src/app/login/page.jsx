'use client';
import React, { useState, useEffect, useId } from 'react';
import { signIn, useSession } from 'next-auth/react';

/* ---- Logo ---- */
function InitialEstateLogo({ width = 200 }) {
  const uid = useId().replace(/:/g, '-');
  const clipId = `ll${uid}`;
  const h = Math.round(width * 46 / 200);
  return (
    <svg width={width} height={h} viewBox="0 0 200 46" fill="none" aria-label="Initial Estate">
      <defs><clipPath id={clipId}><path d="M8 -5 L31 -5 L39 40 L16 40 Z" /></clipPath></defs>
      <text x="0" y="34" fontFamily="'IBM Plex Serif',Georgia,serif" fontSize="35" fontWeight="600" fill="#C09535">INITIAL</text>
      <path d="M8 -5 L31 -5 L39 40 L16 40 Z" fill="#2B3060" />
      <g clipPath={`url(#${clipId})`}>
        <text x="0" y="34" fontFamily="'IBM Plex Serif',Georgia,serif" fontSize="35" fontWeight="600" fill="#F5EFE2">INITIAL</text>
      </g>
      <text x="1" y="44" fontFamily="'IBM Plex Serif',Georgia,serif" fontSize="9.5" fontWeight="500" fill="#2B3060" letterSpacing="3.2">ESTATE CO.,LTD.</text>
    </svg>
  );
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

const ERRORS = {
  AccessDenied:     'อนุญาตเฉพาะบัญชี @initialestate.com เท่านั้น',
  OAuthSignin:      'ไม่สามารถเชื่อมต่อ Google ได้ กรุณาลองใหม่',
  OAuthCallback:    'เกิดข้อผิดพลาดจาก Google กรุณาลองใหม่',
  CredentialsSignin:'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  Configuration:    'ระบบยังไม่ได้ตั้งค่า — ติดต่อผู้ดูแลระบบ',
  default:          'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
};

export default function LoginPage() {
  const { status } = useSession();

  const [mode, setMode]       = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  // Login
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  // Register
  const [rName,  setRName]  = useState('');
  const [rEmail, setREmail] = useState('');
  const [rPass,  setRPass]  = useState('');
  const [rPass2, setRPass2] = useState('');

  // Forgot
  const [fEmail, setFEmail]   = useState('');
  const [fSent,  setFSent]    = useState(false);

  useEffect(() => {
    // Hard redirect (not router.replace) — soft-nav keeps SessionProvider's
    // null session in memory and the page just sits on a spinner forever.
    if (status === 'authenticated') window.location.replace('/');
  }, [status]);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code) setError(ERRORS[code] || ERRORS.default);

    // Check if Google provider is available
    fetch('/api/auth/providers')
      .then(r => r.json())
      .then(p => setGoogleEnabled(!!p?.google))
      .catch(() => {});
  }, []);

  function switchMode(m) { setMode(m); setError(''); setSuccess(false); }

  async function handleGoogle() {
    setLoading(true); setError('');
    await signIn('google', { callbackUrl: '/' });
  }

  async function handleLogin(e) {
    e.preventDefault(); setError('');
    setLoading(true);
    const res = await signIn('credentials', { email, password, redirect: false });
    if (res?.error) {
      setError(res.error.startsWith('อีเมล') ? res.error : (ERRORS[res.error] || ERRORS.default));
      setLoading(false);
    } else {
      // Hard navigate — replace() so the /login entry doesn't stay in history.
      // Soft router.replace leaves SessionProvider's null session in memory
      // and the user gets stuck on a spinner forever.
      window.location.replace('/');
    }
  }

  async function handleRegister(e) {
    e.preventDefault(); setError('');
    if (!rEmail.toLowerCase().endsWith('@initialestate.com')) {
      setError('อนุญาตเฉพาะบัญชี @initialestate.com เท่านั้น'); return;
    }
    if (rPass.length < 8) { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    if (rPass !== rPass2) { setError('รหัสผ่านไม่ตรงกัน'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: rName, email: rEmail, password: rPass }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || ERRORS.default); }
      else { setSuccess(true); }
    } catch { setError(ERRORS.default); }
    setLoading(false);
  }

  function handleForgot(e) {
    e.preventDefault();
    setFSent(true);
  }

  // Only show full-page spinner when we're already authenticated and waiting
  // for the redirect to fire. Showing it during 'loading' state can trap users
  // forever if the session check is slow.
  if (status === 'authenticated') {
    return <div style={S.page}><div style={S.spinner} /></div>;
  }

  return (
    <div style={S.page}>
      <div style={S.topAccent} />

      {/* Forgot Password Modal */}
      {showForgot && (
        <div style={S.overlay} onClick={() => { setShowForgot(false); setFSent(false); setFEmail(''); }}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHead}>
              <div style={S.modalTitle}>ลืมรหัสผ่าน</div>
              <button style={S.closeBtn} onClick={() => { setShowForgot(false); setFSent(false); setFEmail(''); }}>✕</button>
            </div>
            {!fSent ? (
              <>
                <p style={S.modalSub}>กรอกอีเมลของคุณ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้</p>
                <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input
                    type="email" value={fEmail} onChange={e => setFEmail(e.target.value)}
                    placeholder="yourname@initialestate.com" required
                    style={S.input} autoFocus
                  />
                  <button type="submit" style={S.submitBtn}>ส่งลิงก์รีเซ็ต</button>
                </form>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📧</div>
                <div style={{ fontWeight: 500, marginBottom: 8, fontFamily: 'var(--font-serif)' }}>ส่งอีเมลแล้ว!</div>
                <p style={S.modalSub}>
                  หากอีเมล <strong>{fEmail}</strong> มีในระบบ<br/>
                  คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านในไม่ช้า<br/>
                  กรุณาตรวจสอบกล่องข้อความ (รวมถึง Spam)
                </p>
                <button style={{ ...S.submitBtn, marginTop: 8 }} onClick={() => { setShowForgot(false); setFSent(false); setFEmail(''); }}>
                  ปิด
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={S.card}>
        {/* Logo */}
        <div style={S.logoWrap}>
          <InitialEstateLogo width={188} />
        </div>

        {/* Demo hint */}
        <div style={S.demoBox}>
          <span style={{ opacity: 0.6 }}>🔑</span>
          <span>ทดลองใช้: <strong>admin@initialestate.com</strong> / <strong>Admin1234!</strong></span>
        </div>

        {/* Tabs */}
        <div style={S.tabs}>
          <button style={{ ...S.tab, ...(mode === 'login'    ? S.tabActive : {}) }} onClick={() => switchMode('login')}>เข้าสู่ระบบ</button>
          <button style={{ ...S.tab, ...(mode === 'register' ? S.tabActive : {}) }} onClick={() => switchMode('register')}>สมัครสมาชิก</button>
        </div>

        {error && <div style={S.errBox}>{error}</div>}

        {/* ===== LOGIN ===== */}
        {mode === 'login' && (
          <div style={{ animation: 'fadeIn 0.18s ease' }}>
            <div style={S.sub}>เข้าด้วยบัญชี <span style={{ color: '#C09535', fontWeight: 500 }}>@initialestate.com</span></div>

            {googleEnabled && (
              <>
                <button style={{ ...S.googleBtn, opacity: loading ? 0.7 : 1 }} onClick={handleGoogle} disabled={loading}>
                  <GoogleIcon /><span>เข้าสู่ระบบด้วย Google</span>
                </button>
                <div style={S.divider}>
                  <span style={S.divLine} /><span style={S.divText}>หรือเข้าด้วยอีเมล</span><span style={S.divLine} />
                </div>
              </>
            )}

            <form onSubmit={handleLogin} style={S.form}>
              <label style={S.label}>อีเมล</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="yourname@initialestate.com" required style={S.input} autoComplete="email" />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                <label style={S.label}>รหัสผ่าน</label>
                <button type="button" style={S.forgotLink} onClick={() => setShowForgot(true)}>ลืมรหัสผ่าน?</button>
              </div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required style={S.input} autoComplete="current-password" />

              <button type="submit" disabled={loading} style={{ ...S.submitBtn, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
              </button>
            </form>
          </div>
        )}

        {/* ===== REGISTER ===== */}
        {mode === 'register' && !success && (
          <div style={{ animation: 'fadeIn 0.18s ease' }}>
            <div style={S.sub}>สมัครด้วยอีเมล <span style={{ color: '#C09535', fontWeight: 500 }}>@initialestate.com</span></div>

            {googleEnabled && (
              <>
                <button style={{ ...S.googleBtn, opacity: loading ? 0.7 : 1 }} onClick={handleGoogle} disabled={loading}>
                  <GoogleIcon /><span>สมัครสมาชิกด้วย Google</span>
                </button>
                <div style={S.divider}>
                  <span style={S.divLine} /><span style={S.divText}>หรือตั้งรหัสผ่าน</span><span style={S.divLine} />
                </div>
              </>
            )}

            <form onSubmit={handleRegister} style={S.form}>
              <label style={S.label}>ชื่อ-นามสกุล</label>
              <input type="text" value={rName} onChange={e => setRName(e.target.value)}
                placeholder="ชื่อจริง นามสกุล" required style={S.input} autoComplete="name" />
              <label style={{ ...S.label, marginTop: 4 }}>อีเมลบริษัท</label>
              <input type="email" value={rEmail} onChange={e => setREmail(e.target.value)}
                placeholder="yourname@initialestate.com" required style={S.input} autoComplete="email" />
              <label style={{ ...S.label, marginTop: 4 }}>รหัสผ่าน <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(อย่างน้อย 8 ตัว)</span></label>
              <input type="password" value={rPass} onChange={e => setRPass(e.target.value)}
                placeholder="อย่างน้อย 8 ตัวอักษร" required minLength={8} style={S.input} autoComplete="new-password" />
              <label style={{ ...S.label, marginTop: 4 }}>ยืนยันรหัสผ่าน</label>
              <input type="password" value={rPass2} onChange={e => setRPass2(e.target.value)}
                placeholder="••••••••" required style={{ ...S.input, marginBottom: 16 }} autoComplete="new-password" />
              <button type="submit" disabled={loading} style={{ ...S.submitBtn, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'กำลังสมัคร…' : 'สมัครสมาชิก'}
              </button>
            </form>
          </div>
        )}

        {/* ===== REGISTER SUCCESS ===== */}
        {mode === 'register' && success && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '8px 0', textAlign: 'center', animation: 'fadeIn 0.25s ease' }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="24" fill="#DEE7E3" />
              <path d="M14 24.5 21 31.5 34 17" stroke="#1F4D40" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500 }}>สมัครสำเร็จ!</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 8 }}>
              บัญชีของคุณถูกสร้างเรียบร้อยแล้ว<br/>กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่ตั้งไว้
            </div>
            <button style={S.submitBtn} onClick={() => switchMode('login')}>ไปหน้าเข้าสู่ระบบ</button>
          </div>
        )}

        <div style={S.footer}>ระบบจัดซื้อ ซัพพลายเชน · เวอร์ชัน 1.0</div>
      </div>

      <div style={S.copyright}>© 2568 บริษัท อินิเชียล เอสเตท จำกัด · ระบบสำหรับพนักงานภายในเท่านั้น</div>
    </div>
  );
}

const S = {
  page:    { minHeight: '100vh', background: 'var(--paper)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px 48px' },
  topAccent: { position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#2B3060 0%,#C09535 50%,#2B3060 100%)' },
  card:    { background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--rule)', boxShadow: '0 8px 40px -12px rgba(20,18,14,0.16),0 2px 8px -2px rgba(20,18,14,0.06)', padding: '40px 40px 32px', width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column' },
  logoWrap: { display: 'flex', justifyContent: 'center', marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--rule)' },
  demoBox: { display: 'flex', alignItems: 'center', gap: 8, background: '#F0E4C5', border: '1px solid #E6D4A8', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#6B5121', marginBottom: 16 },
  tabs:    { display: 'flex', marginBottom: 20, borderBottom: '1px solid var(--rule)' },
  tab:     { flex: 1, padding: '10px 0', background: 'none', border: 'none', borderBottom: '2px solid transparent', marginBottom: -1, fontSize: 14, fontWeight: 500, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'color .15s,border-color .15s' },
  tabActive: { color: 'var(--teal)', borderBottomColor: 'var(--teal)' },
  sub:     { fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', marginBottom: 18 },
  errBox:  { background: '#FDE8E4', border: '1px solid #F5C0B4', color: '#8B2A1A', borderRadius: 6, padding: '10px 14px', fontSize: 13, marginBottom: 16, lineHeight: 1.5 },
  googleBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: '11px 0', background: '#fff', border: '1px solid var(--rule-2)', borderRadius: 6, fontSize: 14, fontWeight: 500, color: 'var(--ink)', cursor: 'pointer', fontFamily: 'var(--font-sans)', boxShadow: '0 1px 2px rgba(20,18,14,0.06)' },
  divider: { display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' },
  divLine: { flex: 1, height: 1, background: 'var(--rule)' },
  divText: { fontSize: 12, color: 'var(--ink-4)', whiteSpace: 'nowrap', letterSpacing: '0.04em' },
  form:    { display: 'flex', flexDirection: 'column' },
  label:   { fontSize: 12, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 5, letterSpacing: '0.02em' },
  forgotLink: { background: 'none', border: 'none', fontSize: 12, color: 'var(--teal)', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)' },
  input:   { width: '100%', padding: '10px 12px', border: '1px solid var(--rule-2)', borderRadius: 6, fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', fontFamily: 'var(--font-sans)', marginBottom: 12, boxSizing: 'border-box' },
  submitBtn: { width: '100%', padding: '11px 0', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em' },
  footer:  { marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--rule)', fontSize: 11, color: 'var(--ink-4)', textAlign: 'center', letterSpacing: '0.04em' },
  copyright: { marginTop: 20, fontSize: 11, color: 'var(--ink-4)', textAlign: 'center' },
  spinner: { width: 28, height: 28, border: '2px solid var(--rule)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(20,18,14,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 },
  modal:   { background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--rule)', boxShadow: '0 16px 48px -8px rgba(20,18,14,0.24)', padding: '28px 32px', width: '100%', maxWidth: 380, animation: 'fadeIn 0.2s ease' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500 },
  modalSub: { fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 16 },
  closeBtn: { background: 'none', border: 'none', fontSize: 16, color: 'var(--ink-4)', cursor: 'pointer', padding: 4 },
};
