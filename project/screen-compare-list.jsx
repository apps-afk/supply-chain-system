/* global React, Icons, Chip, Av, money, settingsInputStyle, SettingsField, SettingsModal, SettingsSearchBox, SettingsStatStrip, StatusPill */
/*
  Compare List — index of all เปรียบเทียบราคา documents.
  - Auto-run code CMP-NNNNN
  - 2 modes: Price DB (A) and RFQ (B)
  - 3 statuses:
      Pending   = รอเลือก  (Compare แล้ว แต่ยังไม่ Upload เอกสารที่เลือก)
      Decided   = เลือกแล้ว (Upload เอกสารแล้ว)
      Reference = เพื่อเป็นข้อมูล (เปรียบเทียบเฉยๆ)
*/

const { useState: useStateCL } = React;

const COMPARE_DOCS = [
  {
    code:'CMP-2025-038', mode:'RFQ',     status:'Decided',   category:'งานโครงสร้าง',
    project:'IE-LV04 · Initial Living รังสิต', items:5, suppliers:3,
    selectedSupplier:'รุ่งเรืองสตีล',
    created:'17 พ.ค. 68',  refUploaded:'19 พ.ค. 68',
  },
  {
    code:'CMP-2025-037', mode:'RFQ',     status:'Pending',   category:'งานหลังคา',
    project:'IE-VL02 · Initial Villa',         items:3, suppliers:3,
    selectedSupplier:null,
    created:'15 พ.ค. 68',  refUploaded:null,
  },
  {
    code:'CMP-2025-036', mode:'PriceDB', status:'Pending',   category:'งานสี',
    project:'IE-LV01 · Initial Living บางนา',  items:4, suppliers:3,
    selectedSupplier:null,
    created:'14 พ.ค. 68',  refUploaded:null,
  },
  {
    code:'CMP-2025-035', mode:'RFQ',     status:'Decided',   category:'งานสุขภัณฑ์',
    project:'IE-TH03 · Initial Town',          items:8, suppliers:2,
    selectedSupplier:'COTTO Wholesale',
    created:'12 พ.ค. 68',  refUploaded:'14 พ.ค. 68',
  },
  {
    code:'CMP-2025-034', mode:'PriceDB', status:'Reference', category:'งานก่ออิฐ-ฉาบปูน',
    project:'IE-LV01 · Initial Living บางนา',  items:2, suppliers:3,
    selectedSupplier:null,
    created:'12 พ.ค. 68',  refUploaded:null,
  },
  {
    code:'CMP-2025-033', mode:'RFQ',     status:'Decided',   category:'งานพื้น-ผนัง',
    project:'IE-LV04 · Initial Living รังสิต', items:6, suppliers:3,
    selectedSupplier:'ไทยเซรามิค',
    created:'10 พ.ค. 68',  refUploaded:'12 พ.ค. 68',
  },
  {
    code:'CMP-2025-032', mode:'PriceDB', status:'Decided',   category:'งานระบบไฟฟ้า',
    project:'IE-LV04 · Initial Living รังสิต', items:3, suppliers:3,
    selectedSupplier:'BCC Electric',
    created:'8 พ.ค. 68',   refUploaded:'10 พ.ค. 68',
  },
  {
    code:'CMP-2025-031', mode:'PriceDB', status:'Reference', category:'งานโครงสร้าง',
    project:'IE-LV04 · Initial Living รังสิต', items:5, suppliers:3,
    selectedSupplier:null,
    created:'5 พ.ค. 68',   refUploaded:null,
  },
];

const STATUS_PILL = {
  'Pending':   { bg:'var(--chip-recv-bg)', fg:'var(--chip-recv-fg)', dot:'var(--ochre)', label:'รอเลือก' },
  'Decided':   { bg:'var(--moss-soft)',    fg:'#2F4A1A',             dot:'var(--moss)',  label:'เลือกแล้ว' },
  'Reference': { bg:'var(--paper-2)',      fg:'var(--ink-3)',        dot:'var(--ink-4)', label:'เพื่อเป็นข้อมูล' },
};

const MODE_PILL = {
  'PriceDB': { bg:'#F0E4C5', fg:'#6B5121',         label:'จาก Price DB' },
  'RFQ':     { bg:'#DCE6E1', fg:'var(--teal-ink)', label:'จาก RFQ' },
};

