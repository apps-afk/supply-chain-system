'use client';
import React, { useState, useId, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';

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

/* ----------------------- Company Logo ----------------------- */
export function InitialEstateLogo({ width = 148, style }) {
  const uid = useId().replace(/:/g, '-');
  const clipId = `ie-n${uid}`;
  const h = Math.round(width * 46 / 148);
  return (
    <svg width={width} height={h} viewBox="0 0 148 46" fill="none" aria-label="Initial Estate" style={style}>
      <defs>
        <clipPath id={clipId}>
          <path d="M6 -4 L23 -4 L29 37 L12 37 Z" />
        </clipPath>
      </defs>
      {/* Gold INITIAL wordmark */}
      <text x="0" y="28"
        fontFamily="'IBM Plex Serif', Georgia, 'Times New Roman', serif"
        fontSize="26" fontWeight="600" fill="#C09535">
        INITIAL
      </text>
      {/* Navy swoosh ribbon through N */}
      <path d="M6 -4 L23 -4 L29 37 L12 37 Z" fill="#2B3060" />
      {/* INITIAL in paper, clipped to swoosh area */}
      <g clipPath={`url(#${clipId})`}>
        <text x="0" y="28"
          fontFamily="'IBM Plex Serif', Georgia, 'Times New Roman', serif"
          fontSize="26" fontWeight="600" fill="#F5EFE2">
          INITIAL
        </text>
      </g>
      {/* ESTATE CO.,LTD. subtitle */}
      <text x="0.5" y="42"
        fontFamily="'IBM Plex Serif', Georgia, serif"
        fontSize="7.5" fontWeight="500" fill="#2B3060" letterSpacing="2.6">
        ESTATE CO.,LTD.
      </text>
    </svg>
  );
}


/* ----------------------- Sidebar ----------------------- */
// Defined outside Sidebar so React keeps a stable component identity and
// doesn't remount every nav item on each parent re-render.
function SideItem({ id, icon, label, count, current, onNav }) {
  return (
    <div
      className={"side-item" + (current === id ? " active" : "")}
      onClick={() => onNav(id)}
    >
      {Icons[icon]}
      <span>{label}</span>
      {count != null && <span className="count">{count}</span>}
    </div>
  );
}

function SidebarImpl({ current, onNav }) {
  const Item = (props) => <SideItem {...props} current={current} onNav={onNav} />;
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
        <Item id="contract" icon="contract" label="สัญญา" />
      </div>

      <div className="side-group">
        <div className="side-group-label">ตั้งค่า · ข้อมูลหลัก</div>
        <Item id="projects"       icon="folder"    label="โครงการ" />
        <Item id="project-types"  icon="folder"    label="ประเภทโครงการ" />
        <Item id="suppliers"      icon="truck"     label="ผู้ขาย/ผู้รับเหมา" />
        <Item id="materials"      icon="box"       label="วัสดุก่อสร้าง" />
        <Item id="subcontracts"   icon="hammer"    label="งานจ้างเหมา" />
        <Item id="contract-types" icon="fileCheck" label="ประเภทสัญญา" />
        <Item id="units"          icon="ruler"     label="หน่วยนับ" />
        <Item id="approval-roles" icon="fileCheck" label="ตำแหน่งผู้อนุมัติ" />
      </div>

      {/* Bottom group: admin functions — pushed to bottom via marginTop:auto.
          User identity + logout moved to Topbar avatar dropdown (UserMenu). */}
      <div className="side-group" style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--rule)' }}>
        <div className="side-group-label">ระบบ</div>
        <Item id="workspace" icon="settings"  label="ตั้งค่าพื้นที่ทำงาน" />
        <Item id="team"      icon="fileCheck" label="ทีมงานและสิทธิ์" />
      </div>
    </aside>
  );
}
// React.memo so the sidebar doesn't re-render when only the current screen's
// inner state changes (App passes stable `current` + memoised `onNav`).
export const Sidebar = React.memo(SidebarImpl);

/* ----------------------- Topbar ----------------------- */
function TopbarImpl({ crumbs, onNav }) {
  return (
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
        <div className="search">
          {Icons.search}
          <input placeholder="ค้นหา RFQ, วัสดุ, ผู้ขาย…" />
          <span className="kbd">⌘K</span>
        </div>
        <button className="btn ghost" title="แจ้งเตือน" style={{ padding: 8 }}>
          {Icons.bell}
        </button>
        <UserMenu onNav={onNav} />
      </div>
    </div>
  );
}
// Memoised so it doesn't re-render when the inner screen state changes
// (App passes stable crumbs from a module-scope object and a memoised onNav).
export const Topbar = React.memo(TopbarImpl);

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

export function money(n, opts = {}) {
  const { decimals = 0, sign = false } = opts;
  if (n == null) return "—";
  const s = (sign && n > 0 ? "+" : "") +
            n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return "฿" + s;
}
