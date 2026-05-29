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
// Prefers an exact token equality; falls back to substring containment.
export function findUnit(units, query) {
  const q = normalizeUnitToken(query);
  if (!q) return null;
  let partial = null;
  for (const u of units || []) {
    const tokens = unitTokens(u);
    if (tokens.includes(q)) return u;                 // exact
    if (!partial && tokens.some(t => t.includes(q) || q.includes(t))) partial = u;
  }
  return partial;
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
  const ref = useRef(null);
  const inputRef = useRef(null);

  const selected = units.find(u => u.id === value) || null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    // focus the search box when opening
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
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

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--paper)', border: '1px solid var(--rule-2)',
          borderRadius: 8, boxShadow: 'var(--sh-pop)', zIndex: 60,
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
      )}
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

export function MultiSelectChips({ options, value, onChange, placeholder = 'เลือกหมวด…' }) {
  const has = (opt) => value.includes(opt);
  const toggle = (opt) => onChange(has(opt) ? value.filter(v => v !== opt) : [...value, opt]);

  return (
    <div style={{
      border:'1px solid var(--rule-2)', borderRadius:6, background:'var(--paper)',
      padding: value.length > 0 ? '8px 10px 6px' : '0',
      minHeight: 38, display:'flex', flexDirection:'column', gap:8,
    }}>
      {value.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {value.map(v => (
            <span key={v} style={{
              display:'inline-flex', alignItems:'center', gap:6,
              padding:'3px 6px 3px 10px', borderRadius:4,
              background:'var(--teal-soft)', color:'var(--teal-ink)',
              fontSize:12, fontWeight:500,
            }}>
              {v}
              <button type="button" onClick={() => toggle(v)} style={{
                background:'transparent', border:0, padding:'0 2px', cursor:'pointer',
                color:'var(--teal-ink)', fontSize:14, lineHeight:1, fontFamily:'inherit',
              }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{
        display:'flex', flexWrap:'wrap', gap:4,
        padding: value.length > 0 ? '4px 0 2px' : '8px 10px',
        borderTop: value.length > 0 ? '1px dashed var(--rule)' : 'none',
      }}>
        {value.length === 0 && (
          <span style={{ fontSize:12, color:'var(--ink-4)', marginRight:6, alignSelf:'center' }}>{placeholder}</span>
        )}
        {options.map(opt => has(opt) ? null : (
          <button key={opt} type="button" onClick={() => toggle(opt)} style={{
            padding:'3px 9px', fontSize:11.5, fontFamily:'inherit',
            border:'1px solid var(--rule)', borderRadius:4,
            background:'transparent', color:'var(--ink-2)', cursor:'pointer',
          }}>+ {opt}</button>
        ))}
      </div>
    </div>
  );
}

export function BulkExcelButton({ label = 'Bulk Excel', entity, columns, sampleRows = [] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        {Icons.upload} {label}
      </button>
      {open && <BulkExcelModal entity={entity} columns={columns} sampleRows={sampleRows} onClose={() => setOpen(false)} />}
    </>
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

  // Dynamic-import xlsx so the ~600KB lib doesn't hit users who never touch
  // bulk upload. The lib is loaded once per modal open, browser-cached after.
  async function downloadTemplate() {
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const headers = columns.map(c => c.label + (c.required ? ' *' : ''));
      const sampleLines = (sampleRow || '').split(/\r?\n/).filter(Boolean);
      // First sample line is usually the header — skip it. Remaining lines
      // become example data rows in the template.
      const dataRows = sampleLines.slice(1).map(line => {
        const cells = line.split('\t');
        return columns.map((_, i) => cells[i] || '');
      });
      const aoa = [headers, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = columns.map(c => ({ wch: Math.max((c.label || '').length, 16) }));
      const wb = XLSX.utils.book_new();

      // Any column carrying an `options` array becomes a dropdown via a
      // shared "Lookup" sheet. We attach Excel data-validation that
      // references the Lookup sheet so a user can pick from a list when
      // editing the template in Excel / Google Sheets / Numbers.
      const dropCols = columns
        .map((c, i) => ({ ...c, idx: i }))
        .filter(c => Array.isArray(c.options) && c.options.length > 0);

      if (dropCols.length > 0) {
        const maxLen = Math.max(...dropCols.map(c => c.options.length));
        const lookupAoA = [dropCols.map(c => c.label)];
        for (let r = 0; r < maxLen; r++) {
          lookupAoA.push(dropCols.map(c => c.options[r] || ''));
        }
        const wsLookup = XLSX.utils.aoa_to_sheet(lookupAoA);
        wsLookup['!cols'] = dropCols.map(c => ({ wch: Math.max((c.label || '').length, 24) }));
        XLSX.utils.book_append_sheet(wb, wsLookup, 'Lookup');

        // SheetJS community supports writing the `!dataValidation` array.
        // Reference a column on the Lookup sheet so the list is shared
        // across all data rows and can be extended later by editing Lookup.
        ws['!dataValidation'] = dropCols.map((c, i) => {
          const lookupCol = String.fromCharCode(65 + i);            // A, B, …
          const colLetter = String.fromCharCode(65 + c.idx);
          return {
            sqref: `${colLetter}2:${colLetter}1000`,
            type: 'list',
            allowBlank: !c.required,
            formula1: `Lookup!$${lookupCol}$2:$${lookupCol}$${maxLen + 1}`,
            showErrorMessage: true,
            errorTitle: 'ค่าไม่ถูกต้อง',
            error: `กรุณาเลือก ${c.label} จากชีต "Lookup"`,
          };
        });
      }

      XLSX.utils.book_append_sheet(wb, ws, entity.slice(0, 28) || 'Sheet1');
      XLSX.writeFile(wb, `template_${entity}.xlsx`);
    } catch (e) {
      alert(`สร้าง Template ไม่สำเร็จ: ${e.message}`);
    }
    setBusy(false);
  }

  async function uploadExcel(file) {
    if (!file) return;
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error('ไม่พบ sheet ใน Excel');
      // header:1 → array-of-arrays so we can reuse the existing TSV parser
      // raw:false → format dates / numbers as strings (so they survive
      // the TSV round-trip without losing precision)
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, raw: false, defval: '' });
      // Convert AoA → TSV string and feed into the existing preview/parse
      // pipeline. Strip cells of tabs/newlines so the round-trip survives.
      const tsv = rows.map(r =>
        r.map(c => String(c ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t')
      ).join('\n');
      setText(tsv);
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
    // Header detection — tolerant of:
    //   • trailing " *" we add to required cols in the downloaded template
    //   • surrounding whitespace
    //   • the user reordering / renaming a column or two
    // We count how many cells in row 1 match the expected column labels;
    // if at least half match, we treat row 1 as a header and skip it.
    const norm = (s) => String(s || '').replace(/\s*\*\s*$/, '').trim().toLowerCase();
    const first = lines[0].split(sep).map(norm);
    const labels = columns.map(c => norm(c.label));
    let matches = 0;
    for (let i = 0; i < Math.min(first.length, labels.length); i++) {
      if (first[i] && first[i] === labels[i]) matches++;
    }
    const hasHeader = labels.length > 0 && matches >= Math.ceil(labels.length / 2);
    const dataLines = hasHeader ? lines.slice(1) : lines;
    return dataLines.map((line, idx) => {
      const cells = line.split(sep).map(c => c.trim());
      const row = {};
      const errs = [];
      columns.forEach((col, i) => {
        const raw = cells[i] || '';
        row[col.key] = raw;
        if (col.required && !raw) errs.push(`${col.label}: ว่าง`);
      });
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

  return (
    <div onClick={onClose} style={{
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
            <button className="btn ghost" onClick={onClose} disabled={progress && progress.done < progress.total}>
              {progress && progress.done === progress.total ? 'ปิด' : 'ยกเลิก'}
            </button>
            <button className="btn primary"
              disabled={busy || validRows.length === 0 || (progress && progress.done < progress.total)}
              onClick={upload}>
              {Icons.upload} นำเข้า {validRows.length > 0 ? `${validRows.length} รายการ` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BulkExcelModal({ entity, columns, sampleRows, onClose }) {
  const [step, setStep] = useState(1);
  const [filename, setFilename] = useState('');

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(20,18,14,0.32)',
      display:'grid', placeItems:'center', zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} className="card"
           style={{ width: 720, padding:0, boxShadow:'var(--sh-pop)', maxHeight:'88vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)' }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>เพิ่ม{entity}จำนวนมาก</div>
          <h3 className="h-section">Bulk Excel — Import {entity}</h3>
        </div>

        <div style={{ display:'flex', borderBottom:'1px solid var(--rule)', background:'var(--surface-2)' }}>
          {[
            { n:1, label:'ดาวน์โหลด Template' },
            { n:2, label:'กรอกข้อมูลและอัพโหลด' },
            { n:3, label:'ตรวจสอบและยืนยัน' },
          ].map((s, i, arr) => {
            const isCur = step === s.n;
            const isDone = step > s.n;
            return (
              <div key={s.n} style={{
                flex:1, padding:'14px 20px',
                borderRight: i < arr.length - 1 ? '1px solid var(--rule)' : 'none',
                display:'flex', alignItems:'center', gap:10,
                color: isCur ? 'var(--ink)' : isDone ? 'var(--ink-3)' : 'var(--ink-4)',
                fontWeight: isCur ? 500 : 400, fontSize:12.5,
              }}>
                <span style={{
                  width:22, height:22, borderRadius:999,
                  background: isCur ? 'var(--teal)' : isDone ? 'var(--teal-soft)' : 'var(--rule)',
                  color: isCur ? 'var(--paper)' : 'var(--teal-ink)',
                  display:'inline-grid', placeItems:'center', fontSize:11, fontWeight:600, flexShrink:0,
                }}>{isDone ? '✓' : s.n}</span>
                {s.label}
              </div>
            );
          })}
        </div>

        <div style={{ padding:24, overflowY:'auto' }}>
          {step === 1 && (
            <div>
              <p style={{ fontSize:13.5, color:'var(--ink-2)', margin:'0 0 16px', lineHeight:1.6 }}>
                ดาวน์โหลดไฟล์ Template Excel ที่มีคอลัมน์มาตรฐาน — เปิดด้วย Excel / Google Sheets แล้วกรอกข้อมูลทีละแถว · 1 แถว = 1 รายการ
              </p>
              <div className="eyebrow" style={{ marginBottom:8 }}>คอลัมน์ใน Template</div>
              <div style={{ border:'1px solid #D6CFBC', borderRadius:6, overflow:'hidden', background:'#FCFAF5', marginBottom:16 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11.5, fontFamily:'var(--font-mono)' }}>
                  <thead>
                    <tr style={{ background:'#E8E3D6' }}>
                      <th style={{ width:32, padding:'6px 8px', fontSize:10, color:'var(--ink-2)', textAlign:'center', borderRight:'1px solid #D6CFBC' }}></th>
                      {columns.map((c, i) => (
                        <th key={i} style={{ padding:'6px 10px', fontSize:10, color:'var(--ink-2)', textAlign:'left', borderRight: i < columns.length - 1 ? '1px solid #D6CFBC' : 'none', fontWeight:500 }}>
                          {String.fromCharCode(65 + i)} · {c.name}
                          {c.required && <span style={{ color:'var(--clay)', marginLeft:4 }}>*</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleRows.slice(0,3).map((row, ri) => (
                      <tr key={ri} style={{ borderTop:'1px solid #E5DFD0', background: ri % 2 ? '#FAF7F0' : '#FCFAF5' }}>
                        <td style={{ padding:'6px 8px', color:'var(--ink-4)', borderRight:'1px solid #E5DFD0', textAlign:'center', fontSize:10 }}>{ri+2}</td>
                        {columns.map((c, ci) => (
                          <td key={ci} style={{ padding:'6px 10px', color:'var(--ink-2)', borderRight: ci < columns.length - 1 ? '1px solid #E5DFD0' : 'none', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:160 }}>
                            {row[c.key] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {[...Array(2)].map((_,i) => (
                      <tr key={'e'+i} style={{ borderTop:'1px solid #E5DFD0', height:24 }}>
                        <td style={{ padding:'4px 8px', color:'var(--ink-4)', borderRight:'1px solid #E5DFD0', textAlign:'center', fontSize:10 }}>{sampleRows.length+i+2}</td>
                        {columns.map((c, ci) => <td key={ci} style={{ borderRight: ci < columns.length - 1 ? '1px solid #E5DFD0' : 'none' }}></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display:'flex', gap:12, alignItems:'center', padding:'14px 16px', background:'var(--surface-2)', border:'1px solid var(--rule)', borderRadius:6 }}>
                <div style={{
                  width:36, height:44, background:'#1F6F47', color:'#fff',
                  borderRadius:3, display:'grid', placeItems:'center',
                  fontSize:9, fontWeight:600, letterSpacing:0.5, flexShrink:0,
                }}>XLSX</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>Template_{entity}.xlsx</div>
                  <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>
                    {columns.length} คอลัมน์ · มีตัวอย่างและ data validation
                  </div>
                </div>
                <button className="btn primary" onClick={() => setStep(2)}>{Icons.download} ดาวน์โหลด</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p style={{ fontSize:13.5, color:'var(--ink-2)', margin:'0 0 16px', lineHeight:1.6 }}>
                เปิดไฟล์ที่ดาวน์โหลด กรอกข้อมูล จากนั้นลากไฟล์มาวางที่นี่ หรือกดเลือกไฟล์
              </p>
              <label style={{
                display:'block', padding:'40px 24px',
                border:'2px dashed var(--rule-2)', borderRadius:8,
                background:'var(--surface-2)', textAlign:'center', cursor:'pointer',
                marginBottom:16,
              }}>
                <div style={{ fontSize:32, color:'var(--ink-4)', marginBottom:8 }}>↑</div>
                <div style={{ fontSize:13, fontWeight:500, color:'var(--ink-2)', marginBottom:4 }}>
                  ลากไฟล์ Excel มาที่นี่ หรือ <span style={{ color:'var(--teal)', textDecoration:'underline' }}>เลือกไฟล์</span>
                </div>
                <div style={{ fontSize:11, color:'var(--ink-3)' }}>รองรับ .xlsx · ไม่เกิน 10 MB</div>
                <input type="file" accept=".xlsx,.xls" style={{ display:'none' }}
                       onChange={e => { setFilename(e.target.files?.[0]?.name || 'data.xlsx'); setStep(3); }} />
              </label>
              <button className="btn ghost sm" onClick={() => { setFilename(`${entity}_sample.xlsx`); setStep(3); }}>
                ใช้ข้อมูลตัวอย่าง (สำหรับ Demo)
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{
                padding:'14px 16px', background:'var(--moss-soft)',
                border:'1px solid var(--moss)', borderRadius:6, marginBottom:20,
                display:'flex', gap:12, alignItems:'center',
              }}>
                <span style={{ color:'var(--moss)' }}>{Icons.check}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'#2F4A1A' }}>ตรวจสอบไฟล์เรียบร้อย — พบ {sampleRows.length} รายการ</div>
                  <div style={{ fontSize:11.5, color:'#2F4A1A', marginTop:2 }}>{filename} · ไม่พบข้อผิดพลาด · พร้อมนำเข้า</div>
                </div>
              </div>
              <div className="eyebrow" style={{ marginBottom:8 }}>ตัวอย่างข้อมูลที่จะนำเข้า</div>
              <div style={{ border:'1px solid var(--rule)', borderRadius:6, overflow:'hidden', marginBottom:8 }}>
                <table className="tbl" style={{ fontSize:12 }}>
                  <thead>
                    <tr>
                      <th style={{ width:32 }}>#</th>
                      {columns.slice(0,4).map((c,i) => <th key={i}>{c.name}</th>)}
                      <th style={{ width:80 }}>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampleRows.map((row, i) => (
                      <tr key={i}>
                        <td style={{ color:'var(--ink-3)' }}>{i+1}</td>
                        {columns.slice(0,4).map((c,ci) => (
                          <td key={ci} style={{ fontSize:11.5, color:'var(--ink-2)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {row[c.key] || '—'}
                          </td>
                        ))}
                        <td><Chip kind="active">{Icons.check} OK</Chip></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize:11, color:'var(--ink-3)' }}>
                * ระบบจะ Auto-Run รหัสให้ทุกรายการเมื่อกด "นำเข้าทั้งหมด"
              </div>
            </div>
          )}
        </div>

        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--surface-2)' }}>
          <div style={{ fontSize:12, color:'var(--ink-3)' }}>
            {step === 1 && 'ขั้นตอนที่ 1 จาก 3'}
            {step === 2 && 'ขั้นตอนที่ 2 จาก 3'}
            {step === 3 && `พร้อมนำเข้า ${sampleRows.length} รายการ`}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {step > 1 && <button className="btn ghost" onClick={() => setStep(step - 1)}>{Icons.back} ก่อนหน้า</button>}
            {step < 3
              ? <button className="btn" onClick={onClose}>ยกเลิก</button>
              : (
                <>
                  <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
                  <button className="btn primary" onClick={onClose}>{Icons.check} นำเข้าทั้งหมด</button>
                </>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
