'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from '../lib/shell';
import { SettingsSearchBox } from '../lib/settings-shared';
import { usePermissions } from '../lib/use-permissions';
import { useTableView, Th, Pager, exportCSV } from '../lib/table-utils';

/*
  Compare List — index of all เปรียบเทียบราคา documents.
  - Backed by /api/comparisons (status: draft|finalized|archived)
  - 2 modes: Price DB (A) and RFQ (B) — derived from suppliers_json.mode
*/

const STATUS_PILL = {
  'draft':     { bg:'var(--chip-recv-bg)', fg:'var(--chip-recv-fg)', dot:'var(--ochre)', label:'ร่าง' },
  'finalized': { bg:'var(--moss-soft)',    fg:'#2F4A1A',             dot:'var(--moss)',  label:'เลือกแล้ว' },
  'archived':  { bg:'var(--paper-2)',      fg:'var(--ink-3)',        dot:'var(--ink-4)', label:'จัดเก็บ' },
};

const MODE_PILL = {
  'PriceDB': { bg:'#F0E4C5', fg:'#6B5121',         label:'จาก Price DB' },
  'RFQ':     { bg:'#DCE6E1', fg:'var(--teal-ink)', label:'จาก RFQ' },
};

export function ScreenCompareList({ go }) {
  const { canWrite } = usePermissions();
  const [docs, setDocs]                 = useState([]);
  const [loading, setLoading]           = useState(true);
  const [err, setErr]                   = useState('');
  const [q, setQ]                       = useState('');
  const [statusFilter, setStatusFilter] = useState('ทั้งหมด');
  const [modeFilter, setModeFilter]     = useState('ทั้งหมด');
  const [createOpen, setCreateOpen]     = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true); setErr('');
      try {
        const res = await fetch('/api/comparisons');
        const data = await res.json();
        if (!res.ok) setErr(data.error || 'โหลดข้อมูลไม่สำเร็จ');
        else setDocs(data.items || []);
      } catch {
        setErr('เครือข่ายขัดข้อง');
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const v = q.toLowerCase();
    return docs.filter(d => {
      if (statusFilter !== 'ทั้งหมด' && d.status !== statusFilter) return false;
      const mode = d.suppliers_json?.mode || 'PriceDB';
      if (modeFilter !== 'ทั้งหมด' && mode !== modeFilter) return false;
      if (q) {
        const hay = `${d.no || ''} ${d.title || ''} ${d.suppliers_json?.selectedSupplier || ''}`.toLowerCase();
        if (!hay.includes(v)) return false;
      }
      return true;
    });
  }, [docs, statusFilter, modeFilter, q]);

  const { view, page, pages, setPage, sortKey, sortDir, toggleSort, total } =
    useTableView(filtered, { pageSize: 25 });

  function fmtDate(s) {
    if (!s) return '—';
    try {
      const d = new Date(s);
      if (isNaN(d)) return s;
      return d.toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' });
    } catch { return s; }
  }

  // Status counts — single pass (was 3 separate .filter calls per render)
  const { draft, finalized, archived } = useMemo(() => {
    let d = 0, f = 0, a = 0;
    for (const x of docs) {
      if (x.status === 'draft') d++;
      else if (x.status === 'finalized') f++;
      else if (x.status === 'archived') a++;
    }
    return { draft: d, finalized: f, archived: a };
  }, [docs]);

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">Module 2 · Procurement</div>
          <h1 className="h-display">เปรียบเทียบราคา (Compare)</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', margin:'6px 0 0', maxWidth:620 }}>
            สร้างเอกสารเปรียบเทียบราคา — จาก <strong style={{ color:'var(--ink-2)' }}>Price Database</strong> หรือ
            จาก <strong style={{ color:'var(--ink-2)' }}>RFQ ที่จัดทำ</strong> · AI ช่วยวิเคราะห์และเสนอแนะ
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" onClick={() => exportCSV(
            'comparisons.csv',
            [
              { key:'no',                                                              label:'เลขที่' },
              { key:'title',                                                           label:'ชื่อ' },
              { key:'project_id',                                                      label:'โครงการ' },
              { key: d => (STATUS_PILL[d.status] || STATUS_PILL.draft).label,          label:'สถานะ' },
              { key: d => (Array.isArray(d.suppliers_json?.list) ? d.suppliers_json.list.length : 0), label:'จำนวน Supplier' },
              { key: d => d.total_low ?? '',                                           label:'มูลค่าต่ำสุด' },
              { key: d => fmtDate(d.created_at),                                       label:'วันที่สร้าง' },
            ],
            filtered
          )}>Export CSV</button>
          {canWrite && (
            <button className="btn primary" onClick={() => setCreateOpen(true)}>{Icons.plus} สร้างเอกสารเปรียบเทียบ</button>
          )}
        </div>
      </div>

      {/* Summary — 3 status counts only */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:0,
        borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)',
        padding:'24px 0', marginBottom:32,
      }}>
        <StatusStat label="ร่าง" count={draft}
          dot="var(--ochre)" valueColor="var(--ink)"
          sub="Compare แล้ว ยังไม่ปิด" />
        <StatusStat label="เลือกแล้ว" count={finalized}
          dot="var(--moss)" valueColor="var(--moss)"
          sub="Upload เอกสารแล้ว · ปิดเอกสาร"
          divider />
        <StatusStat label="จัดเก็บ" count={archived}
          dot="var(--ink-4)" valueColor="var(--ink-3)"
          sub="ปิดเก็บไว้เป็นข้อมูลอ้างอิง"
          divider />
      </div>

      {err && (
        <div style={{ background:'#FDE8E4', color:'#8B2A1A', padding:'10px 14px', borderRadius:6, fontSize:13, marginBottom:16 }}>{err}</div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4 }}>
          {['ทั้งหมด','draft','finalized','archived'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} className="btn sm" style={{
              background: statusFilter === f ? 'var(--ink)' : 'transparent',
              color: statusFilter === f ? 'var(--paper)' : 'var(--ink-2)',
              borderColor: statusFilter === f ? 'var(--ink)' : 'var(--rule)',
              padding:'5px 12px',
            }}>
              {f === 'ทั้งหมด' ? 'ทั้งหมด' : STATUS_PILL[f].label}
            </button>
          ))}
        </div>
        <span style={{ width:1, height:20, background:'var(--rule)', margin:'0 4px' }} />
        <div style={{ display:'flex', gap:4 }}>
          {['ทั้งหมด','PriceDB','RFQ'].map(f => (
            <button key={f} onClick={() => setModeFilter(f)} className="btn sm" style={{
              background: modeFilter === f ? 'var(--ink-2)' : 'transparent',
              color: modeFilter === f ? 'var(--paper)' : 'var(--ink-3)',
              borderColor: modeFilter === f ? 'var(--ink-2)' : 'var(--rule)',
              padding:'4px 10px', fontSize:11.5,
            }}>{f === 'PriceDB' ? 'จาก Price DB' : f === 'RFQ' ? 'จาก RFQ' : 'ทุกโหมด'}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
          <SettingsSearchBox value={q} onChange={setQ} placeholder="ค้นหา CMP / หมวด / โครงการ…" />
          <span style={{ fontSize:12, color:'var(--ink-3)' }}>
            <strong style={{ color:'var(--ink)' }}>{filtered.length}</strong> รายการ
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <Th sortKey="no" activeKey={sortKey} dir={sortDir} onSort={toggleSort} style={{ width:'12%' }}>เลขที่เอกสาร</Th>
              <th style={{ width:'11%' }}>โหมด</th>
              <Th sortKey="title" activeKey={sortKey} dir={sortDir} onSort={toggleSort}>หมวด / โครงการ</Th>
              <th className="num-col">จำนวนที่เปรียบเทียบ</th>
              <th>Supplier ที่เลือก</th>
              <Th sortKey="created_at" activeKey={sortKey} dir={sortDir} onSort={toggleSort}>วันที่สร้าง</Th>
              <Th sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggleSort}>Status</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>กำลังโหลด…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--ink-3)' }}>ยังไม่มีข้อมูล</td></tr>
            ) : view.map(d => {
              const sp = STATUS_PILL[d.status] || STATUS_PILL.draft;
              const mode = d.suppliers_json?.mode || 'PriceDB';
              const mp = MODE_PILL[mode] || MODE_PILL.PriceDB;
              const itemsCount    = Array.isArray(d.items_json) ? d.items_json.length : 0;
              const suppliersList = Array.isArray(d.suppliers_json?.list) ? d.suppliers_json.list : [];
              const selectedSup   = d.suppliers_json?.selectedSupplier || '';
              return (
                <tr key={d.id || d.no} onClick={() => {
                    // Stash the id so detail/upload-ref screens know which
                    // comparison they're working on (same pattern as RFQ).
                    try { window.localStorage.setItem('cmp.currentId', d.id); } catch {}
                    go('compare-detail');
                  }} style={{ cursor:'pointer' }}>
                  <td>
                    <div className="font-mono" style={{ fontSize:12, color:'var(--ink-2)', fontWeight:500 }}>{d.no}</div>
                  </td>
                  <td>
                    <span style={{
                      display:'inline-block', padding:'2px 10px', borderRadius:4,
                      background: mp.bg, color: mp.fg,
                      fontSize:11, fontWeight:500,
                    }}>{mp.label}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight:500 }}>{d.title}</div>
                    {d.project_id && <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:2 }}>{d.project_id}</div>}
                  </td>
                  <td className="num-col">
                    <span className="num" style={{ fontSize:12.5, color:'var(--ink-2)' }}>
                      {itemsCount} <span style={{ color:'var(--ink-4)' }}>รายการ ×</span> {suppliersList.length} <span style={{ color:'var(--ink-4)' }}>Supplier</span>
                    </span>
                  </td>
                  <td>
                    {selectedSup
                      ? <span style={{ fontSize:12.5, color:'var(--ink-2)', display:'inline-flex', alignItems:'center', gap:6 }}>
                          <span style={{ width:5, height:5, borderRadius:999, background:'var(--moss)' }} />
                          {selectedSup}
                        </span>
                      : <span style={{ fontSize:11.5, color:'var(--ink-4)', fontStyle:'italic' }}>—</span>}
                  </td>
                  <td style={{ fontSize:12, color:'var(--ink-3)' }}>
                    {fmtDate(d.created_at)}
                  </td>
                  <td>
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:6,
                      fontSize:11, fontWeight:500, padding:'2px 10px', borderRadius:999,
                      background: sp.bg, color: sp.fg,
                    }}>
                      <span style={{ width:6, height:6, borderRadius:999, background: sp.dot }} />
                      {sp.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pager page={page} pages={pages} setPage={setPage} total={total} />
      </div>

      {createOpen && <CreateModePicker onClose={() => setCreateOpen(false)} go={go} />}
    </div>
  );
}

