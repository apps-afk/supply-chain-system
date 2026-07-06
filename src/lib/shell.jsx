'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { buildAlerts } from './alerts';
import { canApprove as roleCanApprove } from './permissions';

/* ----------------------- Icons (inline SVG) ----------------------- */
const Icon = ({ d, size = 16, fill }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
       stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
       className="ico" style={fill ? { fill: 'currentColor', stroke: 'none' } : null}>
    <path d={d} />
  </svg>
);

export const Icons = {
  dashboard: <Icon d="M2.5 8.5 8 3l5.5 5.5M4 7.5V13h8V7.5" />,
  rfq:       <Icon d="M3 2.5h7.5L13 5v8.5H3zM10 2.5V5h3M5.5 8h5M5.5 10.5h3" />,
  compare:   <Icon d="M3 3.5h4v9H3zm6 0h4v9H9zM3 6h4M9 8h4" />,
  pricedb:   <Icon d="M2.5 4.5v7c0 1 2.5 1.5 5.5 1.5s5.5-.5 5.5-1.5v-7M2.5 4.5C2.5 3.5 5 3 8 3s5.5.5 5.5 1.5S11 6.5 8 6.5 2.5 5.5 2.5 4.5zM2.5 8c0 1 2.5 1.5 5.5 1.5S13.5 9 13.5 8" />,
  contract:  <Icon d="M4 2.5h5l3 3V13a.5.5 0 0 1-.5.5h-7A.5.5 0 0 1 4 13zM9 2.5V5.5h3M6 8.5h4M6 10.5h3" />,
  settings:  <Icon d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm5.5-2-.7-.4.2-.8-.7-1.2-.8.2-.6-.5V4l-1.4-.4-.4.7-.8-.2-.8.2-.4-.7L6.5 4v.8l-.6.5-.8-.2-.7 1.2.2.8-.7.4v1.4l.7.4-.2.8.7 1.2.8-.2.6.5V12l1.4.4.4-.7.8.2.8-.2.4.7L9.5 12v-.8l.6-.5.8.2.7-1.2-.2-.8.7-.4z" />,
  users:     <Icon d="M5.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2 13.5c.4-2 1.7-3 3.5-3s3.1 1 3.5 3M11.5 8a2 2 0 1 0 0-4M13.5 13c-.3-1.5-1.2-2.4-2.5-2.7" />,
  bell:      <Icon d="M4 11.5h8L11 10V7a3 3 0 0 0-6 0v3zM7 13.5a1 1 0 0 0 2 0" />,
  search:    <Icon d="M7.5 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm3-1L13 13.5" />,
  plus:      <Icon d="M8 3.5v9M3.5 8h9" />,
  download:  <Icon d="M8 2.5v8m0 0L5 8m3 2.5L11 8M3 13.5h10" />,
  upload:    <Icon d="M8 13.5v-8m0 0L5 8m3-2.5L11 8M3 2.5h10" />,
  filter:    <Icon d="M2.5 3.5h11l-4 5v4l-3-1V8.5z" />,
  more:      <Icon d="M4 8h.01M8 8h.01M12 8h.01" />,
  chevronR:  <Icon d="m6 3 4 5-4 5" />,
  chevronD:  <Icon d="M3 6l5 4 5-4" />,
  check:     <Icon d="M3 8.5 6.5 12 13 4.5" />,
  arrowUp:   <Icon d="M8 13V3m0 0L4 7m4-4 4 4" />,
  arrowDown: <Icon d="M8 3v10m0 0L4 9m4 4 4-4" />,
  arrowFlat: <Icon d="M3 8h10m0 0-3-3m3 3-3 3" />,
  external:  <Icon d="M6 3.5h-3v9h9v-3M9.5 2.5h4v4m0-4L7 9" />,
  sparkles:  <Icon d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M4 12l2-2M10 6l2-2" />,
  alert:     <Icon d="M8 5v3M8 10v.5M8 1.5l6.5 11.5h-13z" />,
  clock:     <Icon d="M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8 4v4l2.5 1.5" />,
  doc:       <Icon d="M4 2.5h5l3 3V13a.5.5 0 0 1-.5.5h-7A.5.5 0 0 1 4 13zM9 2.5V5.5h3" />,
  back:      <Icon d="M13 8H3m0 0 4-4m-4 4 4 4" />,
  edit:      <Icon d="M11 2.5 13.5 5 5 13.5H2.5V11z" />,
  link:      <Icon d="M9 7l-2 2m-1-3.5L4.5 7a2.12 2.12 0 0 0 3 3l1.5-1.5m2-2L12.5 5a2.12 2.12 0 0 0-3-3L8 3.5" />,
  ruler:     <Icon d="M2.5 10 10 2.5l3.5 3.5L6 13.5zM4.5 8l1.5 1.5M6.5 6l1.5 1.5M8.5 4l1.5 1.5" />,
  folder:    <Icon d="M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5h5a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />,
  truck:     <Icon d="M1.5 4.5h7v6h-7zm7 2h3l2 2v2h-5zM4 12.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm7.5 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />,
  box:       <Icon d="M2.5 5 8 2.5 13.5 5v6L8 13.5 2.5 11zM2.5 5l5.5 2.5M13.5 5 8 7.5M8 7.5v6" />,
  hammer:    <Icon d="m3 13.5 6-6m2.5-4 2 2-3 3-2-2zM7 7.5l-1.5 1.5" />,
  fileCheck: <Icon d="M4 2.5h5l3 3V13a.5.5 0 0 1-.5.5h-7A.5.5 0 0 1 4 13zM9 2.5V5.5h3M6 9.5l1.5 1.5L10 8.5" />,
  book:      <Icon d="M3 3.5h4.5a2 2 0 0 1 1 .5L9 4.5l.5-.5a2 2 0 0 1 1-.5H15M3 3.5v9h4.5a2 2 0 0 1 1 .5L9 13.5l.5-.5a2 2 0 0 1 1-.5H15v-9" />,
};

