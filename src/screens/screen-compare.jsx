'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Icons, Chip, money, safeHref } from '../lib/shell';
import { printDoc } from './screen-compare-create-pricedb';
import { nextPoNo } from './screen-po';
import { usePermissions } from '../lib/use-permissions';

/*
  Compare detail — renders a saved comparison from /api/comparisons.
  The id is stashed in localStorage('cmp.currentId') by the list-row click.

  Row shape: { no, title, status(draft|finalized|archived), project_id,
               items_json: [{code,name,spec,unit,qty,prices:{supplierId:price}}],
               suppliers_json: { mode, list:[{id,name,rfqNo?}], selectedSupplier },
               total_low, total_high, notes, created_at }
*/

const STATUS_TH = {
  draft:     { label: 'ร่าง',        kind: 'draft' },
  finalized: { label: 'อนุมัติแล้ว', kind: 'active' },
  archived:  { label: 'เก็บถาวร',    kind: 'draft' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' }); }
  catch { return iso; }
}

export function ScreenCompare({ go }) {
  const [cmp, setCmp]           = useState(null);
  const [projects, setProjects] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [signRoles, setSignRoles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [poBusy, setPoBusy] = useState(false);
  const [approveBusy, setApproveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const { canWrite, canApprove, isAdmin, user } = usePermissions();

  useEffect(() => {
    (async () => {
      setLoading(true); setErr('');
      try {
        const stashed = (typeof window !== 'undefined') ? window.localStorage.getItem('cmp.currentId') : null;
        const [r, rP, rR] = await Promise.all([
          fetch('/api/comparisons'), fetch('/api/projects'), fetch('/api/approval-roles'),
        ]);
        const d = await r.json();
        if (!r.ok) { setErr(d.error || 'โหลดข้อมูลไม่สำเร็จ'); setLoading(false); return; }
        if (rP.ok) { try { setProjects((await rP.json()).items || []); } catch {} }
        if (rR.ok) {
          try {
            const roleItems = (await rR.json()).items || [];
            setSignRoles(roleItems.filter(x => x.active).sort((a, b) => (a.level || 0) - (b.level || 0)));
          } catch {}
        }
        const list = d.items || [];
        const picked = (stashed && list.find(x => x.id === stashed)) || list[0] || null;
        setCmp(picked);
        if (picked) {
          try {
            const rA = await fetch(`/api/attachments?entity_type=comparison&entity_id=${encodeURIComponent(picked.id)}`);
            if (rA.ok) setAttachments((await rA.json()).items || []);
          } catch { /* attachments optional */ }
        }
      } catch { setErr('เครือข่ายขัดข้อง'); }
      setLoading(false);
    })();
  }, []);

  const suppliers = useMemo(() => {
    const list = cmp?.suppliers_json?.list;
    return Array.isArray(list) ? list : [];
  }, [cmp]);
  const items = useMemo(() => (Array.isArray(cmp?.items_json) ? cmp.items_json : []), [cmp]);

  const totals = useMemo(() => {
    const t = {};
    for (const s of suppliers) {
      t[s.id] = items.reduce((sum, it) => {
        const p = it.prices?.[s.id];
        return sum + (p != null ? Number(p) * (Number(it.qty) || 1) : 0);
      }, 0);
    }
    return t;
  }, [suppliers, items]);

  const bestId = useMemo(() => {
    const entries = Object.entries(totals).filter(([, v]) => v > 0);
    if (entries.length === 0) return null;
    entries.sort((a, b) => a[1] - b[1]);
    return entries[0][0];
  }, [totals]);

  const projName = useMemo(() => {
    const p = projects.find(x => x.id === cmp?.project_id);
    return p ? (p.code ? `${p.code} · ${p.name}` : p.name) : '—';
  }, [projects, cmp]);

  // Turn the approved comparison into a Purchase Order: winner supplier +
  // that supplier's prices per line, running PO number, status 'ordered'.
  async function createPO() {
    if (!cmp) return;
    const winnerName = cmp.suppliers_json?.selectedSupplier || '';
    const winner = suppliers.find(s => s.name === winnerName) || suppliers.find(s => s.id === bestId) || suppliers[0];
    if (!winner) { setErr('ไม่พบ Supplier ในเอกสารนี้'); return; }
    if (!confirm(`สร้างใบสั่งซื้อกับ "${winner.name}"?`)) return;
    setPoBusy(true); setErr('');
    try {
      const poItems = items.map(it => ({
        code: it.code, name: it.name, unit: it.unit || '',
        qty: Number(it.qty) || 1,
        price: it.prices?.[winner.id] != null ? Number(it.prices[winner.id]) : null,
      }));
      const amount = poItems.reduce((s2, it) => s2 + (it.price != null ? it.price * it.qty : 0), 0);
      // The PO number is computed client-side, so two concurrent creates can
      // pick the same slot. If the POST loses the running-number race
      // (409 / "duplicate"/"ซ้ำ"), fetch a fresh number and retry once.
      async function postOnce(no) {
        const r = await fetch('/api/purchase-orders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            no,
            comparison_id: cmp.id,
            project_id: cmp.project_id || null,
            // pseudo ids (rfq_*) aren't real supplier rows — keep the name only
            supplier_id: String(winner.id || '').startsWith('rfq_') ? null : (winner.id || null),
            supplier_name: winner.name,
            title: `สั่งซื้อตาม ${cmp.no} · ${winner.name}`,
            status: 'ordered',
            items_json: poItems,
            amount,
            notes: '',
            ordered_at: new Date().toLocaleDateString('sv-SE'),
          }),
        });
        const d = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, d };
      }
      const no = await nextPoNo();
      let attempt = await postOnce(no);
      if (!attempt.ok && (attempt.status === 409 || /duplicate|ซ้ำ/i.test(attempt.d.error || ''))) {
        const fresh = await nextPoNo();
        attempt = await postOnce(fresh);
      }
      if (!attempt.ok) { setErr(attempt.d.error || 'สร้างใบสั่งซื้อไม่สำเร็จ'); setPoBusy(false); return; }
      try { localStorage.setItem('po.currentId', attempt.d.item.id); } catch {}
      go('po-detail');
    } catch { setErr('เครือข่ายขัดข้อง'); }
    setPoBusy(false);
  }

  // ---- In-app approval chain (P2) -------------------------------------
  const approvals = useMemo(
    () => (Array.isArray(cmp?.approvals_json) ? cmp.approvals_json : []),
    [cmp]
  );
  const approvedLevels = useMemo(() => new Set(approvals.map(a => a.level)), [approvals]);
  // the lowest active level not yet approved — the only one approvable now
  const nextLevel = useMemo(() => {
    const pending = signRoles.filter(r => !approvedLevels.has(r.level));
    return pending.length ? pending[0].level : null;
  }, [signRoles, approvedLevels]);
  // the highest approved level — the only one revocable
  const topApproved = useMemo(() => {
    if (!approvals.length) return null;
    return approvals.reduce((m, a) => (a.level > m ? a.level : m), -Infinity);
  }, [approvals]);

  async function doApproval(level, action) {
    if (!cmp || approveBusy) return;
    if (action === 'revoke' && !confirm('ยกเลิกการอนุมัติลำดับนี้?')) return;
    setApproveBusy(true); setErr('');
    try {
      const r = await fetch('/api/comparisons/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cmp.id, level, action }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error || 'บันทึกการอนุมัติไม่สำเร็จ');
      else setCmp(d.item);
    } catch { setErr('เครือข่ายขัดข้อง'); }
    setApproveBusy(false);
  }

  // Admin-only hard delete — the API cascades into file_attachments and
  // removes the attached Ref files from Drive as well.
  async function deleteComparison() {
    if (!cmp || deleteBusy) return;
    if (!confirm(`ลบเอกสารเปรียบเทียบ "${cmp.no}" ถาวร?\n\nไฟล์ Ref ที่แนบไว้ใน Drive จะถูกลบไปด้วย — การลบไม่สามารถย้อนกลับได้`)) return;
    setDeleteBusy(true); setErr('');
    try {
      const r = await fetch('/api/comparisons', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cmp.id }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'ลบไม่สำเร็จ'); setDeleteBusy(false); return; }
      try { window.localStorage.removeItem('cmp.currentId'); } catch {}
      go('compare');
      return;
    } catch { setErr('เครือข่ายขัดข้อง'); }
    setDeleteBusy(false);
  }

  async function changeStatus(next) {
    if (!cmp || next === cmp.status) return;
    setStatusBusy(true);
    try {
      const r = await fetch('/api/comparisons', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        // _expect = optimistic lock: the server rejects with 409 if someone
        // else changed the status since this screen loaded it.
        body: JSON.stringify({ id: cmp.id, status: next, _expect: { status: cmp.status } }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error || 'เปลี่ยนสถานะไม่สำเร็จ');
      else setCmp(c => ({ ...c, status: next }));
    } catch { setErr('เครือข่ายขัดข้อง'); }
    setStatusBusy(false);
  }

  if (loading) {
    return (
      <div className="page">
        <button className="btn ghost sm" onClick={() => go('compare')} style={{ marginBottom: 20, marginLeft: -8 }}>
          {Icons.back} กลับไป Compare
        </button>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
      </div>
    );
  }

  if (!cmp) {
    return (
      <div className="page">
        <button className="btn ghost sm" onClick={() => go('compare')} style={{ marginBottom: 20, marginLeft: -8 }}>
          {Icons.back} กลับไป Compare
        </button>
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
          ยังไม่มีเอกสารเปรียบเทียบ — สร้างได้จากหน้า Compare
        </div>
      </div>
    );
  }

  const sp = STATUS_TH[cmp.status] || STATUS_TH.draft;
  const mode = cmp.suppliers_json?.mode || 'PriceDB';
  const selectedName = cmp.suppliers_json?.selectedSupplier || '';

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => go('compare')} style={{ marginBottom: 20, marginLeft: -8 }}>
        {Icons.back} กลับไป Compare
      </button>

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>
      )}

      <div className="page-head" style={{ alignItems: 'flex-start' }}>
        <div className="page-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{cmp.no}</span>
            <Chip kind={sp.kind}>{sp.label}</Chip>
            <Chip kind="draft">{mode === 'RFQ' ? 'โหมด B · จาก RFQ' : 'โหมด A · จาก Price DB'}</Chip>
          </div>
          <h1 className="h-display">{cmp.title || 'เปรียบเทียบราคา'}</h1>
          <div style={{ display: 'flex', gap: 24, marginTop: 10, fontSize: 13, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
            <span>โครงการ <strong style={{ color: 'var(--ink-2)' }}>{projName}</strong></span>
            <span>สร้างเมื่อ <strong style={{ color: 'var(--ink-2)' }}>{fmtDate(cmp.created_at)}</strong></span>
            {selectedName && <span>เลือกแล้ว <strong style={{ color: 'var(--teal-ink)' }}>{selectedName}</strong></span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {cmp.status === 'finalized' && canWrite && (
            <button className="btn primary" onClick={createPO} disabled={poBusy}>
              {poBusy ? 'กำลังสร้าง…' : <>{Icons.plus} สร้างใบสั่งซื้อ</>}
            </button>
          )}
          <button className={cmp.status === 'finalized' ? 'btn' : 'btn primary'} onClick={() => printDoc(`${cmp.no}_Compare`)}>
            {Icons.download} พิมพ์ / PDF
          </button>
          {canWrite && (
            <button className="btn" onClick={() => {
              try { window.localStorage.setItem('cmp.currentId', cmp.id); } catch {}
              go('compare-upload-ref');
            }}>{Icons.upload} Upload Ref</button>
          )}
          {/* Manual status override: admin only once an approval chain exists —
              otherwise finalize must flow through the chain below. */}
          {(isAdmin || (canWrite && signRoles.length === 0)) && (
            <select value={cmp.status || 'draft'} onChange={e => changeStatus(e.target.value)} disabled={statusBusy}
              style={{ padding: '8px 12px', fontSize: 13, border: '1px solid var(--rule-2)', borderRadius: 6, background: 'var(--paper)', fontFamily: 'inherit', cursor: 'pointer' }}>
              {Object.keys(STATUS_TH).map(s => <option key={s} value={s}>{STATUS_TH[s].label}</option>)}
            </select>
          )}
          {isAdmin && (
            <button className="btn ghost" onClick={deleteComparison} disabled={deleteBusy}
              style={{ color: 'var(--clay)' }}>
              {deleteBusy ? 'กำลังลบ…' : 'ลบเอกสารนี้'}
            </button>
          )}
        </div>
      </div>

      {/* Approval chain (P2) — sequential sign-off per approval_roles master */}
      {signRoles.length > 0 && (
        <div className="card print-area" style={{ padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="eyebrow">การอนุมัติ · {approvals.length}/{signRoles.length} ลำดับ</div>
            {approvals.length === signRoles.length && (
              <Chip kind="active">อนุมัติครบทุกลำดับ</Chip>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${signRoles.length}, minmax(140px, 1fr))`, gap: 12, overflowX: 'auto' }}>
            {signRoles.map(r => {
              const entry = approvals.find(a => a.level === r.level);
              const isNext = r.level === nextLevel;
              return (
                <div key={r.id} style={{
                  border: `1px solid ${entry ? 'var(--moss)' : isNext ? 'var(--teal-ink)' : 'var(--rule-2)'}`,
                  borderRadius: 8, padding: '12px 14px',
                  background: entry ? 'var(--moss-soft)' : 'var(--paper)',
                }}>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 2 }}>ลำดับ {r.level}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{r.name}</div>
                  {entry ? (
                    <>
                      <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>✓ {entry.by_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{fmtDate(entry.at)}</div>
                      {r.level === topApproved && canApprove &&
                        (entry.by_email === user?.email || isAdmin) && (
                        <button className="btn ghost sm no-print" onClick={() => doApproval(r.level, 'revoke')}
                          disabled={approveBusy}
                          style={{ marginTop: 8, fontSize: 11, color: 'var(--clay)', padding: '2px 8px' }}>
                          ยกเลิก
                        </button>
                      )}
                    </>
                  ) : isNext && canApprove ? (
                    <button className="btn primary sm no-print" onClick={() => doApproval(r.level, 'approve')}
                      disabled={approveBusy}>
                      {approveBusy ? 'กำลังบันทึก…' : 'อนุมัติ'}
                    </button>
                  ) : (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>
                      {isNext ? 'รอการอนุมัติ' : 'รอลำดับก่อนหน้า'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comparison table */}
      <div className="card print-area" style={{ padding: 0, overflow: 'auto' }}>
        <table className="tbl" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ width: '26%' }}>รายการ</th>
              <th className="num-col" style={{ width: 90 }}>จำนวน</th>
              {suppliers.map(s => (
                <th key={s.id} className="num-col" style={{
                  background: s.name === selectedName ? 'var(--teal-soft)' : undefined,
                }}>
                  {s.name}
                  {s.rfqNo && <div style={{ fontSize: 9.5, fontWeight: 400, color: 'var(--ink-3)', marginTop: 2 }}>{s.rfqNo}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={2 + suppliers.length} style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)' }}>
                ไม่มีรายการในเอกสารนี้
              </td></tr>
            ) : items.map((it, i) => {
              const priced = suppliers.map(s => it.prices?.[s.id]).filter(p => p != null).map(Number);
              const min = priced.length ? Math.min(...priced) : null;
              return (
                <tr key={it.code || i}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{it.name}</div>
                    <div className="font-mono" style={{ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 2 }}>
                      {it.code}{it.spec ? ` · ${it.spec}` : ''}
                    </div>
                  </td>
                  <td className="num-col num">{Number(it.qty) || 1} {it.unit}</td>
                  {suppliers.map(s => {
                    const p = it.prices?.[s.id];
                    const isMin = p != null && Number(p) === min && priced.length > 1;
                    return (
                      <td key={s.id} className="num-col" style={{ background: isMin ? 'var(--moss-soft)' : undefined }}>
                        {p != null
                          ? <>
                              <div className="num" style={{ fontWeight: isMin ? 600 : 400 }}>{money(Number(p))}</div>
                              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{money(Number(p) * (Number(it.qty) || 1))}</div>
                            </>
                          : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {items.length > 0 && (
              <tr style={{ background: '#15130E', color: '#fff' }}>
                <td colSpan={2} style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>มูลค่ารวม</td>
                {suppliers.map(s => (
                  <td key={s.id} className="num-col" style={{ padding: '12px 16px' }}>
                    <span className="num" style={{ fontWeight: s.id === bestId ? 700 : 400, color: s.id === bestId ? '#9FD6B9' : '#fff' }}>
                      {money(totals[s.id] || 0)}
                    </span>
                    {s.id === bestId && <div style={{ fontSize: 9.5, color: '#9FD6B9', marginTop: 2 }}>ราคาต่ำสุด</div>}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Supplier quoted terms — only when at least one supplier carries them */}
      {suppliers.some(s => s.terms && Object.values(s.terms).some(Boolean)) && (
        <section style={{ marginTop: 32 }}>
          <h3 className="h-section" style={{ marginBottom: 12 }}>เงื่อนไขจากใบเสนอราคา</h3>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table className="tbl" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={{ width: '18%' }}>เงื่อนไข</th>
                  {suppliers.map(s => <th key={s.id}>{s.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  { icon:'💳', label:'การชำระเงิน', key:'payment' },
                  { icon:'🚚', label:'การจัดส่ง',   key:'delivery' },
                  { icon:'⏱',  label:'การยืนราคา',  key:'validity' },
                  { icon:'🛡️', label:'การรับประกัน', key:'warranty' },
                  { icon:'📦', label:'Lead Time',   key:'leadtime' },
                ].map(c => (
                  <tr key={c.key}>
                    <td style={{ fontWeight: 500, fontSize: 12.5 }}>{c.icon} {c.label}</td>
                    {suppliers.map(s => (
                      <td key={s.id} style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                        {s.terms?.[c.key] || <span style={{ color: 'var(--ink-4)', fontStyle: 'italic' }}>—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Attachments (signed ref docs) */}
      <section style={{ marginTop: 32 }}>
        <h3 className="h-section" style={{ marginBottom: 12 }}>เอกสารอ้างอิง (Ref) · {attachments.length} ไฟล์</h3>
        {attachments.length === 0 ? (
          <div className="card" style={{ padding: '28px 24px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
            ยังไม่มีไฟล์ Ref — กด "Upload Ref" เพื่ออัพโหลดเอกสารที่เซ็นอนุมัติแล้ว
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            {attachments.map((a, i) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                                       borderTop: i ? '1px solid var(--rule)' : 'none' }}>
                <div style={{ width: 28, height: 34, background: 'var(--clay)', color: '#fff', borderRadius: 3,
                              display: 'grid', placeItems: 'center', fontSize: 8, fontWeight: 600, flexShrink: 0 }}>
                  {(a.filename || '').split('.').pop()?.toUpperCase().slice(0, 4) || 'FILE'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.filename}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                    อัพโหลดโดย {a.uploaded_by || '—'} · {fmtDate(a.uploaded_at)}
                  </div>
                </div>
                {a.drive_view_link && (
                  <a href={safeHref(a.drive_view_link)} target="_blank" rel="noreferrer" className="btn sm">
                    {Icons.external} เปิดดู
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {cmp.notes && (
        <section style={{ marginTop: 24 }}>
          <div className="card" style={{ padding: '16px 20px', background: 'var(--surface-2)' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>บันทึก</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{cmp.notes}</div>
          </div>
        </section>
      )}
    </div>
  );
}
