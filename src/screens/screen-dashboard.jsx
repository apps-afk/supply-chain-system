'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Icons, Stat, InitialEstateLogo, money } from '../lib/shell';

const MONTHS_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

const RFQ_STATUS_TH = {
  draft: 'ร่าง', sent: 'ส่งแล้ว', received: 'ได้รับ Quote', closed: 'ปิดงาน', cancelled: 'ยกเลิก',
};

// Same warranty/retention logic as the Documents screen — kept inline so the
// dashboard chunk doesn't pull the whole contract screen in.
function warrantyDays(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();
  let days = 0;
  const yr = t.match(/(\d+(?:\.\d+)?)\s*(?:ปี|year)/);
  const mo = t.match(/(\d+(?:\.\d+)?)\s*(?:เดือน|month)/);
  const dy = t.match(/(\d+(?:\.\d+)?)\s*(?:วัน|day)/);
  if (yr) days += parseFloat(yr[1]) * 365;
  if (mo) days += parseFloat(mo[1]) * 30;
  if (dy) days += parseFloat(dy[1]);
  days = Math.round(days);
  return days > 0 ? days : null;
}
function retentionInfo(c) {
  const wd = warrantyDays(c?.warranty);
  const baseStr = c?.end_date || c?.signed_at;
  if (!wd || !baseStr) return null;
  const base = new Date(baseStr);
  if (Number.isNaN(base.getTime())) return null;
  const release = new Date(base.getTime() + wd * 86400000);
  const daysLeft = Math.round((release - new Date()) / 86400000);
  return { release, daysLeft };
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' }); }
  catch { return iso; }
}

