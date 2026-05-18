'use client';
import React from 'react';
import { Icons, Chip, Stat, Delta, Spark, Av, money } from '../lib/shell';

export function ScreenDashboard({ go }) {
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">ภาพรวม · พฤษภาคม 2568</div>
          <h1 className="h-display">สวัสดี นวพร —<br/>มีงานที่ต้องดูวันนี้ <span style={{color:'var(--ink-3)'}}>4 รายการ</span></h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn">{Icons.download} Export</button>
          <button className="btn primary" onClick={() => go('rfq-create')}>{Icons.plus} สร้าง RFQ</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)', padding: '28px 0' }}>
        {[
          { label: 'Price points ทั้งหมด', value: '1,284', unit: 'รายการ', sub: '+38 สัปดาห์นี้' },
          { label: 'RFQ ที่กำลังดำเนินการ', value: '12', unit: '/ 24 ใบ', sub: '6 ใบรอ Supplier ตอบกลับ' },
          { label: 'สัญญา Active', value: '47', unit: 'ฉบับ', sub: 'มูลค่ารวม ฿284.6M' },
          { label: 'เงินประกันคงเหลือ', value: '14.2', unit: 'ล้านบาท', sub: 'จะคืน 8 ฉบับใน 90 วัน' },
        ].map((s, i) => (
          <div key={i} style={{ paddingLeft: i === 0 ? 0 : 32, borderLeft: i === 0 ? 'none' : '1px solid var(--rule)' }}>
            <Stat {...s} />
          </div>
        ))}
      </div>

      <section style={{ marginTop: 56 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="h-section">ต้องดูวันนี้</h2>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>เรียงตามความเร่งด่วน</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <AttentionItem tag="สัญญาใกล้หมดอายุ" tone="warn" title="CT-2024-018 · งานติดตั้งระบบไฟฟ้า บางนา เฟส 2" meta="หจก. รุ่งเรืองไฟฟ้า · หมดอายุ 14 มิ.ย. 2568" right="28 วัน" onClick={() => go('contract-detail')} />
          <AttentionItem tag="ราคาผิดปกติ" tone="err" title="เหล็กเส้น DB12 สูงขึ้น +18.4% จากเดือนก่อน" meta="ดึงจาก RFQ-2025-019 · บริษัท เอเชียสตีล จำกัด" right="ตรวจสอบ" onClick={() => go('pricedb-detail')} />
          <AttentionItem tag="RFQ รอ Upload" tone="info" title="RFQ-2025-021 · งานก่อสร้างฐานราก ลาดพร้าว" meta="Supplier ส่งใบเสนอราคาแล้ว 2 วัน — รอบันทึก Price DB" right="Upload" onClick={() => go('rfq-confirm')} />
          <AttentionItem tag="ราคาไม่ได้อัพเดท" tone="info" title="กระเบื้องหลังคา CPAC โมเนียร์" meta="อัพเดทล่าสุด 9 ธ.ค. 2567 — เกิน 6 เดือน" right="ขอ Quote" onClick={() => go('rfq-create')} />
        </div>
      </section>

      <section style={{ marginTop: 64 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 className="h-section">การเคลื่อนไหวของราคา</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>วัสดุที่ราคาเปลี่ยนแปลงมากที่สุดในรอบ 30 วัน</p>
          </div>
          <button className="btn ghost" onClick={() => go('pricedb')}>ดู Price Database ทั้งหมด {Icons.chevronR}</button>
        </div>
        <div className="card" style={{ padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: '32%' }}>วัสดุ</th>
                <th>หมวด</th>
                <th>Supplier ราคาต่ำสุด</th>
                <th className="num-col">ราคาปัจจุบัน</th>
                <th className="num-col">Δ MoM</th>
                <th className="num-col">Δ YoY</th>
                <th>แนวโน้ม 6 เดือน</th>
              </tr>
            </thead>
            <tbody>
              <PriceRow name="เหล็กเส้น DB12" spec="มอก. 24-2559 · เส้น" cat="งานโครงสร้าง" supplier="เอเชียสตีล" supkind="aw" price={245} mom="+18.4%" momDir="up" yoy="+22.1%" yoyDir="up" spark={[140,148,151,150,165,172,180,195,210,228,240,245]} flag="err" onClick={() => go('pricedb-detail')} />
              <PriceRow name="ปูนซีเมนต์ ตราช้าง" spec="ปอร์ตแลนด์ · ถุง 50 กก." cat="งานโครงสร้าง" supplier="SCG Distribution" supkind="sc" price={165} mom="+1.9%" momDir="up" yoy="+3.2%" yoyDir="up" spark={[155,158,159,160,160,161,162,162,163,164,164,165]} />
              <PriceRow name="กระเบื้องเซรามิค 60×60" spec="Grade A · ตร.ม." cat="งานพื้น-ผนัง" supplier="ไทยเซรามิค" supkind="default" price={285} mom="−4.2%" momDir="down" yoy="−1.1%" yoyDir="down" spark={[298,302,300,298,295,294,292,290,290,288,287,285]} />
              <PriceRow name="อิฐมวลเบา Q-CON" spec="7.5×20×60 cm · ก้อน" cat="งานก่ออิฐ-ฉาบปูน" supplier="Q-CON Direct" supkind="default" price={28} mom="0.0%" momDir="flat" yoy="+5.2%" yoyDir="up" spark={[26.6,26.8,27,27.2,27.5,27.8,28,28,28,28,28,28]} />
              <PriceRow name="สีน้ำพลาสติก TOA SuperShield" spec="ภายนอก · แกลลอน" cat="งานสี" supplier="TOA Distribution" supkind="default" price={1180} mom="+2.6%" momDir="up" yoy="+8.7%" yoyDir="up" spark={[1085,1100,1110,1115,1130,1140,1145,1150,1155,1165,1170,1180]} />
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 64, display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid var(--rule)' }}>
            <h3 className="h-card">RFQ ล่าสุด</h3>
            <button className="btn ghost sm" onClick={() => go('rfq')}>ดูทั้งหมด {Icons.chevronR}</button>
          </div>
          <table className="tbl">
            <tbody>
              {[
                { no: 'RFQ-2025-024', title: 'งานปูกระเบื้องชั้น 2', sup: 'หจก. กระเบื้องช่าง', kind: 'default', state: 'sent', stateLabel: 'ส่งแล้ว', date: '17 พ.ค.' },
                { no: 'RFQ-2025-023', title: 'เหล็กรูปพรรณ H-Beam', sup: 'เอเชียสตีล', kind: 'aw', state: 'recv', stateLabel: 'รับ Quote', date: '16 พ.ค.' },
                { no: 'RFQ-2025-022', title: 'สุขภัณฑ์ COTTO', sup: 'COTTO Wholesale', kind: 'default', state: 'closed', stateLabel: 'ปิดงาน', date: '15 พ.ค.' },
                { no: 'RFQ-2025-021', title: 'งานฐานราก ลาดพร้าว', sup: 'พี.ที. คอนสตรัคชั่น', kind: 'default', state: 'recv', stateLabel: 'รับ Quote', date: '14 พ.ค.' },
              ].map((r, i) => (
                <tr key={i}>
                  <td style={{ width: '24%' }}><div className="font-mono" style={{ fontSize: 12, color: 'var(--ink-2)' }}>{r.no}</div></td>
                  <td>{r.title}</td>
                  <td><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Av initials={r.sup.slice(0, 2)} kind={r.kind} /><span style={{ fontSize: 12.5 }}>{r.sup}</span></span></td>
                  <td><Chip kind={r.state}>{r.stateLabel}</Chip></td>
                  <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 className="h-card" style={{ marginBottom: 16 }}>ความเร็วในการจัดซื้อ</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <VelocityRow label="เวลาเฉลี่ย Supplier ตอบ RFQ" value="3.2 วัน" bar={0.42} hint="เป้า: 5 วัน" />
            <VelocityRow label="RFQ ที่ปิดภายใน 14 วัน" value="78%" bar={0.78} hint="ดีขึ้น +6% MoM" />
            <VelocityRow label="ราคาเข้า Price DB อัตโนมัติ" value="92%" bar={0.92} hint="จาก RFQ ที่ปิดงาน" />
            <VelocityRow label="สัญญาส่งให้ AI ก่อนกฎหมาย" value="64%" bar={0.64} hint="เป้า: 90%" />
          </div>
          <hr className="hr" style={{ margin: '20px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>AI Forecast — ไตรมาสหน้า</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>คาดราคาเหล็กยังขาขึ้น 8–12% — พิจารณาล็อกราคา</div>
            </div>
            <Chip kind="ai">AI</Chip>
          </div>
        </div>
      </section>
    </div>
  );
}

function AttentionItem({ tag, tone, title, meta, right, onClick }) {
  const tones = { warn: 'var(--ochre)', err: 'var(--clay)', info: 'var(--teal)' };
  return (
    <div onClick={onClick} style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderLeft: `3px solid ${tones[tone]}`, borderRadius: 6, padding: '18px 20px', cursor: 'pointer', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <div className="eyebrow" style={{ color: tones[tone], marginBottom: 6 }}>{tag}</div>
        <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{meta}</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 4 }}>{right} {Icons.chevronR}</div>
    </div>
  );
}

function PriceRow({ name, spec, cat, supplier, supkind, price, mom, momDir, yoy, yoyDir, spark, flag, onClick }) {
  return (
    <tr onClick={onClick} style={{ cursor: 'pointer' }} className={flag ? `row-flag-${flag}` : ''}>
      <td><div style={{ fontWeight: 500 }}>{name}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{spec}</div></td>
      <td style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{cat}</td>
      <td><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Av initials={supplier.slice(0, 2)} kind={supkind} /><span style={{ fontSize: 12.5 }}>{supplier}</span></span></td>
      <td className="num-col num" style={{ fontWeight: 500 }}>{money(price)}</td>
      <td className="num-col"><Delta pct={mom} dir={momDir} /></td>
      <td className="num-col"><Delta pct={yoy} dir={yoyDir} /></td>
      <td><Spark data={spark} w={110} h={28} color={momDir === 'down' ? 'var(--moss)' : momDir === 'up' ? 'var(--clay)' : 'var(--ink-4)'} /></td>
    </tr>
  );
}

function VelocityRow({ label, value, bar, hint }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{label}</span>
        <span className="num" style={{ fontSize: 14, fontWeight: 500 }}>{value}</span>
      </div>
      <div className="bar"><i style={{ width: `${bar*100}%` }} /></div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{hint}</div>
    </div>
  );
}