/* ----------------------- Company Logo -----------------------
   "INITIAL · DESIGNED FOR REAL YOU · SUPPLY CHAIN" lockup —
   serif gold wordmark with the dark calligraphic swash forming
   the N's diagonal, per the brand artwork. */
export function InitialEstateLogo({ width = 148, style }) {
  const h = Math.round(width * 92 / 210);
  const GOLD = '#B07A3C';
  const INK  = '#322E36';
  return (
    <svg width={width} height={h} viewBox="0 0 210 92" fill="none" aria-label="Initial Supply Chain" style={style}>
      {/* INITIAL wordmark */}
      <text x="105" y="36" textAnchor="middle"
        fontFamily="'IBM Plex Serif', Georgia, 'Times New Roman', serif"
        fontSize="36" fontWeight="600" fill={GOLD} letterSpacing="1">
        INITIAL
      </text>
      {/* Dark swash — the N's diagonal */}
      <path d="M52 8
               C 58 11.5, 63.5 20, 67.5 28
               C 69.3 31.5, 70.8 35, 73 38.5
               L 66.5 38.5
               C 63 33.5, 58.5 25.5, 54.5 17.5
               C 53 14, 51.5 10.5, 49.5 8 Z"
            fill={INK} />
      {/* Tagline */}
      <text x="105" y="53" textAnchor="middle"
        fontFamily="var(--font-sans), 'IBM Plex Sans', Arial, sans-serif"
        fontSize="8.5" fontWeight="500" fill={GOLD} letterSpacing="3">
        DESIGNED FOR REAL YOU
      </text>
      {/* Divider with centre dot */}
      <line x1="24" y1="63" x2="97" y2="63" stroke={GOLD} strokeWidth="1.2" />
      <circle cx="105" cy="63" r="2.3" fill={GOLD} />
      <line x1="113" y1="63" x2="186" y2="63" stroke={GOLD} strokeWidth="1.2" />
      {/* SUPPLY CHAIN */}
      <text x="107" y="82" textAnchor="middle"
        fontFamily="var(--font-sans), 'IBM Plex Sans', Arial, sans-serif"
        fontSize="13" fontWeight="500" fill={INK} letterSpacing="5.5">
        SUPPLY CHAIN
      </text>
    </svg>
  );
}


