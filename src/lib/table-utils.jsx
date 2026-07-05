'use client';

import React, { useState, useMemo } from 'react';

/*
  Shared table helpers (P3): client-side sort + pagination + CSV export.
  All list screens already load full result sets, so paging/sorting client-side
  keeps behaviour identical while making big tables usable. Swap the data
  source to server-side later without touching the consuming markup.

  Usage:
    const { view, page, pages, setPage, sortKey, sortDir, toggleSort } =
      useTableView(rows, { pageSize: 25, defaultSort: 'date', defaultDir: 'desc' });
    <Th sortKey="name" {...sortProps}>วัสดุ</Th> …
    <Pager page={page} pages={pages} setPage={setPage} total={rows.length} />
*/

export function useTableView(rows, { pageSize = 25, defaultSort = null, defaultDir = 'asc' } = {}) {
  const [page, setPage]       = useState(1);
  const [sortKey, setSortKey] = useState(defaultSort);
  const [sortDir, setSortDir] = useState(defaultDir);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const dir = sortDir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;   // nulls always sink
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'th') * dir;
    });
  }, [rows, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pages);
  const view = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize]
  );

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  }

  return { view, page: safePage, pages, setPage, sortKey, sortDir, toggleSort, total: rows.length };
}

// Sortable <th>. Spread `thProps(key)` from the consuming screen or pass
// explicit props; keeps the app's existing table look.
export function Th({ children, sortKey: key, activeKey, dir, onSort, className, style }) {
  const active = key && key === activeKey;
  return (
    <th
      className={className}
      onClick={key ? () => onSort(key) : undefined}
      style={{ cursor: key ? 'pointer' : undefined, userSelect: 'none', whiteSpace: 'nowrap', ...style }}
      title={key ? 'คลิกเพื่อเรียง' : undefined}
    >
      {children}
      {key && (
        <span style={{ marginLeft: 4, fontSize: 9, opacity: active ? 1 : 0.35 }}>
          {active ? (dir === 'asc' ? '▲' : '▼') : '▲'}
        </span>
      )}
    </th>
  );
}

export function Pager({ page, pages, setPage, total }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12,
                  padding: '12px 16px', borderTop: '1px solid var(--rule)', fontSize: 12.5 }}>
      <span style={{ color: 'var(--ink-3)' }}>{total} รายการ · หน้า {page}/{pages}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="btn sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
          style={{ opacity: page <= 1 ? 0.4 : 1 }}>← ก่อนหน้า</button>
        <button className="btn sm" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}
          style={{ opacity: page >= pages ? 0.4 : 1 }}>ถัดไป →</button>
      </div>
    </div>
  );
}

// CSV export with a UTF-8 BOM so Thai text opens correctly in Excel.
// columns: [{ key, label }] — value taken from row[key] (or fn(row) if key is a function).
export function exportCSV(filename, columns, rows) {
  const esc = v => {
    let s = v == null ? '' : String(v);
    // Formula-injection guard: a cell starting with = + - @ (or tab/CR) is
    // executed as a formula by Excel/Sheets. Prefix with a single quote so a
    // supplier name like =HYPERLINK(...) stays inert text.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map(c => esc(c.label)).join(',');
  const body = rows.map(r =>
    columns.map(c => esc(typeof c.key === 'function' ? c.key(r) : r[c.key])).join(',')
  ).join('\n');
  const blob = new Blob(['\ufeff' + head + '\n' + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
