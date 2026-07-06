'use client';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Icons, Chip } from './shell';

/* ===================== Unit matching helpers =====================
   Units can be referred to many ways: code (m³), Thai name (ลูกบาศก์เมตร),
   English name (cubic meter), or any alias (ลบ.ม., คิว, m^3, cu.m). These
   helpers normalize all of those to a common form so search + lookups
   match regardless of which spelling the user types.

   Normalization:
     - lowercase, trim
     - superscripts ² ³ → 2 3
     - caret exponents (m^3 → m3) — strip the caret
     - drop spaces and dots (ลบ.ม. → ลบม, cu.m → cum)
*/
export function normalizeUnitToken(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/\^/g, '')
    .replace(/[\s.]/g, '');
}

// All normalized tokens a unit can be matched by (code + names + aliases).
export function unitTokens(u) {
  const raw = [
    u?.code, u?.name, u?.name_en,
    ...String(u?.aliases || '').split(','),
  ];
  const out = [];
  for (const t of raw) {
    const n = normalizeUnitToken(t);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

// Substring match — for search boxes (typing "คิว" highlights the m³ unit).
export function unitMatches(u, query) {
  const q = normalizeUnitToken(query);
  if (!q) return true;
  return unitTokens(u).some(t => t.includes(q) || q.includes(t));
}

// Exact-ish lookup — for resolving a free-text cell (bulk upload) to a unit.
// Requires an EXACT token match so we never silently assign the wrong unit
// (e.g. "m" must not partial-match "mm"/"cm"/"m2"). The substring search is
// only for the interactive picker (unitMatches), where a human confirms.
export function findUnit(units, query) {
  const q = normalizeUnitToken(query);
  if (!q) return null;
  for (const u of units || []) {
    if (unitTokens(u).includes(q)) return u;
  }
  return null;
}

export const settingsInputStyle = {
  padding: '9px 12px',
  fontSize: 13,
  border: '1px solid var(--rule-2)',
  borderRadius: 6,
  background: 'var(--paper)',
  color: 'var(--ink)',
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
};

/* ===================== Searchable unit picker =====================
   A combobox replacement for the plain <select> unit dropdowns. Lets the
   user type to filter (matching code / Thai+English name / aliases) and
   shows the aliases inline so the right unit is easy to spot — e.g. typing
   "คิว" surfaces "m³ · ลูกบาศก์เมตร · คิว, m^3, ลบ.ม.".

   Props: units, value (unit id), onChange(id), placeholder, allowClear.
*/
export function UnitPicker({ units = [], value, onChange, placeholder = 'เลือก / ค้นหาหน่วย…', allowClear = true }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [rect, setRect] = useState(null); // button viewport rect for fixed dropdown
  const ref = useRef(null);
  const btnRef = useRef(null);
  const inputRef = useRef(null);

  const selected = units.find(u => u.id === value) || null;

  // Position the dropdown with `position: fixed` from the button's viewport
  // rect so it escapes any overflow:hidden/auto ancestor (modals, table
  // cells) that would otherwise clip an absolutely-positioned panel.
  const place = () => { if (btnRef.current) setRect(btnRef.current.getBoundingClientRect()); };

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest?.('[data-unitpicker-panel]')) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => place();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const filtered = useMemo(() => {
    if (!q.trim()) return units;
    return units.filter(u => unitMatches(u, q));
  }, [units, q]);

  function pick(u) {
    onChange?.(u ? u.id : '');
    setOpen(false);
    setQ('');
  }

  const label = selected
    ? `${selected.code ? selected.code + ' · ' : ''}${selected.name || ''}`
    : '';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          ...settingsInputStyle,
          textAlign: 'left', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
          color: selected ? 'var(--ink)' : 'var(--ink-4)',
        }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? label : placeholder}
        </span>
        {selected && allowClear && (
          <span
            onClick={(e) => { e.stopPropagation(); pick(null); }}
            title="ล้าง"
            style={{ color: 'var(--ink-4)', fontSize: 14, padding: '0 2px' }}>×</span>
        )}
        <span style={{ color: 'var(--ink-4)', display: 'inline-flex', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          {Icons.chevronD}
        </span>
      </button>

      {open && rect && (() => {
        // Flip the panel above the button when there's not enough room
        // below the fold (e.g. unit field near the bottom of a modal).
        const PANEL_H = 284;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
        const flipUp = rect.bottom + PANEL_H > vh && rect.top > PANEL_H;
        const pos = flipUp
          ? { bottom: vh - rect.top + 4 }
          : { top: rect.bottom + 4 };
        return (
        <div data-unitpicker-panel style={{
          position: 'fixed',
          ...pos, left: rect.left, width: rect.width,
          background: 'var(--paper)', border: '1px solid var(--rule-2)',
          borderRadius: 8, boxShadow: 'var(--sh-pop)', zIndex: 1000,
          maxHeight: 280, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: 8, borderBottom: '1px solid var(--rule)' }}>
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="พิมพ์ค้นหา เช่น คิว, m^3, ตร.ม.…"
              style={{ ...settingsInputStyle, padding: '7px 10px', fontSize: 12.5 }} />
          </div>
          <div style={{ overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '14px 12px', fontSize: 12.5, color: 'var(--ink-4)', textAlign: 'center' }}>
                ไม่พบหน่วยที่ตรง
              </div>
            ) : filtered.map(u => {
              const aliases = String(u.aliases || '').split(',').map(a => a.trim()).filter(Boolean);
              const isSel = u.id === value;
              return (
                <div
                  key={u.id}
                  onClick={() => pick(u)}
                  style={{
                    padding: '8px 12px', cursor: 'pointer',
                    background: isSel ? 'var(--teal-soft)' : 'transparent',
                    borderBottom: '1px solid var(--rule)',
                  }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = 'var(--paper-2)'; }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span className="font-mono" style={{ fontSize: 12.5, fontWeight: 600, color: isSel ? 'var(--teal-ink)' : 'var(--ink)' }}>{u.code}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{u.name}</span>
                    {u.name_en && <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>· {u.name_en}</span>}
                  </div>
                  {aliases.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                      {aliases.join(' · ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}
    </div>
  );
}

export function SettingsField({ label, required, hint, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500 }}>
        {label} {required && <span style={{ color: 'var(--clay)' }}>*</span>}
      </span>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{hint}</span>}
    </label>
  );
}

export function SettingsModal({ title, eyebrow, onClose, onSave, children, width = 600 }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(20,18,14,0.32)',
        display: 'grid', placeItems: 'center',
        zIndex: 50,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        className="card"
        style={{ width, padding: 0, boxShadow: 'var(--sh-pop)', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--rule)' }}>
          {eyebrow && <div className="eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
          <h3 className="h-section">{title}</h3>
        </div>
        <div style={{ padding: 24, overflowY: 'auto' }}>{children}</div>
        {/* Only render the built-in footer when the caller delegates saving
            via onSave. Modals that render their own action row inside
            children (most of them) leave onSave undefined to avoid a
            duplicate, stacked footer. */}
        {onSave && (
          <div style={{
            padding: '14px 24px', borderTop: '1px solid var(--rule)',
            display: 'flex', justifyContent: 'flex-end', gap: 8,
            background: 'var(--surface-2)',
          }}>
            <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
            <button className="btn primary" onClick={onSave}>{Icons.check} บันทึก</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsStatStrip({ stats }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 0,
      borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)',
      padding: '24px 0', marginBottom: 32,
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{ paddingLeft: i === 0 ? 0 : 28, borderLeft: i === 0 ? 'none' : '1px solid var(--rule)' }}>
          <div className="stat">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SettingsSearchBox({ value, onChange, placeholder = 'ค้นหา…' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
      border: '1px solid var(--rule-2)', borderRadius: 6,
      background: 'var(--surface)', width: 240,
    }}>
      {Icons.search}
      <input
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ flex: 1, border: 0, outline: 0, background: 'transparent', fontSize: 13 }}
      />
    </div>
  );
}

export function StatusPill({ status }) {
  const map = {
    'Active':     { bg: 'var(--moss-soft)', fg: '#2F4A1A', dot: 'var(--moss)' },
    'Non-Active': { bg: 'var(--paper-2)',   fg: 'var(--ink-3)', dot: 'var(--ink-4)' },
    'Closed':     { bg: 'var(--paper-2)',   fg: 'var(--ink-3)', dot: 'var(--ink-4)' },
    'Blacklist':  { bg: 'var(--clay-soft)', fg: '#6B2D1A',     dot: 'var(--clay)' },
    'Planning':   { bg: 'var(--chip-recv-bg)', fg: 'var(--chip-recv-fg)', dot: 'var(--ochre)' },
  };
  const c = map[status] || map['Non-Active'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11, fontWeight: 500, padding: '2px 10px',
      borderRadius: 999, background: c.bg, color: c.fg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c.dot }} />
      {status}
    </span>
  );
}

export function StatusToggle({ options, value, onChange }) {
  return (
    <div style={{ display:'flex', gap:0, border:'1px solid var(--rule-2)', borderRadius:6, overflow:'hidden', width:'fit-content' }}>
      {options.map((opt, i) => (
        <button key={opt} type="button" onClick={() => onChange(opt)} style={{
          padding:'8px 16px', fontSize:13,
          background: value === opt ? 'var(--ink)' : 'var(--surface)',
          color: value === opt ? 'var(--paper)' : 'var(--ink-2)',
          border:'none', cursor:'pointer', fontFamily:'inherit',
          borderRight: i < options.length - 1 ? '1px solid var(--rule-2)' : 'none',
        }}>{opt}</button>
      ))}
    </div>
  );
}

/**
 * Functional bulk upload — user pastes TSV/CSV (from Excel/Sheets) into a
 * textarea, gets a live-validated preview, then uploads each row via POST.
 *
 * Props:
 *   title        — modal title
 *   entity       — short noun shown in copy ("Supplier", "วัสดุ", …)
 *   columns      — [{ key, label, hint?, required?, parse?(raw, ctx)? }]
 *   endpoint     — '/api/...'
 *   transform    — async (parsedRow, ctx) => payload to POST
 *                  ctx: { rowIndex, usedCodes }
 *   sampleRow    — string shown as placeholder (tab-separated example)
 *   onClose, onDone({ ok, fail, errors })
 */
export function BulkUploadModal({ title, entity, columns, endpoint, transform, sampleRow, onClose, onDone }) {
  const [text, setText] = useState('');
  const [progress, setProgress] = useState(null); // null | {done, total, errors}
  const [busy, setBusy] = useState(false);        // disable buttons during xlsx I/O

  // Warm the exceljs chunk (~256KB gzip) while the user is still looking at
  // the modal — the first click on อ่านไฟล์/ดาวน์โหลดแม่แบบ stops stalling.
  useEffect(() => { import('exceljs').catch(() => {}); }, []);

  // Excel column letter for a 0-based index (handles AA+ past column Z).
  const colLetter = (i) => {
    let s = '', n = i;
    do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return s;
  };

  // Template is generated with ExcelJS — SheetJS community edition silently
  // drops data-validation, so dropdowns never actually appeared in Excel.
  // ExcelJS writes real validations referencing the Lookup sheet.
  async function downloadTemplate() {
    setBusy(true);
    try {
      const _xl = await import('exceljs');
      const ExcelJS = _xl.default || _xl;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet((entity || 'Sheet1').slice(0, 28));

      // Header row
      const hr = ws.getRow(1);
      columns.forEach((c, i) => {
        const cell = hr.getCell(i + 1);
        cell.value = c.label + (c.required ? ' *' : '');
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15130E' } };
        ws.getColumn(i + 1).width = Math.max((c.label || '').length + 4, 16);
      });

      // Sample data rows (first line of sampleRow is the header — skip it)
      const sampleLines = (sampleRow || '').split(/\r?\n/).filter(Boolean).slice(1);
      sampleLines.forEach((line, r) => {
        const cells = line.split('\t');
        columns.forEach((_, i) => { ws.getRow(r + 2).getCell(i + 1).value = cells[i] || ''; });
      });

      // Dropdown columns → Lookup sheet + real data validation
      const dropCols = columns
        .map((c, i) => ({ ...c, idx: i }))
        .filter(c => Array.isArray(c.options) && c.options.length > 0);
      if (dropCols.length > 0) {
        const lk = wb.addWorksheet('Lookup');
        dropCols.forEach((c, i) => {
          lk.getRow(1).getCell(i + 1).value = c.label;
          lk.getRow(1).getCell(i + 1).font = { bold: true };
          c.options.forEach((opt, r) => { lk.getRow(r + 2).getCell(i + 1).value = opt; });
          lk.getColumn(i + 1).width = Math.max((c.label || '').length + 4, 24);

          const lkCol = colLetter(i);
          const dataCol = colLetter(c.idx);
          const formula = `Lookup!$${lkCol}$2:$${lkCol}$${c.options.length + 1}`;
          for (let r = 2; r <= 1000; r++) {
            ws.getCell(`${dataCol}${r}`).dataValidation = {
              type: 'list', allowBlank: !c.required,
              formulae: [formula],
              showErrorMessage: true,
              errorTitle: 'ค่าไม่ถูกต้อง',
              error: `กรุณาเลือก ${c.label} จากรายการ`,
            };
          }
        });
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template_${entity}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      alert(`สร้าง Template ไม่สำเร็จ: ${e.message}`);
    }
    setBusy(false);
  }

  async function uploadExcel(file) {
    if (!file) return;
    setBusy(true);
    try {
      // Read with ExcelJS (already used app-wide) instead of the `xlsx`
      // package, which carries an unpatched prototype-pollution + ReDoS
      // advisory and was the app's only remaining use of it.
      const _xl = await import('exceljs');
      const ExcelJS = _xl.default || _xl;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) throw new Error('ไม่พบ sheet ใน Excel');

      // Pull a plain string out of any ExcelJS cell value shape (rich text,
      // hyperlink, formula result, date) — mirrors the old raw:false intent.
      const cellText = (cell) => {
        const v = cell?.value;
        if (v == null) return '';
        if (typeof v === 'object') {
          if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('');
          if (v.text !== undefined) return String(v.text);
          if (v.result !== undefined) return String(v.result);
          if (v instanceof Date) return cell.text || v.toISOString();
          return cell.text || '';
        }
        return String(v);
      };

      // Build array-of-arrays → TSV, matching the previous pipeline exactly.
      // Only read the first worksheet (a Lookup sheet, if present, is ignored).
      const lines = [];
      const maxCol = ws.columnCount || 0;
      ws.eachRow({ includeEmpty: false }, (row) => {
        const cells = [];
        for (let c = 1; c <= maxCol; c++) {
          cells.push(cellText(row.getCell(c)).replace(/[\t\r\n]+/g, ' '));
        }
        if (cells.some(x => x.trim() !== '')) lines.push(cells.join('\t'));
      });
      setText(lines.join('\n'));
    } catch (e) {
      alert(`อ่านไฟล์ Excel ไม่สำเร็จ: ${e.message}`);
    }
    setBusy(false);
  }

  const parsed = React.useMemo(() => {
    const lines = text.split(/\r?\n/).map(l => l.replace(/\s+$/, '')).filter(l => l.trim());
    if (lines.length === 0) return [];
    // Auto-detect separator: tab wins, then comma
    const sep = lines[0].includes('\t') ? '\t' : ',';
    // Quote-aware splitter — CSV cells like "บจก. เอ, บี" must stay one cell.
    // Handles doubled quotes ("") inside quoted fields. Tab-separated input
    // passes through the same path harmlessly.
    const splitLine = (line) => {
      const out = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQ) {
          if (ch === '"') {
            if (line[i + 1] === '"') { cur += '"'; i++; }
            else inQ = false;
          } else cur += ch;
        } else if (ch === '"' && cur === '') {
          inQ = true;
        } else if (ch === sep) {
          out.push(cur); cur = '';
        } else cur += ch;
      }
      out.push(cur);
      return out.map(c => c.trim());
    };
    // Header detection — tolerant of the " *" suffix on required columns in
    // the downloaded template + whitespace. We match each header cell to an
    // expected label ANYWHERE in the row (not positionally), so a reordered
    // template still maps every value to the right field.
    const norm = (s) => String(s || '').replace(/\s*\*\s*$/, '').trim().toLowerCase();
    const first = splitLine(lines[0]).map(norm);
    const labels = columns.map(c => norm(c.label));
    // colIdx[i] = which cell index holds columns[i]'s data
    const colIdx = labels.map(lbl => first.indexOf(lbl));
    const matched = colIdx.filter(i => i >= 0).length;
    const hasHeader = labels.length > 0 && matched >= Math.ceil(labels.length / 2);
    // When the header is recognized, use the label→index map (falling back
    // to position for any unmatched column); otherwise assume positional.
    const indexFor = (i) => (hasHeader && colIdx[i] >= 0) ? colIdx[i] : i;
    const dataLines = hasHeader ? lines.slice(1) : lines;
    return dataLines.map((line, idx) => {
      const cells = splitLine(line);
      const row = {};
      const errs = [];
      columns.forEach((col, i) => {
        const raw = cells[indexFor(i)] || '';
        row[col.key] = raw;
        if (col.required && !raw) errs.push(`${col.label}: ว่าง`);
      });
      // Guard: a stray header row pasted mid-data (every cell equals its
      // expected label) should never be imported as a record.
      const looksLikeHeader = columns.every((col, i) => norm(row[col.key]) === labels[i] || !row[col.key]);
      if (looksLikeHeader && columns.some((col) => norm(row[col.key]))) {
        errs.unshift('แถวหัวตาราง — ข้าม');
      }
      return { lineNo: idx + 1, row, err: errs.length ? errs.join(' · ') : null };
    });
  }, [text, columns]);

  const validRows = parsed.filter(r => !r.err);

  async function upload() {
    const errors = [];
    setProgress({ done: 0, total: validRows.length, errors });
    const usedCodes = [];
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      try {
        const payload = await transform(r.row, { rowIndex: i, usedCodes });
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          errors.push(`แถวที่ ${r.lineNo}: ${d.error || 'บันทึกไม่สำเร็จ'}`);
        } else if (payload.code) {
          usedCodes.push(payload.code);
        }
      } catch (e) {
        errors.push(`แถวที่ ${r.lineNo}: ${e.message || 'ผิดพลาด'}`);
      }
      setProgress({ done: i + 1, total: validRows.length, errors: [...errors] });
    }
    onDone?.({ ok: validRows.length - errors.length, fail: errors.length, errors });
  }

  const uploadingNow = progress && progress.done < progress.total;
  const uploadDone   = progress && progress.done >= progress.total;
  // Editing the data after a completed run re-arms the import button
  // (e.g. fixing the rows that failed) — without this the modal would have
  // to be closed and reopened.
  useEffect(() => {
    if (uploadDone) setProgress(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div onClick={uploadingNow ? undefined : onClose} style={{
      position:'fixed', inset:0, background:'rgba(20,18,14,0.32)',
      display:'grid', placeItems:'center', zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} className="card"
           style={{ width: 820, padding:0, boxShadow:'var(--sh-pop)', maxHeight:'92vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)' }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>เพิ่ม{entity}จำนวนมาก</div>
          <h3 className="h-section">{title || `Bulk Upload — ${entity}`}</h3>
        </div>

        <div style={{ padding:24, overflowY:'auto', flex:1 }}>
          {/* Excel template + upload — primary path for non-technical users.
              Paste-from-clipboard is still available below as a fallback. */}
          <div style={{
            display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16,
          }}>
            <button className="btn" onClick={downloadTemplate} disabled={busy}
              style={{ justifyContent:'center', padding:'14px' }}>
              {Icons.download}
              <span style={{ display:'inline-flex', flexDirection:'column', alignItems:'flex-start', marginLeft:8 }}>
                <span style={{ fontWeight:500 }}>ดาวน์โหลด Template</span>
                <span style={{ fontSize:11, color:'var(--ink-3)' }}>template_{entity}.xlsx</span>
              </span>
            </button>
            <label className="btn" style={{ justifyContent:'center', padding:'14px', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              {Icons.upload}
              <span style={{ display:'inline-flex', flexDirection:'column', alignItems:'flex-start', marginLeft:8 }}>
                <span style={{ fontWeight:500 }}>อัพโหลดไฟล์ Excel</span>
                <span style={{ fontSize:11, color:'var(--ink-3)' }}>.xlsx / .xls / .csv</span>
              </span>
              <input type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                disabled={busy}
                onChange={e => { uploadExcel(e.target.files?.[0]); e.target.value = ''; }}
                style={{ display:'none' }} />
            </label>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:10, margin:'4px 0 12px' }}>
            <div style={{ flex:1, height:1, background:'var(--rule)' }} />
            <span style={{ fontSize:11, color:'var(--ink-4)', letterSpacing:0.4 }}>หรือ วาง TSV/CSV ด้านล่าง</span>
            <div style={{ flex:1, height:1, background:'var(--rule)' }} />
          </div>

          <p style={{ fontSize:12.5, color:'var(--ink-3)', margin:'0 0 12px', lineHeight:1.6 }}>
            คัดลอกข้อมูลจาก Excel / Google Sheets แล้ววางช่องด้านล่าง · 1 แถว = 1 รายการ ·
            แท็บ (Tab) คั่นคอลัมน์ (Excel paste แบบนี้อยู่แล้ว) หรือใช้คอมม่า
          </p>

          <div className="eyebrow" style={{ marginBottom:6 }}>ลำดับคอลัมน์ที่ต้องวาง</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
            {columns.map((c, i) => (
              <span key={i} style={{
                padding:'4px 10px', borderRadius:4, fontSize:11.5,
                background: c.required ? 'var(--clay-soft)' : 'var(--paper-2)',
                color: c.required ? '#6B2D1A' : 'var(--ink-2)',
                fontWeight:500,
              }}>
                {i+1}. {c.label}{c.required && ' *'}
                {c.hint && <span style={{ color:'var(--ink-4)', marginLeft:6 }}>({c.hint})</span>}
              </span>
            ))}
          </div>

          <textarea value={text} onChange={e=>setText(e.target.value)}
            placeholder={sampleRow || columns.map(c=>c.label).join('\t')}
            spellCheck={false}
            style={{
              width:'100%', minHeight:160, padding:12, fontSize:12,
              fontFamily:'var(--font-mono)', border:'1px solid var(--rule-2)',
              borderRadius:6, background:'var(--paper)', resize:'vertical', outline:'none',
            }} />

          {parsed.length > 0 && (
            <>
              <div style={{ display:'flex', gap:14, marginTop:14, fontSize:12 }}>
                <span style={{ color:'var(--ink-3)' }}>
                  แถวทั้งหมด <strong style={{ color:'var(--ink)' }}>{parsed.length}</strong>
                </span>
                <span style={{ color:'var(--moss)' }}>
                  ✓ พร้อมอัพโหลด <strong>{validRows.length}</strong>
                </span>
                {parsed.length - validRows.length > 0 && (
                  <span style={{ color:'var(--clay)' }}>
                    ⚠ ข้อมูลขาด <strong>{parsed.length - validRows.length}</strong>
                  </span>
                )}
              </div>

              <div style={{ border:'1px solid var(--rule)', borderRadius:6, marginTop:10, maxHeight:240, overflowY:'auto' }}>
                <table className="tbl" style={{ fontSize:12 }}>
                  <thead>
                    <tr>
                      <th style={{ width:32 }}>#</th>
                      {columns.map((c,i) => <th key={i}>{c.label}</th>)}
                      <th style={{ width:120 }}>ผลตรวจสอบ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((r) => (
                      <tr key={r.lineNo} style={{ background: r.err ? '#FDF3EE' : undefined }}>
                        <td style={{ color:'var(--ink-3)' }}>{r.lineNo}</td>
                        {columns.map((c,i) => (
                          <td key={i} style={{ fontSize:11.5, color:'var(--ink-2)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {r.row[c.key] || <span style={{ color:'var(--ink-4)' }}>—</span>}
                          </td>
                        ))}
                        <td style={{ fontSize:11 }}>
                          {r.err ? <span style={{ color:'var(--clay)' }}>⚠ {r.err}</span> : <span style={{ color:'var(--moss)' }}>✓ พร้อม</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {progress && (
            <div style={{ marginTop:14, padding:'12px 14px', background:'var(--surface-2)', border:'1px solid var(--rule)', borderRadius:6, fontSize:12.5 }}>
              <div style={{ marginBottom:6 }}>
                กำลังนำเข้า… <strong>{progress.done}</strong> / {progress.total}
              </div>
              {progress.errors.length > 0 && (
                <div style={{ marginTop:8, color:'var(--clay)', fontSize:11.5, maxHeight:90, overflowY:'auto' }}>
                  {progress.errors.map((e,i) => <div key={i}>· {e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--surface-2)' }}>
          <div style={{ fontSize:12, color:'var(--ink-3)' }}>
            {progress && progress.done === progress.total
              ? `เสร็จสิ้น — สำเร็จ ${progress.total - progress.errors.length} · ล้มเหลว ${progress.errors.length}`
              : 'พร้อมนำเข้า'}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn ghost" onClick={onClose} disabled={uploadingNow}>
              {uploadDone ? 'ปิด' : 'ยกเลิก'}
            </button>
            <button className="btn primary"
              disabled={busy || validRows.length === 0 || uploadingNow || uploadDone}
              onClick={upload}>
              {Icons.upload} {uploadDone ? 'นำเข้าแล้ว' : `นำเข้า ${validRows.length > 0 ? `${validRows.length} รายการ` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
