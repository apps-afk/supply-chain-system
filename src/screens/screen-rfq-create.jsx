'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Icons, Chip, Av } from '../lib/shell';
import { UnitPicker } from '../lib/settings-shared';

/*
  Create RFQ — full build flow on one page.

  Flow per spec:
    1. Auto-run RFQ document code
    2. Select Supplier
    3. For each item: Source (Material | SubContract) → Category → Item → Qty + Unit
    4. Supplier-fill conditions (5)
    5. Submit → RFQ row saved, Excel preview generated

  Catalog is built live from the master tables:
    Material    : material_main_categories → material_sub_categories → materials
    SubContract : subcontract_categories → subcontracts
  Sign-off row is driven by the approval_roles master.
*/

// Next running RFQ number for the current year: RFQ-YYYY-####.
// Scans existing RFQ numbers for the highest #### in this year and adds 1.
function nextRfqNo(existing) {
  const year = new Date().getFullYear();
  const re = new RegExp(`^RFQ-${year}-(\\d{4})$`);
  let max = 0;
  for (const r of existing || []) {
    const m = re.exec(String(r?.no || '').trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `RFQ-${year}-${String(max + 1).padStart(4, '0')}`;
}

function blankRow() {
  return { uid: Math.random().toString(36).slice(2,9), source:'', catKey:'', itemCode:'', qty:'', unitId:'' };
}

function formatThaiDate(iso) {
  if (!iso) return '—';
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${d.getDate()} ${months[d.getMonth()]} ${(d.getFullYear()+543).toString().slice(-2)}`;
}

// Look up an item across the catalog by code.
function itemByCode(catalog, code) {
  return catalog?.itemByCode?.get(code) || null;
}

/* =================== Excel generation ===================
   Styled .xlsx via ExcelJS with live formulas — the Supplier fills only
   the yellow cells (Description, ราคา/หน่วย, Overhead %, VAT %) and all
   totals recalculate automatically:
     รวม (per line)  = จำนวน × ราคา/หน่วย
     Subtotal        = SUM(รวม)
     Overhead amount = Subtotal × Overhead%
     VAT amount      = (Subtotal + Overhead) × VAT%
     รวมทั้งสิ้น     = Subtotal + Overhead + VAT
*/
async function downloadRfqExcel({ rfqNo, supplier, project, title, due, contact, items, overheadHint, notes }) {
  const _xl = await import('exceljs');
  const ExcelJS = _xl.default || _xl;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Initial Estate Supply Chain';
  wb.created = new Date();
  const ws = wb.addWorksheet('RFQ', {
    properties: { defaultRowHeight: 18 },
    views: [{ showGridLines: false }],
  });

  const INK = 'FF15130E', SUB = 'FF6B6357', LINE = 'FFD6CFBC';
  const YELLOW = 'FFFFF4CC', HEADBG = 'FF15130E', TOTALBG = 'FFF6F2E9';
  const supName = supplier?.name || '';

  ws.columns = [
    { width: 5 }, { width: 15 }, { width: 38 }, { width: 26 },
    { width: 9 }, { width: 12 }, { width: 18 }, { width: 16 },
  ];

  const thin = { style: 'thin', color: { argb: LINE } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  // ---- Title band ----
  ws.mergeCells('A1:H1');
  const t1 = ws.getCell('A1');
  t1.value = 'ใบขอให้เสนอราคา · Request for Quotation';
  t1.font = { name: 'TH Sarabun New', size: 20, bold: true, color: { argb: INK } };
  t1.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 30;
  ws.mergeCells('A2:H2');
  const t2 = ws.getCell('A2');
  t2.value = 'Initial Estate Co., Ltd.';
  t2.font = { size: 10, color: { argb: SUB } };

  // ---- Meta block (two columns of label/value) ----
  const meta = [
    ['เลขที่ RFQ', rfqNo, 'วันที่ออก', new Date().toISOString().slice(0,10)],
    ['ถึง (Supplier)', supName, 'ครบกำหนดเสนอราคา', due || '—'],
    ['ผู้ติดต่อภายใน', contact?.name || '—', 'อีเมลผู้ติดต่อ', contact?.email || '—'],
    ['โครงการ', project?.name || '—', 'รหัสโครงการ', project?.code || '—'],
    ['หัวข้อ', title || '—', '', ''],
  ];
  let row = 4;
  for (const [l1, v1, l2, v2] of meta) {
    ws.getCell(`A${row}`).value = l1;
    ws.getCell(`A${row}`).font = { size: 10, color: { argb: SUB } };
    ws.mergeCells(`B${row}:C${row}`);
    ws.getCell(`B${row}`).value = v1;
    ws.getCell(`B${row}`).font = { size: 11, bold: true, color: { argb: INK } };
    if (l2) {
      ws.getCell(`E${row}`).value = l2;
      ws.getCell(`E${row}`).font = { size: 10, color: { argb: SUB } };
      ws.mergeCells(`F${row}:H${row}`);
      ws.getCell(`F${row}`).value = v2;
      ws.getCell(`F${row}`).font = { size: 11, bold: true, color: { argb: INK } };
    }
    row++;
  }

  // ---- Items header ----
  const headerRow = row + 1; // one spacer row
  const headers = ['#', 'รหัส', 'รายการ / Spec', 'Description\n(Supplier กรอก)', 'จำนวน', 'หน่วย', 'ราคา/หน่วย\n(Supplier กรอก)', 'รวม'];
  const hr = ws.getRow(headerRow);
  headers.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    c.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADBG } };
    c.alignment = { vertical: 'middle', horizontal: i >= 4 ? 'center' : 'left', wrapText: true };
    c.border = border;
  });
  hr.height = 30;

  const firstItemRow = headerRow + 1;
  items.forEach((it, i) => {
    const r = ws.getRow(firstItemRow + i);
    r.getCell(1).value = i + 1;
    r.getCell(2).value = it.code || '';
    r.getCell(3).value = it.spec ? `${it.name} — ${it.spec}` : (it.name || '');
    r.getCell(4).value = '';                          // Description (supplier)
    r.getCell(5).value = Number(it.qty) || 0;         // qty
    r.getCell(6).value = it.unit || '';
    r.getCell(7).value = null;                        // ราคา/หน่วย (supplier)
    r.getCell(8).value = { formula: `E${firstItemRow + i}*G${firstItemRow + i}` };
    for (let col = 1; col <= 8; col++) {
      const c = r.getCell(col);
      c.border = border;
      c.font = { size: 10, color: { argb: INK } };
      c.alignment = { vertical: 'middle', horizontal: [5,7,8].includes(col) ? 'right' : 'left', wrapText: col === 3 };
      if (col === 1 || col === 6) c.alignment = { vertical: 'middle', horizontal: 'center' };
      if (col === 4 || col === 7) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } };
      if (col === 2) c.font = { size: 9, name: 'Consolas', color: { argb: SUB } };
      if ([7,8].includes(col)) c.numFmt = '#,##0.00';
    }
  });
  const lastItemRow = firstItemRow + Math.max(items.length, 1) - 1;

  // ---- Totals ----
  const subtotalRow = lastItemRow + 1;
  const overheadRow = subtotalRow + 1;
  const vatRow      = overheadRow + 1;
  const grandRow    = vatRow + 1;

  const setTotal = (rowIdx, label, formula, opts = {}) => {
    ws.mergeCells(`A${rowIdx}:F${rowIdx}`);
    const lc = ws.getCell(`A${rowIdx}`);
    lc.value = label;
    lc.alignment = { horizontal: 'right', vertical: 'middle' };
    lc.font = { size: 10.5, bold: !!opts.bold, color: { argb: opts.light ? 'FFFFFFFF' : INK } };
    const gc = ws.getCell(`G${rowIdx}`);
    if (opts.pctCell) {
      gc.value = opts.pctValue;
      gc.numFmt = '0"%"';
      gc.alignment = { horizontal: 'center', vertical: 'middle' };
      gc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } };
      gc.border = border;
      gc.font = { size: 10.5, color: { argb: INK } };
    }
    const hc = ws.getCell(`H${rowIdx}`);
    hc.value = { formula };
    hc.numFmt = '#,##0.00';
    hc.alignment = { horizontal: 'right', vertical: 'middle' };
    hc.font = { size: 10.5, bold: !!opts.bold, color: { argb: opts.light ? 'FFFFFFFF' : INK } };
    hc.border = border;
    if (opts.fill) {
      for (const ref of [`A${rowIdx}`, `G${rowIdx}`, `H${rowIdx}`]) {
        const cell = ws.getCell(ref);
        if (!cell.fill || ref === `A${rowIdx}` || ref === `H${rowIdx}`) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
        }
      }
    }
  };

  setTotal(subtotalRow, 'มูลค่ารวมรายการ (Subtotal)',
    items.length ? `SUM(H${firstItemRow}:H${lastItemRow})` : '0', { fill: TOTALBG });
  setTotal(overheadRow, 'Overhead (Supplier กรอก %) →',
    `H${subtotalRow}*G${overheadRow}/100`, { pctCell: true, pctValue: 0 });
  setTotal(vatRow, 'VAT (Supplier กรอก %) →',
    `(H${subtotalRow}+H${overheadRow})*G${vatRow}/100`, { pctCell: true, pctValue: 7 });
  setTotal(grandRow, 'รวมทั้งสิ้น (Grand Total)',
    `H${subtotalRow}+H${overheadRow}+H${vatRow}`, { bold: true, light: true, fill: HEADBG });

  // ---- Notes ----
  let nrow = grandRow + 2;
  if (overheadHint) {
    ws.getCell(`A${nrow}`).value = `หมายเหตุ Overhead: ${overheadHint}`;
    ws.getCell(`A${nrow}`).font = { size: 9.5, italic: true, color: { argb: SUB } };
    nrow++;
  }
  if (notes) {
    ws.getCell(`A${nrow}`).value = `หมายเหตุเพิ่มเติม: ${notes}`;
    ws.getCell(`A${nrow}`).font = { size: 9.5, italic: true, color: { argb: SUB } };
    nrow++;
  }
  ws.getCell(`A${nrow + 1}`).value = '* ช่องสีเหลืองให้ Supplier กรอก — ยอดรวม/Overhead/VAT จะคำนวณอัตโนมัติ';
  ws.getCell(`A${nrow + 1}`).font = { size: 9.5, italic: true, color: { argb: SUB } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${rfqNo}_${supName.replace(/\s+/g, '_')}`.replace(/[\/\\?%*:|"<>]/g, '_') + '.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* =================== Main screen =================== */

export function ScreenRFQCreate({ go }) {
  // Lookups
  const [suppliers, setSuppliers] = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [units,     setUnits]     = useState([]);
  // Material taxonomy
  const [mainCats,  setMainCats]  = useState([]);
  const [subCats,   setSubCats]   = useState([]);
  const [materials, setMaterials] = useState([]);
  // Subcontract taxonomy
  const [subcontractCats, setSubcontractCats] = useState([]);
  const [subcontracts,    setSubcontracts]    = useState([]);
  // Approval roles for the sign-off row
  const [approvalRoles, setApprovalRoles] = useState([]);
  // Internal contacts (app users / team members)
  const [people, setPeople] = useState([]);
  const [contactId, setContactId] = useState('');

  const [loadErr,   setLoadErr]   = useState('');
  // Sequential RFQ number RFQ-YYYY-#### — set once the existing list loads.
  const [rfqNo, setRfqNo] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [rS, rP, rU, rMC, rSC, rM, rSubC, rSub, rAR, rUsers, rRfq] = await Promise.all([
          fetch('/api/suppliers'),
          fetch('/api/projects'),
          fetch('/api/units'),
          fetch('/api/material-main-categories'),
          fetch('/api/material-sub-categories'),
          fetch('/api/materials'),
          fetch('/api/subcontract-categories'),
          fetch('/api/subcontracts'),
          fetch('/api/approval-roles'),
          fetch('/api/users?scope=contacts'),
          fetch('/api/rfqs'),
        ]);
        const dS = await rS.json();
        const dP = await rP.json();
        if (!rS.ok) { setLoadErr(dS.error || 'โหลด Supplier ไม่สำเร็จ'); return; }
        if (!rP.ok) { setLoadErr(dP.error || 'โหลดโครงการไม่สำเร็จ'); return; }
        setSuppliers(dS.items || []);
        setProjects(dP.items || []);
        if (rU.ok)    setUnits((await rU.json()).items || []);
        if (rMC.ok)   setMainCats((await rMC.json()).items || []);
        if (rSC.ok)   setSubCats((await rSC.json()).items || []);
        if (rM.ok)    setMaterials((await rM.json()).items || []);
        if (rSubC.ok) setSubcontractCats((await rSubC.json()).items || []);
        if (rSub.ok)  setSubcontracts((await rSub.json()).items || []);
        if (rAR.ok)   setApprovalRoles((await rAR.json()).items || []);
        if (rUsers.ok) { const du = await rUsers.json(); setPeople(du.users || du.items || []); }
        // Compute the next running RFQ number for the current year.
        let existing = [];
        if (rRfq.ok) { try { existing = (await rRfq.json()).items || []; } catch {} }
        setRfqNo(nextRfqNo(existing));
      } catch {
        setLoadErr('เครือข่ายขัดข้อง');
      }
    })();
  }, []);

  const contact = useMemo(() => people.find(p => (p.id || p.email) === contactId), [people, contactId]);

  // Resolve a unit row to a short display label (code preferred, then name).
  const unitLabel = useMemo(() => {
    const byId = new Map(units.map(u => [u.id, u]));
    return (id) => { const u = byId.get(id); return u ? (u.code || u.name) : ''; };
  }, [units]);

  // Build the catalog: categories per source + a flat itemByCode map.
  const catalog = useMemo(() => {
    const itemByCode = new Map();

    // --- Material: main → sub → items ---
    const mainById = new Map(mainCats.map(m => [m.id, m]));
    const materialCats = subCats
      .filter(s => s.active)
      .map(sub => {
        const main = mainById.get(sub.main_id);
        const mainName = main?.name || '';
        const its = materials
          .filter(m => m.active && m.main_category === mainName && m.category === sub.name)
          .map(m => {
            const item = { code: m.code, name: m.name, spec: m.spec, unitId: m.unit_id, unitLabel: unitLabel(m.unit_id), source: 'Material' };
            itemByCode.set(m.code, item);
            return item;
          });
        return { key: sub.id, label: main ? `${mainName} › ${sub.name}` : sub.name, items: its };
      })
      .filter(c => c.items.length > 0 || true); // keep empty cats visible too

    // --- SubContract: category → items ---
    const subcontractCatList = subcontractCats
      .filter(c => c.active)
      .map(cat => {
        const its = subcontracts
          .filter(s => s.active && s.category === cat.name)
          .map(s => {
            const item = { code: s.code, name: s.name, spec: '', unitId: s.unit_id, unitLabel: unitLabel(s.unit_id), source: 'SubContract' };
            itemByCode.set(s.code, item);
            return item;
          });
        return { key: cat.id, label: cat.name, items: its };
      });

    return {
      bySource: { Material: materialCats, SubContract: subcontractCatList },
      itemByCode,
    };
  }, [mainCats, subCats, materials, subcontractCats, subcontracts, unitLabel]);

  // Header form
  const [title, setTitle]   = useState('');
  const [project, setProj]  = useState('');
  const [due, setDue]       = useState('');

  // Supplier
  const [supplierId, setSupplierId] = useState(null);
  const supplier = useMemo(() => suppliers.find(s => s.id === supplierId), [suppliers, supplierId]);

  // Items
  const [rows, setRows] = useState([blankRow(), blankRow(), blankRow()]);

  // Conditions
  const [notes, setNotes] = useState('');
  const [overheadHint, setOverheadHint] = useState('');
  const [vatPolicy,    setVatPolicy]    = useState('include');

  // UI state
  const [generated, setGenerated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  const pickSupplier = (s) => setSupplierId(s.id);

  const { itemsFilled, itemsValid } = useMemo(() => {
    const filled = [];
    const valid = [];
    for (const r of rows) {
      if (r.itemCode) {
        filled.push(r);
        // Valid rows carry a resolved unit label (for the doc/preview/payload)
        // alongside the unitId used by the picker.
        if (Number(r.qty) > 0 && r.unitId) valid.push({ ...r, unit: unitLabel(r.unitId) });
      }
    }
    return { itemsFilled: filled, itemsValid: valid };
  }, [rows, unitLabel]);
  const canGenerate = !!supplier && itemsValid.length > 0 && title.trim().length > 0 && !!project && !!rfqNo && !saving;
  const projectObj = useMemo(() => projects.find(p => p.id === project), [projects, project]);

  async function submit() {
    setSaveErr('');
    if (!canGenerate) {
      // Tell the user what's missing rather than silently doing nothing.
      if (!title.trim()) setSaveErr('กรุณากรอกชื่อ RFQ');
      else if (!project) setSaveErr('กรุณาเลือกโครงการ');
      else if (!supplier) setSaveErr('กรุณาเลือก Supplier');
      else if (itemsValid.length === 0) setSaveErr('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ (เลือก Item + จำนวน + หน่วย)');
      return;
    }
    setSaving(true);
    const notesPayload = {
      supplier_id: supplierId,
      supplier_name: supplier?.name,
      contact_name: contact?.name || '',
      contact_email: contact?.email || '',
      overheadHint,
      vatPolicy,
      memo: notes,
      items: itemsValid.map(r => ({
        uid: r.uid, source: r.source, catKey: r.catKey,
        itemCode: r.itemCode, qty: r.qty, unit: r.unit,
        name: (itemByCode(catalog, r.itemCode) || {}).name,
      })),
    };
    try {
      const r = await fetch('/api/rfqs', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          no:         rfqNo,
          project_id: project || null,
          title:      title.trim(),
          status:     'draft',
          due_date:   due || null,
          notes:      JSON.stringify(notesPayload),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setSaveErr(d.error || 'บันทึกไม่สำเร็จ'); setSaving(false); return; }
      try { window.localStorage.setItem('rfq.currentId', d.item.id); } catch {}
      setSaving(false);
      setGenerated(true);
    } catch {
      setSaveErr('เครือข่ายขัดข้อง');
      setSaving(false);
    }
  }

  // Row helpers — functional setState so back-to-back updates don't clobber.
  const updateRow = (uid, patch) => setRows(rs => rs.map(r => r.uid === uid ? { ...r, ...patch } : r));
  const onPickSource = (uid, source) => updateRow(uid, { source, catKey:'', itemCode:'', unitId:'' });
  const onPickCat    = (uid, catKey) => updateRow(uid, { catKey, itemCode:'', unitId:'' });
  const onPickItem   = (uid, code) => {
    setRows(rs => rs.map(r => {
      if (r.uid !== uid) return r;
      const it = itemByCode(catalog, code);
      // Auto-fill the item's master unit, but the user can change it freely.
      return { ...r, itemCode: code, unitId: it?.unitId || r.unitId || '' };
    }));
  };
  const addRow    = () => setRows(rs => [...rs, blankRow()]);
  const removeRow = (uid) => setRows(rs => rs.length === 1 ? [blankRow()] : rs.filter(r => r.uid !== uid));

  if (generated) {
    return <GeneratedView go={go} rfqNo={rfqNo} title={title} supplier={supplier} project={project} projects={projects} items={itemsValid} catalog={catalog} approvalRoles={approvalRoles} contact={contact} due={due} overheadHint={overheadHint} vatPolicy={vatPolicy} notes={notes} />;
  }

  // Are the master catalogs empty? Guide the user to set them up.
  const noCatalog = catalog.bySource.Material.length === 0 && catalog.bySource.SubContract.length === 0;

  return (
    <div className="page" style={{ paddingBottom: 200 }}>
      <button className="btn ghost sm" onClick={() => go('rfq')} style={{ marginBottom: 20, marginLeft: -8 }}>
        {Icons.back} กลับไป RFQ
      </button>

      <div className="page-head" style={{ alignItems:'flex-start' }}>
        <div className="page-title">
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:8,
              padding:'4px 12px', borderRadius:4,
              background:'var(--teal-soft)', color:'var(--teal-ink)',
              fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600,
            }}>
              {rfqNo}
              <span style={{ fontSize:9, color:'var(--ink-3)', fontWeight:400, letterSpacing:0.06, textTransform:'uppercase' }}>auto</span>
            </span>
            <Chip kind="draft">ร่าง</Chip>
          </div>
          <h1 className="h-display">สร้าง RFQ ใหม่</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'8px 0 0', maxWidth:620 }}>
            กรอกข้อมูลให้ครบ — ระบบจะสร้างเอกสาร Excel มาตรฐานเพื่อส่งให้ Supplier กรอกราคากลับมา
          </p>
        </div>
      </div>

      {noCatalog && (
        <div style={{
          padding:'12px 16px', background:'var(--ochre-soft)', border:'1px solid var(--ochre)',
          borderRadius:6, marginBottom:20, fontSize:13, color:'#6B5121',
        }}>
          ยังไม่มีข้อมูลวัสดุ/งานจ้างในระบบ — เพิ่มที่
          <button onClick={() => go('settings-materials')} style={{ background:'none', border:0, padding:'0 4px', color:'#6B5121', textDecoration:'underline', cursor:'pointer', fontWeight:500 }}>วัสดุก่อสร้าง</button>
          หรือ
          <button onClick={() => go('settings-subcontracts')} style={{ background:'none', border:0, padding:'0 4px', color:'#6B5121', textDecoration:'underline', cursor:'pointer', fontWeight:500 }}>งานจ้างเหมา</button>
          ก่อนถึงจะเลือกรายการได้
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:32, alignItems:'flex-start' }}>

        {/* ========== LEFT: form ========== */}
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

          <SectionCard step="1" label="ข้อมูลทั่วไป" desc="ตั้งชื่อ RFQ ระบุโครงการและวันครบกำหนดที่ต้องการให้ Supplier ตอบกลับ">
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:16, marginBottom:16 }}>
              <Field label="ชื่อ RFQ" required>
                <input type="text" value={title} placeholder="เช่น เหล็กเส้น DB12/16 ล็อต Q2"
                  onChange={e => setTitle(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="โครงการ" required>
                <select value={project} onChange={e => setProj(e.target.value)} style={inputStyle}>
                  <option value="">— เลือกโครงการ —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ''}{p.name}</option>)}
                </select>
              </Field>
              <Field label="ครบกำหนดเสนอราคา" required>
                <input type="date" value={due} onChange={e => setDue(e.target.value)} style={inputStyle} />
              </Field>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <Field label="ผู้ติดต่อภายใน (ผู้ประสานงาน)">
                <select value={contactId} onChange={e => setContactId(e.target.value)} style={inputStyle}>
                  <option value="">— เลือกผู้ติดต่อ —</option>
                  {people.map(u => (
                    <option key={u.id || u.email} value={u.id || u.email}>
                      {u.name || u.email}{u.email ? ` · ${u.email}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </SectionCard>

          <SectionCard step="2" label="เลือก Supplier" desc="หนึ่งใบ ต่อ Supplier หนึ่งราย">
            {!supplier
              ? <SupplierPicker suppliers={suppliers} onPick={pickSupplier} />
              : <SelectedSupplierCard supplier={supplier} onChange={() => setSupplierId(null)} />}
          </SectionCard>

          <SectionCard step="3" label="รายการสินค้า / งาน" desc="เลือก Source: Material หรือ SubContract → หมวด → Item → จำนวน + หน่วย · ช่อง Description จะให้ Supplier กรอกรายละเอียดในใบเสนอราคา">
            <div style={{ overflowX:'auto', margin:'0 -20px' }}>
              <table className="tbl" style={{ minWidth:'100%' }}>
                <thead>
                  <tr>
                    <th style={{ width:32, paddingLeft:20 }}>#</th>
                    <th style={{ width:'12%' }}>ประเภท</th>
                    <th style={{ width:'18%' }}>หมวด</th>
                    <th>Item</th>
                    <th style={{ width:'16%' }}>
                      Description
                      <span style={{ display:'inline-block', marginLeft:6, padding:'1px 5px', borderRadius:3, background:'#FFF4CC', color:'#6B5121', fontSize:9, fontWeight:600, letterSpacing:0.04, verticalAlign:'middle' }}>SUPPLIER</span>
                    </th>
                    <th style={{ width:70 }} className="num-col">จำนวน</th>
                    <th style={{ width:150 }}>หน่วย</th>
                    <th style={{ width:36, paddingRight:20 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const cats = catalog.bySource[r.source] || [];
                    const cat  = cats.find(c => c.key === r.catKey);
                    const it   = r.itemCode ? itemByCode(catalog, r.itemCode) : null;
                    return (
                      <tr key={r.uid}>
                        <td style={{ paddingLeft:20, color:'var(--ink-4)', fontFamily:'var(--font-mono)', fontSize:11 }}>{String(i+1).padStart(2,'0')}</td>
                        <td>
                          <select value={r.source} onChange={e => onPickSource(r.uid, e.target.value)} style={tableSelectStyle}>
                            <option value="">— เลือก —</option>
                            <option value="Material">Material</option>
                            <option value="SubContract">SubContract</option>
                          </select>
                        </td>
                        <td>
                          <select value={r.catKey} onChange={e => onPickCat(r.uid, e.target.value)} style={tableSelectStyle} disabled={!r.source}>
                            <option value="">{r.source ? '— เลือกหมวด —' : 'เลือก Source ก่อน'}</option>
                            {cats.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                          </select>
                        </td>
                        <td>
                          <select value={r.itemCode}
                            onChange={e => onPickItem(r.uid, e.target.value)}
                            style={{ ...tableSelectStyle, color: r.itemCode ? 'var(--ink)' : 'var(--ink-4)' }}
                            disabled={!r.catKey}>
                            <option value="">{r.catKey ? '— เลือก Item —' : 'เลือกหมวดก่อน'}</option>
                            {cat?.items.map(i2 => (
                              <option key={i2.code} value={i2.code}>{i2.name}</option>
                            ))}
                          </select>
                          {it && (
                            <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:4 }}>
                              <span className="font-mono" style={{ color:'var(--ink-4)' }}>{it.code}</span>
                              {it.spec && <span style={{ marginLeft:6 }}>· {it.spec}</span>}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{
                            padding:'8px 10px',
                            border:'1px dashed var(--rule-2)', borderRadius:4,
                            background:'#FFFBEB',
                            fontSize:11.5, color:'var(--ink-4)', fontStyle:'italic',
                            minHeight:30, display:'flex', alignItems:'center',
                          }}>
                            ให้ Supplier กรอกในใบเสนอราคา
                          </div>
                        </td>
                        <td className="num-col">
                          <input type="number" value={r.qty} onChange={e => updateRow(r.uid, { qty:e.target.value })}
                            placeholder="0" className="num"
                            style={{ ...tableInputStyle, textAlign:'right' }} disabled={!r.itemCode} />
                        </td>
                        <td>
                          {/* Searchable unit picker — type to filter by code /
                              name / alias, same as the Material modal. */}
                          <UnitPicker units={units} value={r.unitId}
                            onChange={(id) => updateRow(r.uid, { unitId: id })}
                            placeholder="— เลือก —" />
                        </td>
                        <td style={{ paddingRight:20 }}>
                          <button onClick={() => removeRow(r.uid)} className="btn ghost sm"
                            style={{ padding:'4px 6px', color:'var(--ink-4)' }} title="ลบ">×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:14, alignItems:'center' }}>
              <button className="btn sm" onClick={addRow}>{Icons.plus} เพิ่มรายการ</button>
              <span style={{ fontSize:11, color:'var(--ink-3)', display:'inline-flex', alignItems:'center', gap:6 }}>
                <span style={{ width:10, height:10, border:'1px dashed var(--rule-2)', background:'#FFFBEB', borderRadius:2 }} />
                = ช่องให้ Supplier เติมในใบเสนอราคา
              </span>
              <div style={{ marginLeft:'auto', fontSize:12, color:'var(--ink-3)' }}>
                {itemsFilled.length} จาก {rows.length} แถวกรอกแล้ว
              </div>
            </div>

            <div style={{
              marginTop:20, padding:'16px 16px',
              background:'var(--surface-2)',
              border:'1px solid var(--rule)', borderRadius:6,
            }}>
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:12 }}>
                <div className="eyebrow">นโยบายราคา · ปลายรายการ</div>
                <span style={{ fontSize:10.5, color:'var(--ink-3)', fontStyle:'italic' }}>
                  จะแสดงต่อท้ายตารางรายการในใบ RFQ
                </span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <Field label="Overhead สูงสุดที่ยอมรับ (%)">
                  <input
                    type="text"
                    value={overheadHint}
                    onChange={e => setOverheadHint(e.target.value)}
                    placeholder="เช่น ไม่เกิน 10% — หากเกินกรุณาระบุเหตุผล"
                    style={inputStyle}
                  />
                </Field>
                <Field label="นโยบาย VAT">
                  <div style={{ display:'flex', gap:0, border:'1px solid var(--rule-2)', borderRadius:6, overflow:'hidden' }}>
                    {[
                      { v:'include',  label:'รวม VAT แล้ว' },
                      { v:'exclude',  label:'ไม่รวม VAT' },
                      { v:'supplier', label:'ให้ Supplier ระบุ' },
                    ].map((opt, i, arr) => (
                      <button key={opt.v} type="button" onClick={() => setVatPolicy(opt.v)} style={{
                        flex:1, padding:'9px 8px', fontSize:12, fontFamily:'inherit',
                        background: vatPolicy === opt.v ? 'var(--ink)' : 'var(--surface)',
                        color: vatPolicy === opt.v ? 'var(--paper)' : 'var(--ink-2)',
                        border:'none', cursor:'pointer',
                        borderRight: i < arr.length - 1 ? '1px solid var(--rule-2)' : 'none',
                      }}>{opt.label}</button>
                    ))}
                  </div>
                </Field>
              </div>
            </div>
          </SectionCard>

          <SectionCard step="4" label="เงื่อนไขที่ให้ Supplier กรอก"
            desc="ทั้ง 5 เงื่อนไขจะเป็นช่องว่างให้ Supplier เขียนเองในใบเสนอราคา">
            <div className="eyebrow" style={{ marginBottom:10, display:'inline-flex', alignItems:'center', gap:8 }}>
              เงื่อนไข 5 ข้อ
              <span style={{ padding:'1px 8px', borderRadius:3, background:'#FFF4CC', color:'#6B5121', fontSize:9, fontWeight:600, letterSpacing:0.04 }}>SUPPLIER กรอก</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                { icon:'💳', label:'เงื่อนไขการชำระเงิน',  hint:'เครดิตเทอม · ช่องทาง · งวด' },
                { icon:'🚚', label:'เงื่อนไขการจัดส่ง',     hint:'ค่าขนส่ง · จุดส่งมอบ' },
                { icon:'⏱',  label:'เงื่อนไขการยืนราคา',    hint:'จำนวนวันที่ราคามีผล' },
                { icon:'🛡️', label:'เงื่อนไขการรับประกัน',  hint:'ระยะเวลา · ขอบเขต' },
                { icon:'📦', label:'Lead Time ในการสั่ง',  hint:'จำนวนวันหลังออก PO ถึงส่งมอบ' },
              ].map(c => (
                <div key={c.label} style={{
                  padding:'12px 14px',
                  border:'1px dashed var(--rule-2)', borderRadius:6,
                  background:'#FFFBEB',
                  display:'flex', gap:10, alignItems:'flex-start',
                }}>
                  <span style={{ fontSize:16, flexShrink:0 }}>{c.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12.5, fontWeight:500, color:'var(--ink-2)' }}>{c.label}</div>
                    <div style={{ fontSize:11, color:'var(--ink-4)', marginTop:4, fontStyle:'italic' }}>{c.hint}</div>
                    <div style={{
                      marginTop:8, height:8, background:'transparent',
                      borderBottom:'1px solid var(--rule-2)',
                    }} />
                  </div>
                </div>
              ))}
            </div>

            <Field label="หมายเหตุเพิ่มเติม (ถ้ามี)">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="ข้อกำหนดเฉพาะ การส่งมอบ การรับรองมาตรฐาน ฯลฯ"
                style={{ ...inputStyle, minHeight:64, resize:'vertical', fontFamily:'inherit', marginTop:16 }}
              />
            </Field>
          </SectionCard>
        </div>

        {/* ========== RIGHT: summary + preview ========== */}
        <div style={{ display:'flex', flexDirection:'column', gap:16, position:'sticky', top:80 }}>
          <SummaryCard
            rfqNo={rfqNo}
            title={title}
            project={projectObj}
            supplier={supplier}
            items={itemsValid}
            due={due}
            overheadHint={overheadHint}
            vatPolicy={vatPolicy}
          />
          <ExcelPreviewCard items={itemsValid} catalog={catalog} />
        </div>
      </div>

      {/* Sticky footer */}
      <div style={{
        position:'fixed', left:240, right:0, bottom:0,
        background:'var(--surface)', borderTop:'1px solid var(--rule)',
        padding:'16px 48px', display:'flex', alignItems:'center', gap:24,
        boxShadow:'0 -8px 24px -12px rgba(20,18,14,0.10)', zIndex:10,
      }}>
        <div style={{ display:'flex', gap:32 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom:2 }}>เอกสาร</div>
            <div className="font-mono" style={{ fontSize:16, lineHeight:1, marginTop:2 }}>{rfqNo}</div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom:2 }}>รายการ</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:24, lineHeight:1 }}>
              {itemsValid.length} <span style={{ fontSize:13, color:'var(--ink-3)' }}>/ {rows.length} แถว</span>
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom:2 }}>Supplier</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:18, lineHeight:1.1, maxWidth:240, textOverflow:'ellipsis', overflow:'hidden', whiteSpace:'nowrap' }}>
              {supplier ? supplier.name : <span style={{ color:'var(--ink-4)', fontStyle:'italic' }}>ยังไม่เลือก</span>}
            </div>
          </div>
          {(loadErr || saveErr) && (
            <div style={{
              padding:'8px 12px', background:'#FDE8E4', color:'#8B2A1A',
              borderRadius:6, fontSize:12, alignSelf:'center',
            }}>{saveErr || loadErr}</div>
          )}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button className="btn ghost" onClick={() => go('rfq')} disabled={saving}>ยกเลิก</button>
          <button className="btn primary" disabled={!canGenerate} onClick={submit}
            style={{ padding:'10px 20px', opacity: canGenerate ? 1 : 0.5, cursor: canGenerate ? 'pointer' : 'not-allowed' }}>
            {saving ? 'กำลังบันทึก…' : <>{Icons.download} Submit & ดาวน์โหลด Excel</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =================== Generated success view =================== */

function GeneratedView({ go, rfqNo, title, supplier, project, projects, items, catalog, approvalRoles, contact, due, overheadHint, vatPolicy, notes }) {
  const projectObj = projects.find(p => p.id === project);
  const [dlBusy, setDlBusy] = useState(false);
  const [dlErr, setDlErr]   = useState('');

  async function handleDownload() {
    setDlErr(''); setDlBusy(true);
    try {
      const rows = items.map(it => {
        const m = itemByCode(catalog, it.itemCode) || {};
        return { code: it.itemCode, name: m.name || '', spec: m.spec || '', qty: it.qty, unit: it.unit };
      });
      await downloadRfqExcel({ rfqNo, supplier, project: projectObj, title, due, contact, items: rows, overheadHint, notes });
    } catch (e) {
      setDlErr('สร้างไฟล์ Excel ไม่สำเร็จ: ' + (e?.message || ''));
    }
    setDlBusy(false);
  }

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => go('rfq')} style={{ marginBottom:20, marginLeft:-8 }}>
        {Icons.back} กลับไป RFQ
      </button>

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:32, marginBottom:32, alignItems:'flex-start' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
            <span className="font-mono" style={{ fontSize:12, color:'var(--ink-3)' }}>{rfqNo}</span>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:6,
              fontSize:11, fontWeight:500, padding:'2px 10px', borderRadius:999,
              background:'var(--ochre-soft)', color:'#6B5121',
            }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--ochre)' }} />
              Wait
            </span>
            <span style={{ fontSize:12, color:'var(--ink-3)' }}>· สร้างสำเร็จเมื่อสักครู่</span>
          </div>
          <h1 className="h-display" style={{ marginBottom:8 }}>{title || 'RFQ ใหม่'}</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', maxWidth:560, lineHeight:1.6 }}>
            สร้างเอกสาร Excel เรียบร้อย — ดาวน์โหลดและส่งให้ <strong style={{ color:'var(--ink)' }}>{supplier?.name}</strong> เพื่อกรอกราคากลับมา
          </p>

          <div style={{ display:'flex', gap:8, marginTop:24, flexWrap:'wrap' }}>
            <button className="btn primary" onClick={handleDownload} disabled={dlBusy}>
              {Icons.download} {dlBusy ? 'กำลังสร้าง…' : 'ดาวน์โหลด Excel'}
            </button>
            <button className="btn ghost" onClick={() => go('rfq')}>ดู RFQ ทั้งหมด</button>
          </div>
          {dlErr && (
            <div style={{ marginTop:12, padding:'8px 12px', background:'#FDE8E4', color:'#8B2A1A', borderRadius:6, fontSize:12.5 }}>{dlErr}</div>
          )}

          <div className="card" style={{ marginTop:32, background:'var(--surface-2)' }}>
            <div className="eyebrow" style={{ marginBottom:10 }}>ขั้นตอนถัดไป</div>
            <ol style={{ margin:0, paddingLeft:20, fontSize:13, lineHeight:1.9, color:'var(--ink-2)' }}>
              <li>ส่งไฟล์ Excel ที่ดาวน์โหลด ให้กับ <strong>{supplier?.name}</strong></li>
              <li>รอ Supplier กรอกราคา ส่งคืน Quotation (ก่อน {formatThaiDate(due)})</li>
              <li>Upload ไฟล์ Quote กลับมาที่ระบบ — เปรียบเทียบกับเงื่อนไขที่บันทึกไว้</li>
              <li>ยืนยันราคา → สถานะเปลี่ยนเป็น <strong>Received</strong></li>
            </ol>
          </div>
        </div>

        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--rule)' }}>
            <span className="eyebrow">เอกสารที่สร้าง</span>
          </div>
          <div style={{ padding:'20px', display:'flex', gap:14, alignItems:'flex-start' }}>
            <div style={{
              width:48, height:60, background:'#1F6F47', color:'#fff',
              borderRadius:4, display:'grid', placeItems:'center',
              fontSize:11, fontWeight:600, letterSpacing:0.5, flexShrink:0,
            }}>XLSX</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {rfqNo}_{(supplier?.name || '').replace(/\s+/g,'_')}.xlsx
              </div>
              <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:4 }}>24 KB · สร้างเมื่อสักครู่</div>
              <div style={{ marginTop:14, fontSize:11.5, color:'var(--ink-3)', lineHeight:1.7 }}>
                <div>📄 หัวเอกสาร · ข้อมูล Supplier และโครงการ</div>
                <div>📋 รายการ ({items.length} รายการ) · มีช่องให้ Supplier กรอกราคา</div>
                <div>🛡 เงื่อนไขการรับประกัน</div>
                <div>💳 เงื่อนไขการชำระเงิน</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <h3 className="h-section" style={{ marginBottom:16 }}>ตัวอย่างเอกสาร Excel</h3>
      <ExcelDocPreview rfqNo={rfqNo} supplier={supplier} project={projectObj} items={items} catalog={catalog} approvalRoles={approvalRoles}
        due={due} title={title} overheadHint={overheadHint} vatPolicy={vatPolicy} notes={notes} />
    </div>
  );
}

/* =================== Sub-components =================== */

function SectionCard({ step, label, desc, children }) {
  return (
    <div className="card" style={{ padding:'20px 24px 24px' }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:16 }}>
        <span style={{
          width:22, height:22, borderRadius:999, background:'var(--paper-2)',
          color:'var(--ink-2)', display:'inline-grid', placeItems:'center',
          fontSize:11, fontWeight:600, fontFamily:'var(--font-mono)',
          alignSelf:'center', flexShrink:0,
        }}>{step}</span>
        <div style={{ flex:1 }}>
          <h3 className="h-card" style={{ marginBottom:2 }}>{label}</h3>
          {desc && <p style={{ fontSize:12, color:'var(--ink-3)', margin:0 }}>{desc}</p>}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <span style={{ fontSize:11.5, color:'var(--ink-3)', fontWeight:500 }}>
        {label} {required && <span style={{ color:'var(--clay)' }}>*</span>}
      </span>
      {children}
    </label>
  );
}

const inputStyle = {
  padding:'9px 12px', fontSize:13,
  border:'1px solid var(--rule-2)', borderRadius:6,
  background:'var(--paper)', color:'var(--ink)',
  outline:'none', fontFamily:'inherit', width:'100%',
};
const tableInputStyle = {
  padding:'6px 8px', fontSize:12.5,
  border:'1px solid transparent', background:'transparent',
  outline:'none', fontFamily:'inherit', width:'100%', borderRadius:4,
};
const tableSelectStyle = {
  padding:'6px 8px', fontSize:12.5,
  border:'1px solid var(--rule)', background:'var(--paper)',
  outline:'none', fontFamily:'inherit', width:'100%', borderRadius:4, cursor:'pointer',
};

/* ----- Supplier picker (table layout) ----- */
function SupplierPicker({ suppliers, onPick }) {
  const [q, setQ] = useState('');
  const filtered = suppliers.filter(s => !q || (s.name || '').toLowerCase().includes(q.toLowerCase()) || (s.code || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{
          display:'flex', alignItems:'center', gap:8, padding:'7px 10px',
          border:'1px solid var(--rule-2)', borderRadius:6, background:'var(--paper)', flex:'1 1 240px',
        }}>
          {Icons.search}
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="ค้นหา Supplier…"
            style={{ flex:1, border:0, outline:0, background:'transparent', fontSize:13 }} />
        </div>
        <span style={{ fontSize:12, color:'var(--ink-3)', marginLeft:'auto' }}>
          {filtered.length} จาก {suppliers.length} ราย
        </span>
      </div>

      <div style={{ maxHeight:340, overflowY:'auto', border:'1px solid var(--rule)', borderRadius:6, background:'var(--paper)' }}>
        <table className="tbl" style={{ background:'var(--paper)' }}>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} onClick={() => onPick(s)} style={{ cursor:'pointer' }}>
                <td style={{ padding:'12px 16px', width:36 }}>
                  <Av initials={(s.name || '').slice(0,2)} kind="default" />
                </td>
                <td style={{ padding:'12px 8px' }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{s.name}</div>
                  <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:3 }}>
                    {s.code ? `${s.code} · ` : ''}{s.type || '—'}{s.contact_name ? ` · ${s.contact_name}` : ''}
                  </div>
                </td>
                <td style={{ padding:'12px 8px', fontSize:11.5, color:'var(--ink-3)', whiteSpace:'nowrap' }}>
                  <div>{s.payment_terms ? `เครดิต ${s.payment_terms}` : ''}</div>
                </td>
                <td style={{ padding:'12px 16px', textAlign:'right' }}>
                  <button className="btn sm" style={{ background:'var(--teal)', color:'var(--paper)', borderColor:'var(--teal)' }}>
                    เลือก
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} style={{ padding:28, textAlign:'center', fontSize:13, color:'var(--ink-3)' }}>ไม่พบ Supplier</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SelectedSupplierCard({ supplier, onChange }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:16, padding:'14px 16px',
      background:'var(--teal-soft)', borderRadius:6, border:'1px solid var(--teal)',
    }}>
      <Av initials={(supplier.name || '').slice(0,2)} kind="default" />
      <div style={{ flex:1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:2 }}>
          <span style={{ fontSize:14, fontWeight:500 }}>{supplier.name}</span>
          <span className="font-mono" style={{ fontSize:11, color:'var(--ink-3)' }}>{supplier.code || supplier.id}</span>
        </div>
        <div style={{ fontSize:12, color:'var(--ink-3)' }}>
          {[supplier.contact_name, supplier.email, supplier.payment_terms && `เครดิต ${supplier.payment_terms}`].filter(Boolean).join(' · ')}
        </div>
      </div>
      <button className="btn sm" onClick={onChange} style={{ background:'var(--paper)' }}>เปลี่ยน Supplier</button>
    </div>
  );
}

/* ----- Right rail summary ----- */
function SummaryCard({ rfqNo, title, project, supplier, items, due, overheadHint, vatPolicy }) {
  const vatLabel = { include:'รวม VAT แล้ว', exclude:'ไม่รวม VAT', supplier:'Supplier ระบุ' }[vatPolicy] || '—';
  return (
    <div className="card" style={{ padding:20 }}>
      <div className="eyebrow" style={{ marginBottom:12 }}>สรุปก่อน Submit</div>
      <Row label="เลขที่"   value={<span className="font-mono">{rfqNo}</span>} />
      <Row label="หัวข้อ"   value={title || <em style={{ color:'var(--ink-4)' }}>—</em>} />
      <Row label="โครงการ" value={project ? (project.code || project.name) : '—'} />
      <Row label="Supplier" value={supplier ? supplier.name : <em style={{ color:'var(--ink-4)' }}>ยังไม่เลือก</em>} />
      <Row label="รายการ"   value={`${items.length} รายการ`} />
      <Row label="ครบกำหนด" value={formatThaiDate(due)} />
      <Row label="Overhead"  value={overheadHint || <em style={{ color:'var(--ink-4)' }}>ยังไม่ระบุ</em>} />
      <Row label="VAT"       value={vatLabel} />
      <Row label="เงื่อนไข 5 ข้อ" value={<span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, padding:'2px 8px', borderRadius:3, background:'#FFF4CC', color:'#6B5121', fontWeight:500 }}>Supplier กรอก</span>} last />
    </div>
  );
}

function Row({ label, value, last }) {
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start',
      padding:'8px 0', borderBottom: last ? 'none' : '1px solid var(--rule)',
    }}>
      <span style={{ fontSize:11.5, color:'var(--ink-3)', flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:12.5, color:'var(--ink)', textAlign:'right', fontWeight:450 }}>{value}</span>
    </div>
  );
}

/* ----- Mini Excel preview (right rail) ----- */
function ExcelPreviewCard({ items, catalog }) {
  return (
    <div className="card" style={{ padding:0, overflow:'hidden' }}>
      <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--rule)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span className="eyebrow">Excel · ตัวอย่าง</span>
        <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)' }}>.xlsx</span>
      </div>
      <div style={{ background:'#FCFAF5', padding:'4px 0' }}>
        <MiniSheet items={items} catalog={catalog} />
      </div>
      <div style={{ padding:'10px 16px', borderTop:'1px solid var(--rule)', fontSize:11, color:'var(--ink-3)' }}>
        {items.length > 0
          ? <span>{items.length} รายการ · ช่อง <strong style={{ color:'var(--ink-2)' }}>สีเหลือง</strong> ให้ Supplier กรอก</span>
          : <span>ยังไม่มีรายการ — เพิ่มรายการเพื่อดูตัวอย่าง</span>}
      </div>
    </div>
  );
}

function MiniSheet({ items, catalog }) {
  const cols = ['ลำดับ','รหัส','รายการ','Description','จำนวน','หน่วย','ราคา/หน่วย','รวม'];
  const widths = ['7%','14%','22%','14%','10%','10%','12%','11%'];
  const supplierCols = new Set(['Description','ราคา/หน่วย','รวม']);
  const display = items.slice(0,4);
  const fillerRows = Math.max(0, 4 - display.length);
  return (
    <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-2)' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
        <thead>
          <tr style={{ background:'#E8E3D6' }}>
            {cols.map((c,i) => (
              <th key={c} style={{
                width:widths[i], padding:'5px 6px', fontSize:8.5, fontWeight:500, color:'var(--ink-2)',
                textAlign: ['จำนวน','ราคา/หน่วย','รวม'].includes(c) ? 'right' : 'left',
                borderRight:'1px solid #D6CFBC',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {display.map((it, i) => {
            const it2 = itemByCode(catalog, it.itemCode) || {};
            return (
              <tr key={it.uid} style={{ background: i%2 ? '#FAF7F0' : '#FCFAF5' }}>
                <td style={cellStyle(false)}>{i+1}</td>
                <td style={cellStyle(false)}>{it.itemCode}</td>
                <td style={{ ...cellStyle(false), overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{it2.name}</td>
                <td style={cellStyle(true)}>—</td>
                <td style={{ ...cellStyle(false), textAlign:'right' }}>{Number(it.qty).toLocaleString()}</td>
                <td style={{ ...cellStyle(false), textAlign:'right' }}>{it.unit}</td>
                <td style={{ ...cellStyle(true), textAlign:'right' }}>—</td>
                <td style={{ ...cellStyle(true), borderRight:0, textAlign:'right' }}>—</td>
              </tr>
            );
          })}
          {[...Array(fillerRows)].map((_,i) => (
            <tr key={'f'+i} style={{ background: (display.length+i)%2 ? '#FAF7F0' : '#FCFAF5', height:22 }}>
              {cols.map((c,j) => <td key={j} style={cellStyle(supplierCols.has(c), j === cols.length-1)}></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function cellStyle(supplierFill, last) {
  return {
    padding:'4px 6px',
    borderRight: last ? 0 : '1px solid #E5DFD0',
    borderBottom:'1px solid #E5DFD0',
    background: supplierFill ? '#FFF4CC' : 'transparent',
    color: supplierFill ? 'var(--ink-4)' : 'var(--ink-2)',
  };
}

/* ----- Big Excel doc preview (success page) ----- */
function ExcelDocPreview({ rfqNo, supplier, project, items, catalog, approvalRoles, due, title, overheadHint, vatPolicy, notes }) {
  return (
    <div className="card" style={{ padding:0, overflow:'hidden', boxShadow:'0 8px 32px -16px rgba(20,18,14,0.18)' }}>
      <div style={{
        padding:'8px 14px', background:'#F3F1EA', borderBottom:'1px solid #D6CFBC',
        fontSize:11, color:'var(--ink-3)', display:'flex', alignItems:'center', gap:12, fontFamily:'var(--font-mono)',
      }}>
        <span style={{ background:'#1F6F47', color:'#fff', padding:'2px 6px', borderRadius:2, fontSize:9.5, fontWeight:600 }}>XLSX</span>
        <span>{rfqNo}_{(supplier?.name || '').replace(/\s+/g,'_')}.xlsx</span>
      </div>

      <div style={{ padding:'36px 48px', background:'#FFFFFF', minHeight:600 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, paddingBottom:16, borderBottom:'2px solid #15130E' }}>
          <div>
            <div style={{ fontSize:11, letterSpacing:0.16, textTransform:'uppercase', color:'var(--ink-3)' }}>Initial Estate Co., Ltd.</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:28, lineHeight:1.1, marginTop:6 }}>ใบขอให้เสนอราคา</div>
            <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:4 }}>Request for Quotation (RFQ)</div>
          </div>
          <div style={{ textAlign:'right', fontSize:11.5, lineHeight:1.7 }}>
            <div><span style={{ color:'var(--ink-3)' }}>เลขที่:</span> <span className="font-mono" style={{ fontWeight:500 }}>{rfqNo}</span></div>
            <div><span style={{ color:'var(--ink-3)' }}>วันที่ออก:</span> {formatThaiDate(new Date().toISOString().slice(0,10))}</div>
            <div><span style={{ color:'var(--ink-3)' }}>ครบกำหนดตอบกลับ:</span> <strong>{formatThaiDate(due)}</strong></div>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:24 }}>
          <div>
            <div style={{ fontSize:10, letterSpacing:0.12, textTransform:'uppercase', color:'var(--ink-3)', marginBottom:6 }}>เรียน — Supplier</div>
            <div style={{ fontSize:14, fontWeight:500 }}>{supplier?.name}</div>
            <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:4, lineHeight:1.6 }}>
              {supplier?.contact_name}<br/>
              {supplier?.email}
            </div>
          </div>
          <div>
            <div style={{ fontSize:10, letterSpacing:0.12, textTransform:'uppercase', color:'var(--ink-3)', marginBottom:6 }}>โครงการ</div>
            <div style={{ fontSize:14, fontWeight:500 }}>{project?.name}</div>
            <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:4 }}>รหัส: {project?.code || project?.id}</div>
          </div>
        </div>

        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:10, letterSpacing:0.12, textTransform:'uppercase', color:'var(--ink-3)', marginBottom:4 }}>หัวข้อ</div>
          <div style={{ fontSize:14, fontWeight:500 }}>{title}</div>
        </div>

        <table style={{ width:'100%', borderCollapse:'collapse', marginTop:20, fontSize:11 }}>
          <thead>
            <tr style={{ background:'#15130E', color:'#FFFFFF' }}>
              <th style={{ padding:'8px 8px', textAlign:'center', fontWeight:500, width:32 }}>#</th>
              <th style={{ padding:'8px 8px', textAlign:'left', fontWeight:500, width:'12%' }}>รหัส</th>
              <th style={{ padding:'8px 8px', textAlign:'left', fontWeight:500 }}>รายการ / Spec</th>
              <th style={{ padding:'8px 8px', textAlign:'left', fontWeight:500, width:'18%', background:'#FFF4CC', color:'#15130E' }}>
                Description<br/>
                <span style={{ fontSize:9, fontWeight:400, color:'var(--ink-3)' }}>(กรอกโดย Supplier)</span>
              </th>
              <th style={{ padding:'8px 8px', textAlign:'right', fontWeight:500, width:'7%' }}>จำนวน</th>
              <th style={{ padding:'8px 8px', textAlign:'left', fontWeight:500, width:'9%' }}>หน่วย</th>
              <th style={{ padding:'8px 8px', textAlign:'right', fontWeight:500, width:'12%', background:'#FFF4CC', color:'#15130E' }}>ราคา/หน่วย (฿)</th>
              <th style={{ padding:'8px 8px', textAlign:'right', fontWeight:500, width:'12%', background:'#FFF4CC', color:'#15130E' }}>รวม (฿)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const it2 = itemByCode(catalog, it.itemCode) || {};
              return (
                <tr key={it.uid} style={{ borderBottom:'1px solid #E5DFD0' }}>
                  <td style={{ padding:'10px 8px', textAlign:'center', color:'var(--ink-3)', fontFamily:'var(--font-mono)' }}>{i+1}</td>
                  <td style={{ padding:'10px 8px', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-2)' }}>{it.itemCode}</td>
                  <td style={{ padding:'10px 8px' }}>
                    <div style={{ fontWeight:500 }}>{it2.name}</div>
                    {it2.spec && <div style={{ fontSize:10, color:'var(--ink-3)', marginTop:2 }}>{it2.spec}</div>}
                  </td>
                  <td style={{ padding:'10px 8px', background:'#FFFBEB', color:'var(--ink-4)', fontStyle:'italic', fontSize:10, verticalAlign:'top' }}>กรอกรายละเอียด</td>
                  <td style={{ padding:'10px 8px', textAlign:'right', fontFamily:'var(--font-mono)' }}>{Number(it.qty).toLocaleString()}</td>
                  <td style={{ padding:'10px 8px' }}>{it.unit}</td>
                  <td style={{ padding:'10px 8px', background:'#FFFBEB', textAlign:'right', color:'var(--ink-4)', fontStyle:'italic', fontSize:10 }}>กรอกราคา</td>
                  <td style={{ padding:'10px 8px', background:'#FFFBEB', textAlign:'right', color:'var(--ink-4)', fontStyle:'italic', fontSize:10 }}>auto</td>
                </tr>
              );
            })}
            {[...Array(Math.max(0, 3 - items.length))].map((_,i) => (
              <tr key={'pad'+i} style={{ borderBottom:'1px solid #E5DFD0', height:38 }}>
                <td colSpan={8}></td>
              </tr>
            ))}
            <tr style={{ background:'#F6F2E9' }}>
              <td colSpan={6} style={{ padding:'10px', textAlign:'right', fontSize:11.5, color:'var(--ink-2)' }}>
                มูลค่ารวมรายการ (Subtotal)
              </td>
              <td colSpan={2} style={{ padding:'10px', textAlign:'right', color:'var(--ink-4)', fontStyle:'italic', fontSize:10.5 }}>—</td>
            </tr>
            <tr style={{ background:'#FFFBEB' }}>
              <td colSpan={6} style={{ padding:'8px 10px', textAlign:'right', fontSize:11.5, color:'var(--ink-2)' }}>
                Overhead <span style={{ color:'var(--ink-3)' }}>…………… % (Supplier ใส่)</span>
                {overheadHint && <span style={{ marginLeft:8, fontSize:10, color:'var(--ink-3)', fontStyle:'italic' }}>หมายเหตุ: {overheadHint}</span>}
              </td>
              <td colSpan={2} style={{ padding:'8px 10px', textAlign:'right', color:'var(--ink-4)', fontStyle:'italic', fontSize:10.5 }}>—</td>
            </tr>
            <tr style={{ background:'#FFFBEB' }}>
              <td colSpan={6} style={{ padding:'8px 10px', textAlign:'right', fontSize:11.5, color:'var(--ink-2)' }}>
                VAT &nbsp;
                <span style={{ display:'inline-flex', alignItems:'center', gap:14, fontSize:11, color:'var(--ink-2)' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                    <span style={{ display:'inline-block', width:12, height:12, border:'1.4px solid var(--ink-2)', borderRadius:2, background:'#FFFFFF' }} /> มี
                  </span>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                    <span style={{ display:'inline-block', width:12, height:12, border:'1.4px solid var(--ink-2)', borderRadius:2, background:'#FFFFFF' }} /> ไม่มี
                  </span>
                </span>
                <span style={{ color:'var(--ink-3)', marginLeft:8 }}>(Supplier ติ๊ก)</span>
                {vatPolicy === 'include'  && <span style={{ marginLeft:8, fontSize:10, color:'var(--ink-3)', fontStyle:'italic' }}>นโยบาย: ราคารวม VAT แล้ว</span>}
                {vatPolicy === 'exclude'  && <span style={{ marginLeft:8, fontSize:10, color:'var(--ink-3)', fontStyle:'italic' }}>นโยบาย: ราคายังไม่รวม VAT</span>}
                {vatPolicy === 'supplier' && <span style={{ marginLeft:8, fontSize:10, color:'var(--ink-3)', fontStyle:'italic' }}>นโยบาย: Supplier ระบุ</span>}
              </td>
              <td colSpan={2} style={{ padding:'8px 10px', textAlign:'right', color:'var(--ink-4)', fontStyle:'italic', fontSize:10.5 }}>—</td>
            </tr>
            <tr style={{ background:'#15130E', color:'#FFFFFF' }}>
              <td colSpan={6} style={{ padding:'12px 10px', textAlign:'right', fontWeight:500, fontSize:13 }}>รวมราคา</td>
              <td colSpan={2} style={{ padding:'12px 10px', textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13 }}>
                ………… บาท
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop:32 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <div style={{ fontSize:11, letterSpacing:0.12, textTransform:'uppercase', color:'var(--ink-3)', fontWeight:600 }}>
              เงื่อนไขในใบเสนอราคา · 5 ข้อ
            </div>
            <span style={{ padding:'2px 8px', background:'#FFF4CC', color:'#6B5121', fontSize:9, fontWeight:600, letterSpacing:0.04, borderRadius:3 }}>
              SUPPLIER กรอก
            </span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            {[
              { icon:'💳', label:'เงื่อนไขการชำระเงิน',  hint:'ระบุเครดิตเทอม · ช่องทาง · งวด' },
              { icon:'🚚', label:'เงื่อนไขการจัดส่ง',     hint:'ค่าขนส่ง · จุดส่งมอบ' },
              { icon:'⏱',  label:'เงื่อนไขการยืนราคา',    hint:'ระบุจำนวนวันที่ราคามีผล' },
              { icon:'🛡️', label:'เงื่อนไขการรับประกัน',  hint:'ระยะเวลา · ขอบเขต · ข้อยกเว้น' },
              { icon:'📦', label:'Lead Time ในการสั่ง',  hint:'จำนวนวันหลังออก PO ถึงส่งมอบ' },
            ].map((c) => (
              <div key={c.label} style={{ padding:'12px 14px', background:'#FFFBEB', border:'1px dashed #D6CFBC', borderRadius:4 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <span style={{ fontSize:13 }}>{c.icon}</span>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--ink-2)' }}>{c.label}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ borderBottom:'1px solid #D6CFBC', height:0 }} />
                  ))}
                </div>
                <div style={{ marginTop:6, fontSize:10, color:'var(--ink-4)', fontStyle:'italic' }}>{c.hint}</div>
              </div>
            ))}
          </div>
        </div>

        {notes && (
          <div style={{ marginTop:16 }}>
            <div style={{ fontSize:10, letterSpacing:0.12, textTransform:'uppercase', color:'var(--ink-3)', marginBottom:6 }}>หมายเหตุเพิ่มเติม</div>
            <p style={{ margin:0, color:'var(--ink-2)', fontSize:12, lineHeight:1.7, whiteSpace:'pre-wrap' }}>{notes}</p>
          </div>
        )}

        <div style={{ marginTop:12, fontSize:11, color:'var(--ink-3)', fontStyle:'italic' }}>
          * Supplier กรุณากรอกเงื่อนไขทั้ง 5 ข้อ · Description ของแต่ละรายการ · Overhead (%) และระบุสถานะ VAT — ฝ่ายจัดซื้อจะใช้ข้อมูลเปรียบเทียบกับ Supplier รายอื่น
        </div>

        {/* Sign-off — driven by Approval Roles master data */}
        {(() => {
          const roles = (approvalRoles || []).filter(r => r.active).sort((a,b) => (a.level||0)-(b.level||0));
          const all = [...roles, { name: `ผู้เสนอราคา (${supplier?.name || '—'})`, _supplier:true }];
          const cols = Math.max(all.length, 4);
          return (
            <div style={{ marginTop:48, display:'grid', gridTemplateColumns:`repeat(${cols}, 1fr)`, gap:24 }}>
              {[...Array(cols)].map((_,i) => {
                const r = all[i];
                return (
                  <div key={i} style={{
                    borderTop: r ? '1px solid var(--ink-3)' : '1px dashed var(--rule-2)',
                    paddingTop:8, fontSize:11,
                    color: r ? 'var(--ink-3)' : 'var(--ink-4)', textAlign:'center',
                    fontStyle: r ? 'normal' : 'italic',
                  }}>
                    {r ? r.name : '(ยังไม่ระบุ)'}<br/>
                    <span style={{ color:'var(--ink-4)' }}>
                      {r?._supplier ? 'ลงนาม / ประทับตรา' : 'ลงนาม / วันที่'}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