/* ----------------------- Sidebar ----------------------- */
// Defined outside Sidebar so React keeps a stable component identity and
// doesn't remount every nav item on each parent re-render.
function SideItem({ id, icon, label, count, current, onNav, indent }) {
  return (
    <div
      className={"side-item" + (current === id ? " active" : "")}
      onClick={() => onNav(id)}
      style={indent ? { paddingLeft: 32 } : undefined}
    >
      {Icons[icon]}
      <span>{label}</span>
      {count != null && <span className="count">{count}</span>}
    </div>
  );
}

// Collapsible sub-feature group. Header acts like a side-item and toggles
// the children's visibility. Auto-opens when any child is the current
// route (so the user lands on an open group, not a hidden one).
function SideCollapse({ id, icon, label, childIds, current, onNav, children }) {
  const containsActive = childIds.includes(current);
  // Persist toggle to localStorage so it survives navigation; default to
  // open when a child is active or when never-set.
  const storageKey = `side.collapse.${id}`;
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = window.localStorage.getItem(storageKey);
      if (v === '1') return true;
      if (v === '0') return false;
    } catch {}
    return true;
  });
  // Force-open whenever a child becomes active so the active item is
  // visible — but don't close on its own.
  useEffect(() => {
    if (containsActive && !open) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containsActive]);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { window.localStorage.setItem(storageKey, next ? '1' : '0'); } catch {}
  };
  return (
    <>
      <div
        className={"side-item" + (containsActive ? " active" : "")}
        onClick={toggle}
        aria-expanded={open}
      >
        {Icons[icon]}
        <span>{label}</span>
        <span style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.15s',
          color: 'var(--ink-3)',
        }}>{Icons.chevronD}</span>
      </div>
      {open && children}
    </>
  );
}

function SidebarImpl({ current, onNav }) {
  const Item = (props) => <SideItem {...props} current={current} onNav={onNav} />;
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  return (
    <aside className="side">
      <div className="side-brand">
        <InitialEstateLogo width={148} />
        <div className="side-brand-sub" style={{ paddingTop: 2 }}>ระบบจัดซื้อ ซัพพลายเชน</div>
      </div>

      <div className="side-group">
        <Item id="dashboard" icon="dashboard" label="ภาพรวม" />
      </div>

      <div className="side-group">
        <div className="side-group-label">งานหลัก</div>
        <Item id="rfq"      icon="rfq"      label="ใบขอเสนอราคา (RFQ)" />
        <Item id="compare"  icon="compare"  label="เปรียบเทียบราคา" />
        <Item id="pricedb"  icon="pricedb"  label="ฐานข้อมูลราคา" />
        <Item id="supplierdb" icon="truck"  label="ฐานข้อมูลผู้ขาย" />
        <Item id="po"       icon="fileCheck" label="ใบสั่งซื้อ (PO)" />
        <Item id="contract" icon="contract" label="เอกสาร" />
      </div>

      <div className="side-group">
        <div className="side-group-label">ตั้งค่า · ข้อมูลหลัก</div>
        <Item id="projects"       icon="folder"    label="โครงการ" />
        <Item id="project-types"  icon="folder"    label="ประเภทโครงการ" />
        <Item id="suppliers"      icon="truck"     label="ผู้ขาย/ผู้รับเหมา" />
        <Item id="materials"      icon="box"       label="วัสดุก่อสร้าง" />
        <Item id="subcontracts"   icon="hammer"    label="งานจ้างเหมา" />
        <Item id="contract-types" icon="fileCheck" label="ประเภทเอกสาร" />
        <Item id="units"          icon="ruler"     label="หน่วยนับ" />
        <Item id="approval-roles" icon="fileCheck" label="ตำแหน่งผู้อนุมัติ" />
      </div>

      {/* Bottom group: admin functions — pushed to bottom via marginTop:auto.
          User identity + logout moved to Topbar avatar dropdown (UserMenu).
          Hidden for non-admin (the pages behind them are admin-gated anyway). */}
      {isAdmin && (
        <div className="side-group" style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--rule)' }}>
          <div className="side-group-label">ระบบ</div>
          <Item id="workspace" icon="settings"  label="ตั้งค่าพื้นที่ทำงาน" />
          <Item id="team"      icon="fileCheck" label="ทีมงานและสิทธิ์" />
        </div>
      )}
    </aside>
  );
}
// React.memo so the sidebar doesn't re-render when only the current screen's
// inner state changes (App passes stable `current` + memoised `onNav`).
export const Sidebar = React.memo(SidebarImpl);

