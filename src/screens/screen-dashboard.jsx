'use client';
import React from 'react';
import { useSession } from 'next-auth/react';
import { Icons, Stat, InitialEstateLogo } from '../lib/shell';

const MONTHS_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

export function ScreenDashboard({ go }) {
  const { data: session } = useSession();
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'ผู้ใช้งาน';
  const now = new Date();
  const monthLabel = `${MONTHS_TH[now.getMonth()]} ${now.getFullYear() + 543}`;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">
          <div className="eyebrow">ภาพรวม · {monthLabel}</div>
          <h1 className="h-display">สวัสดี {userName} —<br/>ยินดีต้อนรับสู่ระบบจัดซื้อ ซัพพลายเชน</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          <InitialEstateLogo width={120} style={{ opacity: 0.82 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn">{Icons.download} ส่งออกข้อมูล</button>
            <button className="btn primary" onClick={() => go('rfq-create')}>{Icons.plus} สร้างใบขอราคา</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)', padding: '28px 0' }}>
        {[
          { label: 'ราคาในระบบทั้งหมด',            value: '0', unit: 'รายการ', sub: 'ยังไม่มีข้อมูล' },
          { label: 'ใบขอราคาที่กำลังดำเนินการ',     value: '0', unit: 'ใบ',     sub: 'ยังไม่มีรายการ' },
          { label: 'สัญญาที่ใช้งานอยู่',             value: '0', unit: 'ฉบับ',    sub: 'ยังไม่มีรายการ' },
          { label: 'เงินประกันคงเหลือ',              value: '0', unit: 'บาท',    sub: 'ยังไม่มีรายการ' },
        ].map((s, i) => (
          <div key={i} style={{ paddingLeft: i === 0 ? 0 : 32, borderLeft: i === 0 ? 'none' : '1px solid var(--rule)' }}>
            <Stat {...s} />
          </div>
        ))}
      </div>

      <section style={{ marginTop: 56 }}>
        <h2 className="h-section">ต้องดูวันนี้</h2>
        <div className="card" style={{ marginTop: 16, padding: '60px 24px', textAlign: 'center', color: 'var(--ink-3)' }}>
          <div style={{ fontSize: 14 }}>ยังไม่มีรายการที่ต้องดำเนินการ</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>ระบบจะแจ้งเตือนเมื่อมีสัญญาใกล้หมดอายุ, ราคาผิดปกติ, หรือใบขอราคารอการอนุมัติ</div>
        </div>
      </section>

      <section style={{ marginTop: 56 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 className="h-section">การเคลื่อนไหวของราคา</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>วัสดุที่ราคาเปลี่ยนแปลงมากที่สุดในรอบ 30 วัน</p>
          </div>
          <button className="btn ghost" onClick={() => go('pricedb')}>ดูฐานข้อมูลราคาทั้งหมด {Icons.chevronR}</button>
        </div>
        <div className="card" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--ink-3)' }}>
          <div style={{ fontSize: 14 }}>ยังไม่มีข้อมูลราคา</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>เพิ่มราคาใน "ฐานข้อมูลราคา" หรือสร้างใบขอราคาเพื่อเริ่มเก็บข้อมูล</div>
        </div>
      </section>

      <section style={{ marginTop: 56 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 className="h-section">ใบขอราคาล่าสุด</h2>
          <button className="btn ghost sm" onClick={() => go('rfq')}>ดูทั้งหมด {Icons.chevronR}</button>
        </div>
        <div className="card" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--ink-3)' }}>
          <div style={{ fontSize: 14 }}>ยังไม่มีใบขอราคา</div>
          <button className="btn primary sm" style={{ marginTop: 14 }} onClick={() => go('rfq-create')}>
            {Icons.plus} สร้างใบขอราคาแรก
          </button>
        </div>
      </section>
    </div>
  );
}
