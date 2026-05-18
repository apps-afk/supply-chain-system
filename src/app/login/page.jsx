'use client';
import React, { useState, useEffect, useId } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

/* ---- Inline logo (same as shell.jsx but self-contained for login page) ---- */
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

/* ---- Google G logo ---- */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

const ERROR_MESSAGES = {
  AccessDenied: 'อนุญาตเฉพาะบัญชี @initialestate.com เท่านั้น',
  OAuthSignin:  'ไม่สามารถเชื่อมต่อ Google ได้ กรุณาลองใหม่',
  OAuthCallback:'เกิดข้อผิดพลาดจาก Google กรุณาลองใหม่',
  default:      'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
};

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (status === 'authenticated') router.replace('/');
  }, [status, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('error');
      if (code) setError(ERROR_MESSAGES[code] || ERROR_MESSAGES.default);
    }
  }, []);

  async function handleGoogle() {
    setLoading(true);
    setError('');
    await signIn('google', { callbackUrl: '/' });
  }

  async function handleCredentials(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email.toLowerCase().endsWith('@initialestate.com')) {
      setError('อนุญาตเฉพาะบัญชี @initialestate.com เท่านั้น');
      setLoading(false);
      return;
    }

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError(ERROR_MESSAGES[res.error] || ERROR_MESSAGES.default);
      setLoading(false);
    } else {
      router.replace('/');
    }
  }

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div style={styles.page}>
        <div style={styles.spinner} />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Decorative top bar */}
      <div style={styles.topAccent} />

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          <InitialEstateLogo width={188} />
        </div>

        {/* Heading */}
        <div style={styles.heading}>เข้าสู่ระบบ</div>
        <div style={styles.sub}>
          ระบบจัดการ Supply Chain ·{' '}
          <span style={{ color: '#C09535', fontWeight: 500 }}>@initialestate.com</span>{' '}
          เท่านั้น
        </div>

        {/* Error */}
        {error && <div style={styles.errBox}>{error}</div>}

        {/* Google button */}
        <button
          style={{ ...styles.googleBtn, opacity: loading ? 0.7 : 1 }}
          onClick={handleGoogle}
          disabled={loading}
        >
          <GoogleIcon />
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>หรือเข้าด้วยอีเมล</span>
          <span style={styles.dividerLine} />
        </div>

        {/* Credentials form */}
        <form onSubmit={handleCredentials} style={styles.form}>
          <label style={styles.label}>อีเมล</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="yourname@initialestate.com"
            required
            style={styles.input}
            autoComplete="email"
          />

          <label style={styles.label} style={{ marginTop: 12 }}>รหัสผ่าน</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={styles.input}
            autoComplete="current-password"
          />

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        {/* Footer */}
        <div style={styles.footer}>
          Initial Estate Supply Chain System · เวอร์ชัน 1.0
        </div>
      </div>

      {/* Bottom credit */}
      <div style={styles.copyright}>
        © 2025 Initial Estate Co.,Ltd. · ระบบสำหรับพนักงานภายในเท่านั้น
      </div>
    </div>
  );
}

/* ---- Styles ---- */
const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--paper)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px 48px',
    position: 'relative',
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
    padding: '44px 40px 36px',
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
  },
  logoWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 28,
    paddingBottom: 24,
    borderBottom: '1px solid var(--rule)',
  },
  heading: {
    fontFamily: 'var(--font-serif)',
    fontSize: 22,
    fontWeight: 500,
    color: 'var(--ink)',
    marginBottom: 6,
    textAlign: 'center',
  },
  sub: {
    fontSize: 13,
    color: 'var(--ink-3)',
    textAlign: 'center',
    marginBottom: 24,
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
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '20px 0',
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
    gap: 0,
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
    marginTop: 4,
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