function ScreenCompareList({ go }) {
  const [q, setQ] = useStateCL('');
  const [statusFilter, setStatusFilter] = useStateCL('ทั้งหมด');
  const [modeFilter, setModeFilter] = useStateCL('ทั้งหมด');
  const [createOpen, setCreateOpen] = useStateCL(false);

  const filtered = COMPARE_DOCS.filter(d => {
    if (statusFilter !== 'ทั้งหมด' && d.status !== statusFilter) return false;
    if (modeFilter   !== 'ทั้งหมด' && d.mode   !== modeFilter)   return false;
    if (q) {
      const v = q.toLowerCase();
      if (!(d.code.toLowerCase().includes(v) || d.category.includes(q) || d.project.includes(q) || (d.selectedSupplier||'').includes(q))) return false;
    }
    return true;
  });

  const pending   = COMPARE_DOCS.filter(d => d.status === 'Pending').length;
  const decided   = COMPARE_DOCS.filter(d => d.status === 'Decided').length;
  const reference = COMPARE_DOCS.filter(d => d.status === 'Reference').length;

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
          <button className="btn primary" onClick={() => setCreateOpen(true)}>{Icons.plus} สร้างเอกสารเปรียบเทียบ</button>
        </div>
      </div>

      {/* Summary — 3 status counts only */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:0,
        borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)',
        padding:'24px 0', marginBottom:32,
      }}>
        <StatusStat label="รอเลือก" count={pending}
          dot="var(--ochre)" valueColor="var(--ink)"
          sub="Compare แล้ว แต่ยังไม่ Upload เอกสารที่เลือก" />
        <StatusStat label="เลือกแล้ว" count={decided}
          dot="var(--moss)" valueColor="var(--moss)"
          sub="Upload เอกสารแล้ว · ปิดเอกสาร"
          divider />
        <StatusStat label="เพื่อเป็นข้อมูล" count={reference}
          dot="var(--ink-4)" valueColor="var(--ink-3)"
          sub="เปรียบเทียบเฉยๆ ไม่ได้นำไปตัดสินใจ"
          divider />
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4 }}>
          {['ทั้งหมด','Pending','Decided','Reference'].map(f => (
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
              <th style={{ width:'12%' }}>เลขที่เอกสาร</th>
              <th style={{ width:'11%' }}>โหมด</th>
              <th>หมวด / โครงการ</th>
              <th className="num-col">จำนวนที่เปรียบเทียบ</th>
              <th>Supplier ที่เลือก</th>
              <th>วันที่สร้าง</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const sp = STATUS_PILL[d.status];
              const mp = MODE_PILL[d.mode];
              return (
                <tr key={d.code} onClick={() => go('compare-detail')} style={{ cursor:'pointer' }}>
                  <td>
                    <div className="font-mono" style={{ fontSize:12, color:'var(--ink-2)', fontWeight:500 }}>{d.code}</div>
                  </td>
                  <td>
                    <span style={{
                      display:'inline-block', padding:'2px 10px', borderRadius:4,
                      background: mp.bg, color: mp.fg,
                      fontSize:11, fontWeight:500,
                    }}>{mp.label}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight:500 }}>{d.category}</div>
                    <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:2 }}>{d.project}</div>
                  </td>
                  <td className="num-col">
                    <span className="num" style={{ fontSize:12.5, color:'var(--ink-2)' }}>
                      {d.items} <span style={{ color:'var(--ink-4)' }}>รายการ ×</span> {d.suppliers} <span style={{ color:'var(--ink-4)' }}>Supplier</span>
                    </span>
                  </td>
                  <td>
                    {d.selectedSupplier
                      ? <span style={{ fontSize:12.5, color:'var(--ink-2)', display:'inline-flex', alignItems:'center', gap:6 }}>
                          <span style={{ width:5, height:5, borderRadius:999, background:'var(--moss)' }} />
                          {d.selectedSupplier}
                        </span>
                      : <span style={{ fontSize:11.5, color:'var(--ink-4)', fontStyle:'italic' }}>—</span>}
                  </td>
                  <td style={{ fontSize:12, color:'var(--ink-3)' }}>
                    {d.created}
                    {d.refUploaded && <div style={{ fontSize:10.5, color:'var(--moss)', marginTop:2 }}>📎 Ref {d.refUploaded}</div>}
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
  const [hover, setHover] = useStateCL(null);

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

window.ScreenCompareList = ScreenCompareList;
window.COMPARE_DOCS = COMPARE_DOCS;
