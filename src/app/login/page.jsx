'use client';
import React, { useState, useEffect, useId } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

/* ---- Logo ---- */
function InitialEstateLogo({ width = 200 }) {
  const uid = useId().replace(/:/g, '-');
  const clipId = `login-logo-n${uid}`;
  const h = Math.round(width * 46 / 200);
  return (
    <svg width={width} height={h} viewBox="0 0 200 46" fill="none" aria-label="Initial Estate">
      <defs>
        <clipPath id={clipId}>
          <path d="M8 -5 L31 -5 L39 40 L16 40 Z" />
        </clipPath>
      </defs>
      <text x="0" y="34"
        fontFamily="'IBM Plex Serif', Georgia, 'Times New Roman', serif"
        fontSize="35" fontWeight="600" fill="#C09535">
        INITIAL
      </text>
      <path d="M8 -5 L31 -5 L39 40 L16 40 Z" fill="#2B3060" />
      <g clipPath={`url(#${clipId})`}>
        <text x="0" y="34"
          fontFamily="'IBM Plex Serif', Georgia, 'Times New Roman', serif"
          fontSize="35" fontWeight="600" fill="#F5EFE2">
          INITIAL
        </text>
      </g>
      <text x="1" y="44"
        fontFamily="'IBM Plex Serif', Georgia, serif"
        fontSize="9.5" fontWeight="500" fill="#2B3060" letterSpacing="3.2">
        ESTATE CO.,LTD.
      </text>
    </svg>
  );
}

/* ---- Google icon ---- */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

