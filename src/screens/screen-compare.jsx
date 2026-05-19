'use client';
import React from 'react';
import { Icons, Chip } from '../lib/shell';

/*
  Compare result — Mode B (RFQ × 3 suppliers).
  Editorial side-by-side. The brief calls it "the heart of the procurement decision";
  show it like a printed comparison document, ready for PDF export.
*/

export function ScreenCompare({ go }) {
  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => go('compare')} style={{ marginBottom: 20, marginLeft: -8 }}>
        {Icons.back} กลับไป Compare
      </button>

      <div className="page-head" style={{ alignItems: 'flex-start' }}>
        <div className="page-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <Chip kind="active">โหมด B · จาก RFQ</Chip>
          </div>
          <h1 className="h-display">เปรียบเทียบราคา</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn">{Icons.edit} แก้ไข</button>
          <button className="btn" onClick={() => go('compare-upload-ref')}>{Icons.upload} Upload Ref</button>
          <button className="btn">{Icons.doc} ดูตัวอย่าง PDF</button>
          <button className="btn primary">{Icons.download} Export PDF</button>
        </div>
      </div>

      {/* Empty state */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>
          ยังไม่มีข้อมูล
        </div>
      </div>
    </div>
  );
}
