'use client';
import React, { useState } from 'react';
import { Icons, Chip, Av, money } from '../lib/shell';

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
            <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>CMP-2025-038</span>
            <Chip kind="active">โหมด B · จาก RFQ</Chip>
          </div>
          <h1 className="h-display">เปรียบเทียบราคา —<br />เหล็กเส้น & ปูน ล็อต Q2</h1>
          <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 13, color: 'var(--ink-3)' }}>
            <span>โครงการ: <strong style={{ color: 'var(--ink-2)' }}>IE-LV04 · Initial Living รังสิต</strong></span>
            <span>เปรียบเทียบ <strong style={{ color: 'var(--ink-2)' }}>3 Supplier</strong></span>
            <span>สร้างเมื่อ <strong style={{ color: 'var(--ink-2)' }}>17 พ.ค. 2568</strong></span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn">{Icons.edit} แก้ไข</button>
          <button className="btn" onClick={() => go('compare-upload-ref')}>{Icons.upload} Upload Ref</button>
          <button className="btn">{Icons.doc} ดูตัวอย่าง PDF</button>
          <button className="btn primary">{Icons.download} Export PDF</button>
        </div>
      </div>

      {/* AI Suggestion banner */}
      <div style={{
        marginBottom:24, padding:'18px 22px',
        background:'linear-gradient(135deg, var(--teal-soft) 0%, #F1ECDB 100%)',
        border:'1px solid var(--teal)', borderRadius:8,
        display:'flex', alignItems:'center', gap:16,
      }}>
        <span style={{
          width:36, height:36, borderRadius:999, background:'var(--teal)',
          color:'var(--paper)', display:'inline-grid', placeItems:'center',
          fontSize:14, fontWeight:600, flexShrink:0,
        }}>AI</span>
        <div style={{ flex:1 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <span className="eyebrow" style={{ color:'var(--teal-ink)' }}>AI Suggestion</span>
            <span style={{ fontSize:10, padding:'1px 6px', borderRadius:3, background:'var(--paper)', color:'var(--teal-ink)', fontWeight:600, letterSpacing:0.06 }}>BETA</span>
          </div>
          <div style={{ fontSize:16, lineHeight:1.4, color:'var(--teal-ink)' }}>
            แนะนำให้เลือก <strong>รุ่งเรืองสตีล</strong> · ราคารวมต่ำสุด <strong>฿1,235,000</strong> · ประหยัด <span style={{ color:'var(--moss)' }}>฿37,000 (3.0%)</span> · ส่งมอบเร็วที่สุด (10 วัน) — ตามด้วย SCG (เครดิต 60 วัน)
          </div>
        </div>
      </div>

      {/* Supplier header strip */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '320px repeat(3, 1fr)' }}>
          <div style={{ padding: '20px 24px', background: 'var(--surface-2)', borderRight: '1px solid var(--rule)' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>เปรียบเทียบจาก</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>3 ใบ RFQ</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>5 รายการต่อใบ</div>
          </div>
          {[
            { rfq:'RFQ-2025-019', sup:'เอเชียสตีล',   kind:'aw', rating:4.2, recv:'14 พ.ค.', winner:false },
            { rfq:'RFQ-2025-020', sup:'รุ่งเรืองสตีล', kind:'rr', rating:4.5, recv:'14 พ.ค.', winner:true },
            { rfq:'RFQ-2025-021', sup:'SCG Distribution', kind:'sc', rating:4.8, recv:'15 พ.ค.', winner:false },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '20px 24px',
              borderRight: i < 2 ? '1px solid var(--rule)' : 'none',
              background: s.winner ? 'var(--surface-2)' : 'var(--surface)',
              position: 'relative',
            }}>
              {s.winner && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: 'var(--teal)',
                }} />
              )}
              <div className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6 }}>{s.rfq}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Av initials={s.sup.slice(0,2)} kind={s.kind} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{s.sup}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Rating {s.rating} · รับ {s.recv}</div>
                </div>
                {s.winner && <Chip kind="active" style={{ marginLeft: 'auto' }}>ราคาต่ำสุด</Chip>}
              </div>
            </div>
          ))}
        </div>

        {/* Items */}
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 320 }}>รายการ</th>
              <th className="num-col">เอเชียสตีล</th>
              <th className="num-col">รุ่งเรืองสตีล</th>
              <th className="num-col">SCG</th>
            </tr>
          </thead>
          <tbody>
            {cmpItems.map((it, i) => {
              const min = Math.min(it.asia, it.rung, it.scg);
              return (
                <tr key={i}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{it.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                      <span className="num">{it.qty.toLocaleString()}</span> {it.unit}
                      <span style={{ margin: '0 8px' }}>·</span>
                      Price DB: <span className="num" style={{ color: 'var(--ink-2)' }}>{money(it.dbRef)}</span>
                    </div>
                  </td>
                  {['asia','rung','scg'].map(key => (
                    <td key={key} className="num-col" style={{
                      background: it[key] === min ? 'var(--teal-soft)' : 'transparent',
                      position: 'relative',
                    }}>
                      <div className="num" style={{ fontSize: 14, fontWeight: it[key] === min ? 600 : 500 }}>
                        {money(it[key])}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                        รวม <span className="num">{money(it[key] * it.qty)}</span>
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
            {/* Totals row */}
            <tr style={{ background: 'var(--surface-2)' }}>
              <td style={{ fontWeight: 500 }}>รวมทั้งสิ้น <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}>(ก่อน VAT)</span></td>
              <td className="num-col">
                <div className="num font-serif" style={{ fontSize: 20 }}>฿1,242,500</div>
                <div style={{ fontSize: 11, color: 'var(--clay)', marginTop: 2 }}>+฿7,500</div>
              </td>
              <td className="num-col" style={{ background: 'var(--teal-soft)' }}>
                <div className="num font-serif" style={{ fontSize: 20, color: 'var(--teal-ink)' }}>฿1,235,000</div>
                <div style={{ fontSize: 11, color: 'var(--teal)', marginTop: 2, fontWeight: 500 }}>ต่ำสุด</div>
              </td>
              <td className="num-col">
                <div className="num font-serif" style={{ fontSize: 20 }}>฿1,272,000</div>
                <div style={{ fontSize: 11, color: 'var(--clay)', marginTop: 2 }}>+฿37,000</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Terms comparison */}
        <div style={{ borderTop: '1px solid var(--rule)', background: 'var(--paper-2)' }}>
          <div style={{ padding: '14px 24px' }}>
            <div className="eyebrow">เงื่อนไข · Terms Comparison</div>
          </div>
          <table className="tbl" style={{ background: 'transparent' }}>
            <tbody>
              {[
                { label:'การชำระเงิน',  asia:'เครดิต 45 วัน', rung:'เครดิต 30 วัน', scg:'เครดิต 60 วัน', best:'rung' },
                { label:'การจัดส่ง',     asia:'ฟรีหน้างาน',     rung:'ฟรีหน้างาน',     scg:'ฟรีหน้างาน',     best:null },
                { label:'การยืนราคา',    asia:'30 วัน',         rung:'30 วัน',         scg:'60 วัน',         best:'scg' },
                { label:'การรับประกัน',  asia:'—',              rung:'มอก. รับประกัน', scg:'มอก. 1 ปี',       best:'scg' },
                { label:'VAT',           asia:'ยังไม่รวม',      rung:'ยังไม่รวม',      scg:'ยังไม่รวม',      best:null },
                { label:'ระยะเวลาส่งมอบ', asia:'14 วัน',         rung:'10 วัน',         scg:'21 วัน',          best:'rung' },
              ].map((t, i) => (
                <tr key={i} style={{ background: 'transparent' }}>
                  <td style={{ width: 320, fontSize: 12.5, color: 'var(--ink-2)', background: 'transparent' }}>{t.label}</td>
                  {['asia','rung','scg'].map(key => (
                    <td key={key} style={{
                      fontSize: 12.5,
                      background: t.best === key ? 'var(--teal-soft)' : 'transparent',
                      color: t.best === key ? 'var(--teal-ink)' : 'var(--ink-2)',
                      fontWeight: t.best === key ? 500 : 400,
                    }}>{t[key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>หมายเหตุ</div>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>
            ใบเปรียบเทียบนี้สร้างจาก RFQ จำนวน 3 ใบ ราคารวมทั้งหมดยังไม่รวมภาษีมูลค่าเพิ่ม 7%
            <br /><br />
            การเลือกผู้ชนะและการสั่งซื้อ (PO) จะดำเนินการนอกระบบตามขั้นตอนเดิมของบริษัท —
            ระบบทำหน้าที่สร้างเอกสารเปรียบเทียบเท่านั้น สามารถ Print เพื่อเซ็นอนุมัติ และนำไปแนบในระบบ Pojjaman ได้
          </p>
        </div>
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>ผลการประเมิน</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, lineHeight: 1.3, marginBottom: 8 }}>
            ประหยัด <span style={{ color: 'var(--moss)' }}>฿37,000</span> ถ้าเลือกราคาต่ำสุด
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0, lineHeight: 1.6 }}>
            รุ่งเรืองสตีล ให้ราคาต่ำสุดและส่งมอบเร็วที่สุด (10 วัน) — แต่เครดิตเทอมสั้นกว่า SCG 30 วัน
          </p>
        </div>
      </div>
    </div>
  );
}

const cmpItems = [
  { name:'เหล็กเส้น DB12',  qty:2000, unit:'เส้น', dbRef:228, asia:245, rung:248, scg:252 },
  { name:'เหล็กเส้น DB16',  qty:1500, unit:'เส้น', dbRef:312, asia:325, rung:318, scg:330 },
  { name:'เหล็กเส้น DB20',  qty:400,  unit:'เส้น', dbRef:506, asia:512, rung:506, scg:520 },
  { name:'ปูนซีเมนต์ ตราช้าง', qty:500,  unit:'ถุง 50 กก.', dbRef:163, asia:165, rung:170, scg:166 },
  { name:'ลวดผูกเหล็ก เบอร์ 22', qty:800, unit:'กก.', dbRef:65, asia:68, rung:65, scg:70 },
];
