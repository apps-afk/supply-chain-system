'use client';
import React, { useEffect, useState } from 'react';

/**
 * Optional, always-skippable AI assist panel used in the contract-review and
 * price-comparison screens. It NEVER blocks the user: if the API key isn't set
 * the button is disabled with a clear note, and the surrounding save/approve
 * actions keep working regardless of whether AI was run.
 *
 * Props:
 *   kind:  'contract' | 'comparison'
 *   payload: { contract_id } | { comparison_id }
 *   title:  heading text
 *   hint:   one-line description under the heading
 */
const SEV = {
  high:   { bg: 'rgba(239,68,68,0.10)',  bd: 'rgba(239,68,68,0.35)',  fg: '#b91c1c', label: 'สำคัญมาก' },
  medium: { bg: 'rgba(245,158,11,0.10)', bd: 'rgba(245,158,11,0.35)', fg: '#92400e', label: 'ควรดู' },
  low:    { bg: 'rgba(100,116,139,0.10)',bd: 'rgba(100,116,139,0.30)',fg: '#475569', label: 'เล็กน้อย' },
};

export default function AiAssistPanel({ kind, payload, title, hint, initialResult }) {
  const [cfg, setCfg]         = useState(null);
  const [busy, setBusy]       = useState(false);
  const [result, setResult]   = useState(initialResult || null);
  const [err, setErr]         = useState('');

  // A stored result (e.g. auto-evaluated on upload, or run by a colleague)
  // arrives async with the parent's data load — adopt it unless the user
  // already ran a fresh analysis in this session.
  useEffect(() => {
    if (initialResult) setResult(prev => prev || initialResult);
  }, [initialResult]);

  useEffect(() => {
    let alive = true;
    fetch('/api/ai/config').then(r => r.ok ? r.json() : null)
      .then(d => { if (alive) setCfg(d); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  async function run() {
    setBusy(true); setErr(''); setResult(null);
    try {
      const r = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, ...payload }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || 'วิเคราะห์ด้วย AI ไม่สำเร็จ'); return; }
      setResult(d);
    } catch {
      setErr('เชื่อมต่อ AI ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || (cfg && !cfg.hasKey);

  return (
    <div style={{
      border: '1px solid var(--rule-2, #e2e2e2)', borderRadius: 10,
      background: 'var(--surface, #fff)', padding: 18, marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15 }}>✨</span>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</span>
            <span style={{
              fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 999,
              background: 'rgba(100,116,139,0.12)', color: '#475569',
            }}>ไม่บังคับ · ข้ามได้</span>
          </div>
          {hint && <div style={{ fontSize: 12, color: 'var(--ink-3, #666)', marginTop: 4, lineHeight: 1.5 }}>{hint}</div>}
        </div>
        <button
          className="btn primary"
          onClick={run}
          disabled={disabled}
          style={{ flexShrink: 0, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
          title={cfg && !cfg.hasKey ? 'ยังไม่ได้ตั้งค่า API key ของ AI' : ''}
        >
          {busy ? 'กำลังวิเคราะห์…' : (result ? 'วิเคราะห์อีกครั้ง' : '✨ ให้ AI ช่วย')}
        </button>
      </div>

      {cfg && !cfg.hasKey && (
        <div style={{ fontSize: 12, color: '#92400e', marginTop: 12,
          background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 8, padding: '8px 12px' }}>
          ⚠ ยังไม่ได้ตั้งค่า AI (ANTHROPIC_API_KEY) — ติดต่อ admin เพื่อเปิดใช้งาน หรือดำเนินการต่อโดยไม่ใช้ AI ได้เลย
        </div>
      )}

      {err && (
        <div style={{ fontSize: 12.5, color: '#b91c1c', marginTop: 12,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 8, padding: '8px 12px' }}>
          {err}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {result.summary && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>สรุป (โดย AI)</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2, #333)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {result.summary}
              </div>
            </div>
          )}

          {Array.isArray(result.issues) && result.issues.length > 0 && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>ข้อที่ควรดู / แก้ไข ({result.issues.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.issues.map((it, i) => {
                  const c = SEV[it.severity] || SEV.medium;
                  return (
                    <div key={i} style={{
                      border: `1px solid ${c.bd}`, background: c.bg, borderRadius: 8, padding: '10px 12px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: c.fg,
                          padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.5)' }}>
                          {c.label}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink, #222)' }}>{it.title}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-2, #444)', lineHeight: 1.6 }}>{it.detail}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {result.recommendation && (
            <div style={{ background: 'var(--teal-soft, #e6f4f1)', border: '1px solid var(--teal, #0f766e)',
              borderRadius: 8, padding: '10px 12px' }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>คำแนะนำ</div>
              <div style={{ fontSize: 13, color: 'var(--ink, #222)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {result.recommendation}
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--ink-4, #999)' }}>
            AI ช่วยวิเคราะห์เท่านั้น — การตัดสินใจสุดท้ายเป็นของผู้ใช้ · โมเดล: {result.model || '—'}
            {result.by ? ` · โดย ${result.by}` : ''}
            {result.at ? ` · ${new Date(result.at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
            {result.auto ? ' · วิเคราะห์อัตโนมัติตอนอัปโหลด' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