export function ScreenDashboard({ go }) {
  const { data: session } = useSession();
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'ผู้ใช้งาน';
  const now = new Date();
  const monthLabel = `${MONTHS_TH[now.getMonth()]} ${now.getFullYear() + 543}`;

  const [prices, setPrices]       = useState([]);
  const [rfqs, setRfqs]           = useState([]);
  const [contracts, setContracts] = useState([]);
  const [ctypes, setCtypes]       = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rPx, rR, rC, rCt, rM] = await Promise.all([
          fetch('/api/prices'), fetch('/api/rfqs'), fetch('/api/contracts'),
          fetch('/api/contract-types'), fetch('/api/materials'),
        ]);
        if (rPx.ok) setPrices((await rPx.json()).items || []);
        if (rR.ok)  setRfqs((await rR.json()).items || []);
        if (rC.ok)  setContracts((await rC.json()).items || []);
        if (rCt.ok) setCtypes((await rCt.json()).items || []);
        if (rM.ok)  setMaterials((await rM.json()).items || []);
      } catch { /* stats degrade to 0 */ }
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const cutoff30 = Date.now() - 30 * 86400000;
    const recentPrices = prices.filter(p => new Date(p.captured_at).getTime() >= cutoff30).length;

    const openStatuses = new Set(['draft', 'sent', 'received']);
    const openRfqs = rfqs.filter(r => openStatuses.has(r.status));
    const today = new Date().toLocaleDateString('sv-SE'); // local YYYY-MM-DD (not UTC)
    const overdue = openRfqs.filter(r => r.status === 'sent' && r.due_date && r.due_date < today).length;

    const active = contracts.filter(c => c.status === 'active');
    const activeValue = active.reduce((s, c) => s + (Number(c.amount) || 0), 0);

    // Retention exposure: amount × retention% of the contract's document
    // type, summed over active contracts whose retention isn't released yet.
    const pctByType = Object.fromEntries(ctypes.map(t => [t.id, Number(t.retention_pct) || 0]));
    let retentionHeld = 0;
    for (const c of active) {
      const pct = pctByType[c.type_id] || 0;
      if (!pct) continue;
      const info = retentionInfo(c);
      if (info && info.daysLeft <= 0) continue; // already releasable
      retentionHeld += (Number(c.amount) || 0) * pct / 100;
    }

    return { pricesTotal: prices.length, recentPrices, openRfqs: openRfqs.length, overdue, activeContracts: active.length, activeValue, retentionHeld };
  }, [prices, rfqs, contracts, ctypes]);

  // Actionable items for "ต้องดูวันนี้"
  const todos = useMemo(() => {
    const out = [];
    const today = new Date().toLocaleDateString('sv-SE'); // local YYYY-MM-DD (not UTC)
    for (const r of rfqs) {
      if (r.status === 'sent' && r.due_date && r.due_date < today) {
        out.push({ icon: '⏰', tone: 'var(--clay)', text: `RFQ ${r.no} เกินกำหนดเสนอราคา (${fmtDate(r.due_date)})`, nav: () => { try { localStorage.setItem('rfq.currentId', r.id); } catch {} go('rfq-confirm'); } });
      } else if (r.status === 'received') {
        out.push({ icon: '📥', tone: 'var(--moss)', text: `RFQ ${r.no} ได้รับ Quote แล้ว — รอตรวจสอบ/บันทึก Price DB`, nav: () => { try { localStorage.setItem('rfq.currentId', r.id); } catch {} go('rfq-confirm'); } });
      }
    }
    for (const c of contracts) {
      if (c.status !== 'active') continue;
      const info = retentionInfo(c);
      if (!info) continue;
      if (info.daysLeft <= 0) {
        out.push({ icon: '💰', tone: 'var(--clay)', text: `${c.no || c.title} — ครบกำหนดคืนเงินประกันแล้ว (${fmtDate(info.release.toISOString())})`, nav: () => { try { localStorage.setItem('contract.currentId', c.id); } catch {} go('contract'); } });
      } else if (info.daysLeft <= 30) {
        out.push({ icon: '🔔', tone: 'var(--ochre)', text: `${c.no || c.title} — เงินประกันครบกำหนดในอีก ${info.daysLeft} วัน`, nav: () => { try { localStorage.setItem('contract.currentId', c.id); } catch {} go('contract'); } });
      }
    }
    return out.slice(0, 8);
  }, [rfqs, contracts, go]);

  // Biggest price moves over the last 30 days: latest vs previous point per material
  const priceMoves = useMemo(() => {
    const matName = new Map(materials.map(m => [m.id, m.name]));
    const byMat = new Map();
    // prices come ordered captured_at desc from the API
    for (const p of prices) {
      if (!byMat.has(p.material_id)) byMat.set(p.material_id, []);
      const arr = byMat.get(p.material_id);
      if (arr.length < 2) arr.push(p);
    }
    const cutoff30 = Date.now() - 30 * 86400000;
    const moves = [];
    for (const [matId, pts] of byMat) {
      if (pts.length < 2) continue;
      const [latest, prev] = pts;
      if (new Date(latest.captured_at).getTime() < cutoff30) continue;
      const a = Number(latest.price), b = Number(prev.price);
      if (!b) continue;
      const pct = ((a - b) / b) * 100;
      if (Math.abs(pct) < 0.05) continue;
      moves.push({ matId, name: matName.get(matId) || matId, from: b, to: a, pct });
    }
    moves.sort((x, y) => Math.abs(y.pct) - Math.abs(x.pct));
    return moves.slice(0, 5);
  }, [prices, materials]);

  const recentRfqs = useMemo(() => rfqs.slice(0, 5), [rfqs]);

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">ภาพรวม · {monthLabel}</div>
          <h1 className="h-display">สวัสดี {userName} —<br/>ยินดีต้อนรับสู่ระบบจัดซื้อ ซัพพลายเชน</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          <InitialEstateLogo width={120} style={{ opacity: 0.82 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary" onClick={() => go('rfq-create')}>{Icons.plus} สร้างใบขอราคา</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)', padding: '28px 0' }}>
        {[
          { label: 'ราคาในระบบทั้งหมด', value: loading ? '…' : String(stats.pricesTotal), unit: 'รายการ',
            sub: stats.recentPrices ? `+${stats.recentPrices} ใน 30 วัน` : 'ยังไม่มีรายการใหม่' },
          { label: 'ใบขอราคาที่กำลังดำเนินการ', value: loading ? '…' : String(stats.openRfqs), unit: 'ใบ',
            sub: stats.overdue ? `${stats.overdue} ใบเกินกำหนด` : 'ไม่มีใบเกินกำหนด' },
          { label: 'สัญญาที่ใช้งานอยู่', value: loading ? '…' : String(stats.activeContracts), unit: 'ฉบับ',
            sub: stats.activeValue ? `มูลค่ารวม ${money(stats.activeValue)}` : 'ยังไม่มีรายการ' },
          { label: 'เงินประกันที่ถือไว้', value: loading ? '…' : money(stats.retentionHeld), unit: '',
            sub: 'จาก % เก็บไว้ของประเภทเอกสาร' },
        ].map((s, i) => (
          <div key={i} style={{ paddingLeft: i === 0 ? 0 : 32, borderLeft: i === 0 ? 'none' : '1px solid var(--rule)' }}>
            <Stat {...s} />
          </div>
        ))}
      </div>

      <section style={{ marginTop: 56 }}>
        <h2 className="h-section">ต้องดูวันนี้</h2>
        {todos.length === 0 ? (
          <div className="card" style={{ marginTop: 16, padding: '40px 24px', textAlign: 'center', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: 14 }}>ไม่มีรายการที่ต้องดำเนินการ 🎉</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>ระบบจะแจ้งเมื่อมี RFQ เกินกำหนด, Quote รอตรวจ, หรือเงินประกันใกล้ครบกำหนด</div>
          </div>
        ) : (
          <div className="card" style={{ marginTop: 16, padding: 0 }}>
            {todos.map((t, i) => (
              <div key={i} onClick={t.nav}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px',
                         borderTop: i ? '1px solid var(--rule)' : 'none', cursor: 'pointer' }}>
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-2)' }}>{t.text}</span>
                <span style={{ color: t.tone }}>{Icons.chevronR}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 56 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 className="h-section">การเคลื่อนไหวของราคา</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>วัสดุที่ราคาเปลี่ยนแปลงมากที่สุดในรอบ 30 วัน</p>
          </div>
          <button className="btn ghost" onClick={() => go('pricedb')}>ดูฐานข้อมูลราคาทั้งหมด {Icons.chevronR}</button>
        </div>
        {priceMoves.length === 0 ? (
          <div className="card" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: 14 }}>ยังไม่มีการเปลี่ยนแปลงราคาใน 30 วัน</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>ต้องมีราคาอย่างน้อย 2 จุดต่อวัสดุจึงจะเทียบได้</div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>วัสดุ</th>
                  <th className="num-col">ราคาเดิม</th>
                  <th className="num-col">ราคาล่าสุด</th>
                  <th className="num-col" style={{ width: 110 }}>เปลี่ยนแปลง</th>
                </tr>
              </thead>
              <tbody>
                {priceMoves.map(m => (
                  <tr key={m.matId} onClick={() => go('pricedb')} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 500 }}>{m.name}</td>
                    <td className="num-col num">{money(m.from)}</td>
                    <td className="num-col num">{money(m.to)}</td>
                    <td className="num-col">
                      <span style={{ fontWeight: 600, color: m.pct > 0 ? 'var(--clay)' : 'var(--moss)' }}>
                        {m.pct > 0 ? '▲' : '▼'} {Math.abs(m.pct).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ marginTop: 56 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 className="h-section">ใบขอราคาล่าสุด</h2>
          <button className="btn ghost sm" onClick={() => go('rfq')}>ดูทั้งหมด {Icons.chevronR}</button>
        </div>
        {recentRfqs.length === 0 ? (
          <div className="card" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: 14 }}>ยังไม่มีใบขอราคา</div>
            <button className="btn primary sm" style={{ marginTop: 14 }} onClick={() => go('rfq-create')}>
              {Icons.plus} สร้างใบขอราคาแรก
            </button>
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: '16%' }}>RFQ No.</th>
                  <th>รายการ</th>
                  <th>ครบกำหนด</th>
                  <th style={{ width: 130 }}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {recentRfqs.map(r => (
                  <tr key={r.id} onClick={() => { try { localStorage.setItem('rfq.currentId', r.id); } catch {} go('rfq-confirm'); }}
                      style={{ cursor: 'pointer' }}>
                    <td className="font-mono" style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>{r.no}</td>
                    <td style={{ fontWeight: 500 }}>{r.title || '—'}</td>
                    <td style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{fmtDate(r.due_date)}</td>
                    <td style={{ fontSize: 12 }}>{RFQ_STATUS_TH[r.status] || r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