/* ----------------------- Topbar ----------------------- */

// Nag banner when workspace policy requires 2FA for admins and the current
// admin hasn't enrolled yet. Enrollment itself lives in Account settings.
function TwoFaNag({ go }) {
  const { data: session } = useSession();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (session?.user?.role !== 'admin') return;
    let alive = true;
    fetch('/api/auth/2fa').then(r => r.ok ? r.json() : null).then(d => {
      if (alive && d && d.required && !d.enabled) setShow(true);
    }).catch(() => {});
    return () => { alive = false; };
  }, [session?.user?.role]);
  if (!show) return null;
  return (
    <div style={{
      background: '#F0E4C5', borderBottom: '1px solid #E6D4A8', color: '#6B5121',
      padding: '8px 20px', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span>⚠ นโยบายระบบบังคับใช้ 2FA สำหรับผู้ดูแลระบบ — บัญชีของคุณยังไม่ได้ตั้งค่า</span>
      <button className="btn sm" onClick={() => go && go('settings-account')} style={{ fontSize: 12 }}>
        ตั้งค่า 2FA เลย
      </button>
      <button onClick={() => setShow(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B5121', marginLeft: 'auto' }}>✕</button>
    </div>
  );
}

function TopbarImpl({ crumbs, onNav, go }) {
  return (
    <>
    <TwoFaNag go={go} />
    <div className="topbar">
      <div className="crumb">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? "cur" : ""}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="topbar-right">
        <CommandPalette go={go} />
        <NotificationBell go={go} />
        <UserMenu onNav={onNav} />
      </div>
    </div>
    </>
  );
}
// Memoised so it doesn't re-render when the inner screen state changes
// (App passes stable crumbs from a module-scope object and a memoised onNav).
export const Topbar = React.memo(TopbarImpl);

/* ----------------------- Topbar ⌘K command palette ---------------- */
// Real global search (P3): looks across RFQs, comparisons, contracts, POs,
// materials, and suppliers; picking a result deep-links via the same
// localStorage-stash + go() convention the rest of the app uses.
const SEARCH_SOURCES = [
  { url: '/api/rfqs',            group: 'RFQ',            screen: 'rfq-confirm',      storeKey: 'rfq.currentId',
    label: x => `${x.no || ''} · ${x.title || ''}` },
  { url: '/api/comparisons',     group: 'ใบเปรียบเทียบ',   screen: 'compare-detail',   storeKey: 'cmp.currentId',
    label: x => `${x.no || ''} · ${x.title || ''}` },
  { url: '/api/contracts',       group: 'เอกสาร/สัญญา',    screen: 'contract',         storeKey: 'contract.currentId',
    label: x => `${x.no || ''} · ${x.title || ''}` },
  { url: '/api/purchase-orders', group: 'ใบสั่งซื้อ',      screen: 'po-detail',        storeKey: 'po.currentId',
    label: x => `${x.no || ''} · ${x.supplier_name || x.title || ''}` },
  { url: '/api/materials',       group: 'วัสดุ',           screen: 'pricedb-detail',   storeKey: 'pricedb.currentMaterialId',
    label: x => `${x.code || ''} · ${x.name || ''}` },
  { url: '/api/suppliers',       group: 'Supplier',        screen: 'supplierdb-detail', storeKey: 'supplierdb.currentId',
    label: x => `${x.name || ''}${x.code ? ` · ${x.code}` : ''}` },
];

const CommandPalette = React.memo(function CommandPalette({ go }) {
  const [open, setOpen]   = useState(false);
  const [q, setQ]         = useState('');
  const [index, setIndex] = useState([]);   // flattened searchable entries
  const [sel, setSel]     = useState(0);
  const cacheAt = useRef(0);
  const inputRef = useRef(null);

  // ⌘K / Ctrl+K opens from anywhere
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Load (and cache for 60s) all sources when the palette opens
  useEffect(() => {
    if (!open) return;
    setQ(''); setSel(0);
    setTimeout(() => inputRef.current?.focus(), 30);
    if (Date.now() - cacheAt.current < 60_000 && index.length) return;
    (async () => {
      try {
        const results = await Promise.all(SEARCH_SOURCES.map(s =>
          fetch(s.url).then(r => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] }))
        ));
        const flat = [];
        results.forEach((d, i) => {
          const src = SEARCH_SOURCES[i];
          for (const item of (d.items || [])) {
            const label = src.label(item).trim();
            if (!label || label === '·') continue;
            flat.push({ group: src.group, screen: src.screen, storeKey: src.storeKey,
                        id: item.id, label, lc: label.toLowerCase() });
          }
        });
        setIndex(flat);
        cacheAt.current = Date.now();
      } catch { /* palette is best-effort */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hits = useMemoPalette(index, q);

  function pick(hit) {
    setOpen(false);
    try { localStorage.setItem(hit.storeKey, hit.id); } catch {}
    if (go) go(hit.screen);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter' && hits[sel]) pick(hits[sel]);
  }

  return (
    <>
      <div className="search" onClick={() => setOpen(true)} style={{ cursor: 'pointer' }}>
        {Icons.search}
        <input placeholder="ค้นหา RFQ, วัสดุ, ผู้ขาย…" readOnly style={{ cursor: 'pointer' }} />
        <span className="kbd">⌘K</span>
      </div>

      {open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(20,18,14,0.4)', zIndex:90,
                      display:'flex', justifyContent:'center', paddingTop:'12vh' }}
             onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div style={{ width:'min(560px, 92vw)', maxHeight:'60vh', display:'flex', flexDirection:'column',
                        background:'var(--surface)', border:'1px solid var(--rule)', borderRadius:12,
                        boxShadow:'0 24px 64px -12px rgba(20,18,14,0.3)', overflow:'hidden', height:'fit-content' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px',
                          borderBottom:'1px solid var(--rule)' }}>
              {Icons.search}
              <input ref={inputRef} value={q} onKeyDown={onKeyDown}
                onChange={e => { setQ(e.target.value); setSel(0); }}
                placeholder="พิมพ์เลขที่เอกสาร, ชื่อวัสดุ, ชื่อ supplier…"
                style={{ flex:1, border:0, outline:0, background:'transparent', fontSize:14.5, fontFamily:'inherit' }} />
              <span className="kbd">esc</span>
            </div>
            <div style={{ overflowY:'auto' }}>
              {q.trim() === '' ? (
                <div style={{ padding:'24px 18px', textAlign:'center', color:'var(--ink-3)', fontSize:12.5 }}>
                  ค้นหาได้ทั้ง RFQ · ใบเปรียบเทียบ · เอกสาร · PO · วัสดุ · Supplier
                </div>
              ) : hits.length === 0 ? (
                <div style={{ padding:'24px 18px', textAlign:'center', color:'var(--ink-3)', fontSize:12.5 }}>
                  ไม่พบ "{q}"
                </div>
              ) : hits.map((h, i) => (
                <button key={`${h.group}-${h.id}`} onClick={() => pick(h)} onMouseEnter={() => setSel(i)}
                  style={{ display:'flex', alignItems:'center', gap:12, width:'100%', textAlign:'left',
                           padding:'10px 18px', border:'none', cursor:'pointer', fontFamily:'inherit',
                           background: i === sel ? 'var(--teal-soft)' : 'transparent' }}>
                  <span style={{ fontSize:10, fontWeight:600, color:'var(--ink-3)', width:86, flexShrink:0,
                                 textTransform:'uppercase', letterSpacing:0.04 }}>{h.group}</span>
                  <span style={{ flex:1, fontSize:13.5, color:'var(--ink-1)', overflow:'hidden',
                                 textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.label}</span>
                  {i === sel && <span className="kbd">↵</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
});

// Filter helper kept outside the component body for clarity: substring match,
// grouped cap (max 5 per group) so one noisy source can't bury the rest.
function useMemoPalette(index, q) {
  return React.useMemo(() => {
    const v = q.trim().toLowerCase();
    if (!v) return [];
    const perGroup = {};
    const out = [];
    for (const item of index) {
      if (!item.lc.includes(v)) continue;
      perGroup[item.group] = (perGroup[item.group] || 0) + 1;
      if (perGroup[item.group] > 5) continue;
      out.push(item);
      if (out.length >= 30) break;
    }
    return out;
  }, [index, q]);
}

/* ----------------------- Topbar notification bell ----------------- */
// Real alerts derived from live data (same builder as the dashboard todos).
// Read-state lives in localStorage so it survives reloads without a table.
const BELL_READ_KEY = 'bell.read.v1';

const NotificationBell = React.memo(function NotificationBell({ go }) {
  const { data: session } = useSession();
  const [open, setOpen]     = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [readIds, setReadIds] = useState(() => new Set());
  const ref = useRef(null);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(BELL_READ_KEY) || '[]');
      setReadIds(new Set(Array.isArray(raw) ? raw : []));
    } catch {}
  }, []);

  const authed   = !!session?.user;
  const approver = roleCanApprove(session?.user?.role || '');

  const load = useCallback(async () => {
    try {
      // Slim projections — the alert builder reads a handful of scalar
      // fields; without ?fields= this polled full tables (with JSON blobs)
      // every 5 minutes for every logged-in user.
      const isAdmin = session?.user?.role === 'admin';
      const rs = await Promise.all([
        fetch('/api/rfqs?fields=no,title,status,due_date'),
        fetch('/api/contracts?fields=no,title,status,warranty,end_date,signed_at,retention_released_at'),
        fetch('/api/comparisons?fields=no,title,status,approvals_json'),
        fetch('/api/approval-roles'),
        // Admins also see pending forgot-password requests — without SMTP a
        // human must action these, so they belong in the bell.
        isAdmin ? fetch('/api/forgot-password') : Promise.resolve(null),
      ]);
      const [dR, dC, dM, dA, dF] = await Promise.all(
        rs.map(r => (r && r.ok ? r.json() : Promise.resolve({ items: [] })))
      );
      const signRoles = (dA.items || [])
        .filter(x => x.active)
        .sort((a, b) => (a.level || 0) - (b.level || 0));
      const forgotPending = (dF.items || []).filter(x => !x.resolved_at).length;
      setAlerts(buildAlerts({
        rfqs: dR.items || [], contracts: dC.items || [],
        comparisons: dM.items || [], signRoles, canApprove: approver,
        forgotPending,
      }));
    } catch { /* bell is best-effort — never break the topbar */ }
  }, [approver, session?.user?.role]);

  useEffect(() => {
    if (!authed) return;
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [authed, load]);

  // Refresh when opening so the list is current the moment it's seen.
  useEffect(() => { if (open && authed) load(); }, [open, authed, load]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  function persistRead(next) {
    setReadIds(next);
    // prune ids whose alert no longer exists so the list can't grow forever
    try {
      const keep = [...next].filter(id => alerts.some(a => a.id === id));
      localStorage.setItem(BELL_READ_KEY, JSON.stringify(keep));
    } catch {}
  }

  function openAlert(a) {
    persistRead(new Set([...readIds, a.id]));
    setOpen(false);
    try { localStorage.setItem(a.storeKey, a.storeVal); } catch {}
    if (go) go(a.screen);
  }

  const unread = alerts.filter(a => !readIds.has(a.id));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn ghost" title="แจ้งเตือน" aria-label="แจ้งเตือน"
        aria-expanded={open} onClick={() => setOpen(o => !o)}
        style={{ padding: 8, position: 'relative' }}>
        {Icons.bell}
        {unread.length > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2, minWidth: 15, height: 15,
            padding: '0 3px', borderRadius: 8, background: 'var(--clay)',
            color: '#fff', fontSize: 9.5, fontWeight: 700, lineHeight: '15px',
            textAlign: 'center', pointerEvents: 'none',
          }}>
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 360,
          background: 'var(--surface)', border: '1px solid var(--rule)',
          borderRadius: 10, padding: 6, zIndex: 60,
          boxShadow: '0 12px 32px -8px rgba(20,18,14,0.18), 0 2px 6px rgba(20,18,14,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px 6px' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>การแจ้งเตือน</span>
            {unread.length > 0 && (
              <button className="btn ghost sm" style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => persistRead(new Set(alerts.map(a => a.id)))}>
                อ่านทั้งหมด
              </button>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {alerts.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12.5 }}>
                ไม่มีงานค้าง 🎉
              </div>
            ) : alerts.map(a => {
              const isRead = readIds.has(a.id);
              return (
                <button key={a.id} onClick={() => openAlert(a)} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%',
                  textAlign: 'left', padding: '10px 12px', border: 'none',
                  background: 'transparent', cursor: 'pointer', borderRadius: 8,
                  fontFamily: 'inherit',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ fontSize: 15, lineHeight: '20px' }}>{a.icon}</span>
                  <span style={{
                    flex: 1, fontSize: 12.5, lineHeight: 1.5,
                    color: isRead ? 'var(--ink-3)' : 'var(--ink-1)',
                    fontWeight: isRead ? 400 : 500,
                  }}>
                    {a.text}
                  </span>
                  {!isRead && (
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: a.tone,
                                   marginTop: 6, flexShrink: 0 }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

/* ----------------------- Topbar user menu (avatar + dropdown) ----- */
const ROLE_LABEL = {
  admin:       'ผู้ดูแลระบบ',
  hr_manager:  'ผู้จัดการ HR',
  procurement: 'ฝ่ายจัดซื้อ',
  accountant:  'ฝ่ายบัญชี',
  manager:     'ผู้จัดการ',
  user:        'ผู้ใช้งานทั่วไป',
};

const UserMenu = React.memo(function UserMenu({ onNav }) {
  const { data: session } = useSession();
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const user     = session?.user;
  const name     = user?.name || user?.email?.split('@')[0] || 'ผู้ใช้งาน';
  const email    = user?.email || '';
  const initials = name.slice(0, 2).toUpperCase();
  const roleText = ROLE_LABEL[user?.role] || user?.role || '';

  function handleAccount() {
    setOpen(false);
    if (onNav) onNav('account');
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="บัญชีของฉัน"
        aria-label="บัญชีของฉัน"
        aria-expanded={open}
        style={{
          width: 34, height: 34, padding: 0,
          background: open ? 'var(--teal)' : 'var(--teal-soft)',
          color:      open ? 'var(--paper)' : 'var(--teal-ink)',
          border: 'none', borderRadius: '50%', cursor: 'pointer',
          fontFamily: 'var(--font-serif)', fontSize: 12.5, fontWeight: 600,
          display: 'grid', placeItems: 'center',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 260,
            background: 'var(--surface)',
            border: '1px solid var(--rule)',
            borderRadius: 10,
            boxShadow: '0 12px 32px -8px rgba(20,18,14,0.18), 0 2px 6px rgba(20,18,14,0.06)',
            padding: 6,
            zIndex: 50,
            animation: 'fadeIn 0.15s ease',
          }}
        >
          {/* User block */}
          <div style={{
            padding: '12px 12px 14px',
            display: 'flex', gap: 12, alignItems: 'center',
            borderBottom: '1px solid var(--rule)',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--teal-soft)', color: 'var(--teal-ink)',
              display: 'grid', placeItems: 'center',
              fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 600,
              flexShrink: 0,
            }}>{initials}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 13, fontWeight: 500, color: 'var(--ink)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{name}</div>
              <div style={{
                fontSize: 11, color: 'var(--ink-3)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{email}</div>
              {roleText && (
                <div style={{
                  fontSize: 10, color: 'var(--teal)',
                  marginTop: 3, letterSpacing: '0.05em', textTransform: 'uppercase',
                  fontWeight: 500,
                }}>{roleText}</div>
              )}
            </div>
          </div>

          {/* Menu items */}
          <div style={{ padding: '6px 0' }}>
            <MenuItem onClick={handleAccount}>
              <UserMenuIcon />
              <span>บัญชีของฉัน</span>
            </MenuItem>
          </div>

          <div style={{ height: 1, background: 'var(--rule)', margin: '2px 0' }} />

          <div style={{ padding: '6px 0' }}>
            <MenuItem onClick={() => signOut({ callbackUrl: '/login' })} tone="err">
              <LogoutMenuIcon />
              <span>ออกจากระบบ</span>
            </MenuItem>
          </div>
        </div>
      )}
    </div>
  );
});

function MenuItem({ onClick, children, tone }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', border: 'none',
        background: hover ? 'var(--paper-2)' : 'transparent',
        borderRadius: 6, cursor: 'pointer',
        fontFamily: 'var(--font-sans)', fontSize: 13,
        color: tone === 'err' ? 'var(--clay)' : 'var(--ink)',
        textAlign: 'left',
        transition: 'background 0.12s',
      }}
    >
      {children}
    </button>
  );
}

const UserMenuIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="5" r="2.5" />
    <path d="M2 12c.5-2.2 2.5-3.5 5-3.5s4.5 1.3 5 3.5" />
  </svg>
);

const LogoutMenuIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5.5 2H2.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3M10 9.5l3-2.5-3-2.5M13 7H6" />
  </svg>
);

/* ----------------------- Misc helpers ----------------------- */
export function Chip({ kind, children, style }) {
  return <span className={"chip " + (kind || "")} style={style}>{children}</span>;
}

export function Stat({ label, value, unit, sub }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}{unit && <span className="unit">{unit}</span>}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Delta({ pct, dir }) {
  const sign = dir === "up" ? "▲" : dir === "down" ? "▼" : dir === "flat" ? "—" : "•";
  if (dir === "new") return <span className="delta new">NEW</span>;
  return <span className={"delta " + dir}>{sign} {pct}</span>;
}

export function Spark({ data, w = 80, h = 24, color }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - 2) + 1;
    const y = h - 1 - ((v - min) / range) * (h - 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color || "var(--teal)"}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Av({ initials, kind }) {
  const map = {
    sc:    { bg: "#DEE7E3", fg: "#1F4D40" },
    rr:    { bg: "#F0E4C5", fg: "#6B5121" },
    aw:    { bg: "#EADBD3", fg: "#6B3F2E" },
    np:    { bg: "#E3EAD3", fg: "#3D5224" },
    default: { bg: "#ECE7DA", fg: "#5C5645" }
  };
  const c = map[kind] || map.default;
  return (
    <span className="av" style={{ background: c.bg, color: c.fg }}>{initials}</span>
  );
}

// Scheme allowlist for user/DB-sourced hrefs (e.g. Google Drive links). Only
// http(s) passes; a tampered `javascript:`/`data:` link renders inert (#) so
// a second-order XSS via a poisoned attachment row can't fire.
export function safeHref(url) {
  if (typeof url !== 'string') return undefined;
  return /^https?:\/\//i.test(url.trim()) ? url : undefined;
}

export function money(n, opts = {}) {
  const { decimals = 0, sign = false } = opts;
  if (n == null) return "—";
  const s = (sign && n > 0 ? "+" : "") +
            n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return "฿" + s;
}