function StatusStat({ label, count, sub, divider, dot, valueColor }) {
  return (
    <div style={{ paddingLeft: divider ? 28 : 0, borderLeft: divider ? '1px solid var(--rule)' : 'none' }}>
      <div className="stat-label" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
        <span style={{ width:6, height:6, borderRadius:999, background:dot }} />
        {label}
      </div>
      <div className="stat-value" style={{ color: valueColor }}>
        {count} <span className="unit">ฉบับ</span>
      </div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

/* =================== Create mode picker (entry to wizard) =================== */
function CreateModePicker({ onClose, go }) {
  const [hover, setHover] = useState(null);

  const Mode = ({ id, badge, title, desc, steps, icon, accent }) => {
    const hot = hover === id;
    return (
      <div
        onMouseEnter={() => setHover(id)}
        onMouseLeave={() => setHover(null)}
        onClick={() => { onClose(); go(id === 'A' ? 'compare-create-pricedb' : 'compare-create-rfq'); }}
        style={{
          padding:'24px', borderRadius:8, cursor:'pointer',
          border:'1px solid', borderColor: hot ? accent : 'var(--rule)',
          background: hot ? 'var(--surface-2)' : 'var(--surface)',
          transition:'all 0.15s', position:'relative', overflow:'hidden',
        }}>
        <div style={{
          position:'absolute', top:0, left:0, right:0, height:3,
          background: accent, opacity: hot ? 1 : 0.4, transition:'opacity 0.15s',
        }} />
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
          <span style={{
            width:44, height:44, borderRadius:8,
            background: accent, color:'var(--paper)',
            display:'grid', placeItems:'center', fontSize:18, flexShrink:0,
          }}>{icon}</span>
          <div>
            <div className="eyebrow" style={{ marginBottom:2, color: hot ? accent : 'var(--ink-3)' }}>{badge}</div>
            <div style={{ fontSize:16, fontWeight:500 }}>{title}</div>
          </div>
        </div>
        <p style={{ fontSize:12.5, color:'var(--ink-3)', margin:'0 0 16px', lineHeight:1.6 }}>{desc}</p>
        <div style={{ borderTop:'1px solid var(--rule)', paddingTop:14 }}>
          <div className="eyebrow" style={{ marginBottom:8, fontSize:9.5 }}>ขั้นตอน</div>
          <ol style={{ margin:0, paddingLeft:18, fontSize:12, lineHeight:1.8, color:'var(--ink-2)' }}>
            {steps.map((s,i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
        <button className="btn sm" style={{
          marginTop:16, background: hot ? accent : 'transparent',
          color: hot ? 'var(--paper)' : 'var(--ink-2)',
          borderColor: hot ? accent : 'var(--rule)',
        }}>เลือกโหมดนี้ →</button>
      </div>
    );
  };

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(20,18,14,0.32)',
      display:'grid', placeItems:'center', zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} className="card"
           style={{ width:880, padding:0, boxShadow:'var(--sh-pop)' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--rule)' }}>
          <div className="eyebrow" style={{ marginBottom:4 }}>สร้างเอกสารเปรียบเทียบราคาใหม่</div>
          <h3 className="h-section">เลือกโหมดที่จะใช้</h3>
        </div>
        <div style={{ padding:24, display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <Mode
            id="A"
            badge="โหมด A · ราคาในระบบ"
            title="เลือกจาก Price Database"
            desc="ใช้ราคาล่าสุดในระบบจาก Price DB ไม่ต้องรอ Supplier — เหมาะสำหรับสำรวจราคาก่อนตัดสินใจหรือเทียบราคาประวัติ"
            icon={Icons.pricedb}
            accent="var(--ochre)"
            steps={[
              'เลือก Source : Material หรือ SubContract',
              'เลือก Item ที่ต้องการเปรียบเทียบ',
              'เลือก Supplier (≥2 ราย) ที่มีราคาในระบบ',
              'Compare ทันที — ระบบดึงราคาล่าสุดมาแสดง',
            ]}
          />
          <Mode
            id="B"
            badge="โหมด B · ใบเสนอราคาตัวจริง"
            title="เลือกจาก RFQ ที่จัดทำ"
            desc="นำใบเสนอราคาที่ Supplier ตอบกลับมาเปรียบเทียบกัน — มีเงื่อนไขจริงจาก Supplier ที่อยู่บนเอกสาร"
            icon={Icons.rfq}
            accent="var(--teal)"
            steps={[
              'เลือก RFQ จากรายการ (status: Received)',
              'จัด match รายการเดียวกันข้าม RFQ',
              'AI วิเคราะห์ราคา + เงื่อนไข',
              'Compare และ Generate เอกสาร',
            ]}
          />
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--rule)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--surface-2)' }}>
          <div style={{ fontSize:11.5, color:'var(--ink-3)', display:'inline-flex', alignItems:'center', gap:8 }}>
            <span style={{ padding:'1px 8px', borderRadius:3, background:'var(--teal-soft)', color:'var(--teal-ink)', fontSize:10, fontWeight:600, letterSpacing:0.06 }}>AI</span>
            ทุกโหมดมีระบบ AI ช่วยเสนอแนะ Supplier ที่เหมาะสม และคำนวณส่วนต่างราคาให้อัตโนมัติ
          </div>
          <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
        </div>
      </div>
    </div>
  );
}