/* ---- Check icon ---- */
const CheckIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
    <circle cx="20" cy="20" r="20" fill="#DEE7E3" />
    <path d="M12 20.5 17.5 26 28 14" stroke="#1F4D40" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ERROR_MESSAGES = {
  AccessDenied:  'อนุญาตเฉพาะบัญชี @initialestate.com เท่านั้น',
  OAuthSignin:   'ไม่สามารถเชื่อมต่อ Google ได้ กรุณาลองใหม่',
  OAuthCallback: 'เกิดข้อผิดพลาดจาก Google กรุณาลองใหม่',
  default:       'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
};

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [mode, setMode]         = useState('login');   // 'login' | 'register'
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  // Login fields
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [rName, setRName]       = useState('');
  const [rEmail, setREmail]     = useState('');
  const [rPass, setRPass]       = useState('');
  const [rPass2, setRPass2]     = useState('');

  useEffect(() => {
    if (status === 'authenticated') router.replace('/');
  }, [status, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const code = new URLSearchParams(window.location.search).get('error');
      if (code) setError(ERROR_MESSAGES[code] || ERROR_MESSAGES.default);
    }
  }, []);

  function switchMode(m) {
    setMode(m);
    setError('');
    setSuccess(false);
  }

  async function handleGoogle() {
    setLoading(true);
    setError('');
    await signIn('google', { callbackUrl: '/' });
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    if (!email.toLowerCase().endsWith('@initialestate.com')) {
      setError('อนุญาตเฉพาะบัญชี @initialestate.com เท่านั้น');
      return;
    }
    setLoading(true);
    const res = await signIn('credentials', { email, password, redirect: false });
    if (res?.error) {
      setError(ERROR_MESSAGES[res.error] || ERROR_MESSAGES.default);
      setLoading(false);
    } else {
      router.replace('/');
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    if (!rEmail.toLowerCase().endsWith('@initialestate.com')) {
      setError('อนุญาตเฉพาะบัญชี @initialestate.com เท่านั้น');
      return;
    }
    if (rPass.length < 8) {
      setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    if (rPass !== rPass2) {
      setError('รหัสผ่านไม่ตรงกัน');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: rName, email: rEmail, password: rPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || ERROR_MESSAGES.default);
      } else {
        setSuccess(true);
      }
    } catch {
      setError(ERROR_MESSAGES.default);
    }
    setLoading(false);
  }

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div style={S.page}>
        <div style={S.spinner} />
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.topAccent} />

      <div style={S.card}>
        {/* Logo */}
        <div style={S.logoWrap}>
          <InitialEstateLogo width={188} />
        </div>

        {/* Tabs */}
        <div style={S.tabs}>
          <button style={{ ...S.tab, ...(mode === 'login'    ? S.tabActive : {}) }} onClick={() => switchMode('login')}>เข้าสู่ระบบ</button>
          <button style={{ ...S.tab, ...(mode === 'register' ? S.tabActive : {}) }} onClick={() => switchMode('register')}>สมัครสมาชิก</button>
        </div>

        {/* Error */}
        {error && <div style={S.errBox}>{error}</div>}

        {/* ===== LOGIN MODE ===== */}
        {mode === 'login' && (
          <div style={{ animation: 'fadeIn 0.18s ease' }}>
            <div style={S.sub}>
              เข้าด้วยบัญชี{' '}
              <span style={{ color: '#C09535', fontWeight: 500 }}>@initialestate.com</span>
            </div>

            <button
              style={{ ...S.googleBtn, opacity: loading ? 0.7 : 1 }}
              onClick={handleGoogle}
              disabled={loading}
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>

            <div style={S.divider}>
              <span style={S.dividerLine} />
              <span style={S.dividerText}>หรือเข้าด้วยอีเมล</span>
              <span style={S.dividerLine} />
            </div>

            <form onSubmit={handleLogin} style={S.form}>
              <label style={S.label}>อีเมล</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="yourname@initialestate.com" required
                style={S.input} autoComplete="email"
              />
              <label style={{ ...S.label, marginTop: 4 }}>รหัสผ่าน</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                style={S.input} autoComplete="current-password"
              />
              <button type="submit" disabled={loading}
                style={{ ...S.submitBtn, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
              </button>
            </form>
          </div>
        )}

        {/* ===== REGISTER MODE ===== */}
        {mode === 'register' && !success && (
          <div style={{ animation: 'fadeIn 0.18s ease' }}>
            <div style={S.sub}>
              สมัครด้วยอีเมล{' '}
              <span style={{ color: '#C09535', fontWeight: 500 }}>@initialestate.com</span>
            </div>

            <button
              style={{ ...S.googleBtn, opacity: loading ? 0.7 : 1, marginBottom: 4 }}
              onClick={handleGoogle}
              disabled={loading}
            >
              <GoogleIcon />
              <span>Sign up with Google</span>
            </button>

            <div style={S.divider}>
              <span style={S.dividerLine} />
              <span style={S.dividerText}>หรือตั้งรหัสผ่าน</span>
              <span style={S.dividerLine} />
            </div>

            <form onSubmit={handleRegister} style={S.form}>
              <label style={S.label}>ชื่อ-นามสกุล</label>
              <input
                type="text" value={rName} onChange={e => setRName(e.target.value)}
                placeholder="ชื่อจริง นามสกุล" required
                style={S.input} autoComplete="name"
              />
              <label style={{ ...S.label, marginTop: 4 }}>อีเมลบริษัท</label>
              <input
                type="email" value={rEmail} onChange={e => setREmail(e.target.value)}
                placeholder="yourname@initialestate.com" required
                style={S.input} autoComplete="email"
              />
              <label style={{ ...S.label, marginTop: 4 }}>รหัสผ่าน</label>
              <input
                type="password" value={rPass} onChange={e => setRPass(e.target.value)}
                placeholder="อย่างน้อย 8 ตัวอักษร" required minLength={8}
                style={S.input} autoComplete="new-password"
              />
              <label style={{ ...S.label, marginTop: 4 }}>ยืนยันรหัสผ่าน</label>
              <input
                type="password" value={rPass2} onChange={e => setRPass2(e.target.value)}
                placeholder="••••••••" required
                style={{ ...S.input, marginBottom: 16 }} autoComplete="new-password"
              />
              <button type="submit" disabled={loading}
                style={{ ...S.submitBtn, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'กำลังสมัคร…' : 'สมัครสมาชิก'}
              </button>
            </form>
          </div>
        )}

        {/* ===== REGISTER SUCCESS ===== */}
        {mode === 'register' && success && (
          <div style={{ ...S.successBox, animation: 'fadeIn 0.25s ease' }}>
            <CheckIcon />
            <div style={S.successTitle}>สมัครสำเร็จ!</div>
            <div style={S.successSub}>
              บัญชีของคุณถูกสร้างเรียบร้อยแล้ว<br />
              กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่ตั้งไว้
            </div>
            <button style={S.submitBtn} onClick={() => switchMode('login')}>
              ไปหน้าเข้าสู่ระบบ
            </button>
          </div>
        )}

        <div style={S.footer}>
          Initial Estate Supply Chain System · เวอร์ชัน 1.0
        </div>
      </div>

      <div style={S.copyright}>
        © 2025 Initial Estate Co.,Ltd. · ระบบสำหรับพนักงานภายในเท่านั้น
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'var(--paper)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px 48px',
  },
  topAccent: {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    height: 3,
    background: 'linear-gradient(90deg, #2B3060 0%, #C09535 50%, #2B3060 100%)',
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 12,
    border: '1px solid var(--rule)',
    boxShadow: '0 8px 40px -12px rgba(20,18,14,0.16), 0 2px 8px -2px rgba(20,18,14,0.06)',
    padding: '40px 40px 32px',
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
  },
  logoWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 24,
    paddingBottom: 24,
    borderBottom: '1px solid var(--rule)',
  },
  tabs: {
    display: 'flex',
    gap: 0,
    marginBottom: 20,
    borderBottom: '1px solid var(--rule)',
  },
  tab: {
    flex: 1,
    padding: '10px 0',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: -1,
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--ink-3)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabActive: {
    color: 'var(--teal)',
    borderBottomColor: 'var(--teal)',
  },
  sub: {
    fontSize: 13,
    color: 'var(--ink-3)',
    textAlign: 'center',
    marginBottom: 20,
  },
  errBox: {
    background: '#FDE8E4',
    border: '1px solid #F5C0B4',
    color: '#8B2A1A',
    borderRadius: 6,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 1.5,
  },
  googleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    padding: '11px 0',
    background: '#fff',
    border: '1px solid var(--rule-2)',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--ink)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    boxShadow: '0 1px 2px rgba(20,18,14,0.06)',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '18px 0',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: 'var(--rule)',
  },
  dividerText: {
    fontSize: 12,
    color: 'var(--ink-4)',
    whiteSpace: 'nowrap',
    letterSpacing: '0.04em',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--ink-2)',
    marginBottom: 5,
    letterSpacing: '0.02em',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--rule-2)',
    borderRadius: 6,
    fontSize: 14,
    color: 'var(--ink)',
    background: 'var(--surface)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    marginBottom: 12,
    boxSizing: 'border-box',
  },
  submitBtn: {
    width: '100%',
    padding: '11px 0',
    background: 'var(--teal)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    letterSpacing: '0.02em',
  },
  successBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '8px 0 4px',
    textAlign: 'center',
  },
  successTitle: {
    fontFamily: 'var(--font-serif)',
    fontSize: 20,
    fontWeight: 500,
    color: 'var(--ink)',
  },
  successSub: {
    fontSize: 13,
    color: 'var(--ink-3)',
    lineHeight: 1.6,
    marginBottom: 8,
  },
  footer: {
    marginTop: 28,
    paddingTop: 20,
    borderTop: '1px solid var(--rule)',
    fontSize: 11,
    color: 'var(--ink-4)',
    textAlign: 'center',
    letterSpacing: '0.04em',
  },
  copyright: {
    marginTop: 20,
    fontSize: 11,
    color: 'var(--ink-4)',
    textAlign: 'center',
  },
  spinner: {
    width: 28,
    height: 28,
    border: '2px solid var(--rule)',
    borderTopColor: 'var(--teal)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
