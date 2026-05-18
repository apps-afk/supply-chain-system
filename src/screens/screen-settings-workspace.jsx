'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';

const MODELS = [
  { value: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5 (เร็ว, ราคาประหยัด)' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (สมดุล)' },
  { value: 'claude-opus-4-7',   label: 'Claude Opus 4.7 (ฉลาดที่สุด)' },
];

const COUNTRIES = [
  { value: 'Thailand',  label: 'ประเทศไทย' },
  { value: 'Singapore', label: 'สิงคโปร์' },
  { value: 'Malaysia',  label: 'มาเลเซีย' },
  { value: 'Vietnam',   label: 'เวียดนาม' },
];
const CURRENCIES = ['THB', 'USD', 'SGD', 'MYR', 'VND'];
const LANGUAGES = [
  { value: 'th', label: 'ภาษาไทย' },
  { value: 'en', label: 'English' },
];
const TIMEZONES = [
  'Asia/Bangkok (GMT+7)',
  'Asia/Singapore (GMT+8)',
  'Asia/Kuala_Lumpur (GMT+8)',
  'Asia/Ho_Chi_Minh (GMT+7)',
];
const SESSION_OPTIONS = [
  { value: 0.25, label: '15 นาที' },
  { value: 1,    label: '1 ชั่วโมง' },
  { value: 8,    label: '8 ชั่วโมง' },
  { value: 24,   label: '24 ชั่วโมง' },
];
const DSAR_TYPE = {
  access:  { label: 'ขอดูข้อมูล',    color: '#2A4A41', bg: '#DEE7E3' },
  export:  { label: 'ขอ export',     color: '#6B5121', bg: '#F0E4C5' },
  correct: { label: 'ขอแก้ไข',       color: '#3D5224', bg: '#E3EAD3' },
  delete:  { label: 'ขอลบข้อมูล',    color: '#8B2A1A', bg: '#FDE8E4' },
};

export function ScreenSettingsWorkspace({ go }) {
  const { data: session } = useSession();
  const me = session?.user;

  const [settings, setSettings]   = useState(null);
  const [original, setOriginal]   = useState(null);
  const [subProc, setSubProc]     = useState([]);
  const [team, setTeam]           = useState([]);
  const [dsar, setDsar]           = useState({ queue: [], stats: { pending: 0, avgDays: 4 } });
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState(null);
  const [showDsar, setShowDsar]   = useState(false);

  async function load() {
    setLoading(true);
    try {
      const requests = [
        fetch('/api/workspace').then(r => r.json()).catch(() => ({})),
        fetch('/api/users').then(r => r.json()).catch(() => ({})),
        fetch('/api/workspace/dsar').then(r => r.json()).catch(() => ({})),
      ];
      const [ws, us, dq] = await Promise.all(requests);
      if (ws.settings) {
        setSettings(ws.settings);
        setOriginal(JSON.parse(JSON.stringify(ws.settings)));
      }
      if (ws.subProcessors) setSubProc(ws.subProcessors);
      if (us.users) setTeam(us.users);
      if (dq.queue) setDsar({ queue: dq.queue, stats: dq.stats });
    } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const dirty = useMemo(() =>
    settings && original && JSON.stringify(settings) !== JSON.stringify(original),
    [settings, original]
  );

  function patch(path, value) {
    setSettings(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) setToast({ msg: data.error || 'บันทึกไม่สำเร็จ', tone: 'err' });
      else {
        setOriginal(JSON.parse(JSON.stringify(data.settings)));
        setSettings(data.settings);
        setToast({ msg: 'บันทึกเรียบร้อย', tone: 'ok' });
        setTimeout(() => setToast(null), 2500);
      }
    } catch {
      setToast({ msg: 'เครือข่ายขัดข้อง', tone: 'err' });
    }
    setSaving(false);
  }

  function revert() {
    setSettings(JSON.parse(JSON.stringify(original)));
  }

  if (me && me.role !== 'admin') {
    return (
      <div className="page">
        <div className="page-head">
          <div className="page-title">
            <div className="eyebrow">ตั้งค่า</div>
            <h1 className="h-display">ไม่มีสิทธิ์เข้าใช้งาน</h1>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 6 }}>
              หน้านี้สำหรับผู้ดูแลระบบเท่านั้น
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !settings) {
    return (
      <div className="page">
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head" style={{ alignItems: 'flex-start' }}>
        <div className="page-title">
          <div className="eyebrow">ตั้งค่า</div>
          <h1 className="h-display">ตั้งค่าพื้นที่ทำงาน</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 6, maxWidth: 640 }}>
            กำหนดค่าทีม, ค่าเริ่มต้นการให้คะแนน AI, การควบคุมความเป็นธรรม, ความปลอดภัย และการเชื่อมต่อ
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {dirty && <button className="btn" onClick={revert}>ยกเลิก</button>}
          <button className="btn primary" onClick={save} disabled={!dirty || saving}>
            {saving ? 'กำลังบันทึก…' : 'บันทึกการเปลี่ยนแปลง'}
          </button>
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          padding: '12px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: toast.tone === 'ok' ? 'var(--teal)' : '#8B2A1A',
          color: 'white',
          boxShadow: '0 8px 24px -8px rgba(20,18,14,0.3)',
        }}>{toast.msg}</div>
      )}

      {/* Row 1: Org + AI Defaults */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 32 }}>
        <Card title="ข้อมูลองค์กร">
          <OrgInfoSection s={settings.org} on={(k, v) => patch(`org.${k}`, v)} />
        </Card>
        <Card title="ค่าเริ่มต้นการให้คะแนน AI">
          <AIDefaultsSection s={settings.ai} on={(k, v) => patch(`ai.${k}`, v)} />
        </Card>
      </div>

      {/* Row 2: Security & Data Protection */}
      <Card title="ความปลอดภัยและการปกป้องข้อมูล" subtitle="ตั้งค่าการป้องกันข้อมูลรั่วไหล และการเข้าถึงระบบ" style={{ marginTop: 24 }}>
        <SecuritySection s={settings.security} on={(k, v) => patch(`security.${k}`, v)} />
      </Card>

      {/* Row 3: AI Usage Controls */}
      <Card title="การควบคุมการใช้ AI" subtitle="งบประมาณ, ข้อมูลส่วนตัว, และนโยบายการตรวจสอบของมนุษย์" style={{ marginTop: 24 }}>
        <AIUsageSection s={settings.aiUsage} on={(k, v) => patch(`aiUsage.${k}`, v)} />
      </Card>

      {/* Row 4: Privacy & DSR */}
      <Card title="ความเป็นส่วนตัวและสิทธิเจ้าของข้อมูล" subtitle="PDPA — Data Subject Rights" style={{ marginTop: 24 }}>
        <PrivacySection
          dsar={dsar}
          subProc={subProc}
          settings={settings.privacy}
          onShowDsar={() => setShowDsar(true)}
        />
      </Card>

      {/* Row 5: Team mini */}
      <Card title="ทีมและสิทธิ์" actionLabel="Manage team →" onAction={() => go('settings-team')} style={{ marginTop: 24 }}>
        <TeamMini members={team} />
      </Card>

      {showDsar && (
        <DsarModal
          dsar={dsar}
          onClose={() => setShowDsar(false)}
          onResolved={async () => {
            const dq = await fetch('/api/workspace/dsar').then(r => r.json());
            if (dq.queue) setDsar({ queue: dq.queue, stats: dq.stats });
          }}
        />
      )}
    </div>
  );
}

/* ============================================================
   Sections
   ============================================================ */

function OrgInfoSection({ s, on }) {
  const initials = (s.name || 'IE').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 10,
          background: 'var(--ochre)', color: 'white',
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600,
        }}>{initials}</div>
        <button type="button" className="btn" style={{ fontSize: 13 }}>อัปโหลดโลโก้</button>
      </div>

      <Field label="ชื่อบริษัท" hint="แสดงในระบบและในอีเมลที่ส่งถึงผู้ใช้และผู้ขาย">
        <input style={inputStyle} value={s.name} onChange={e => on('name', e.target.value)} />
      </Field>

      <Field label="โดเมนอีเมล" hint="ใช้ตรวจหาเพื่อนร่วมงานจากโดเมนนี้โดยอัตโนมัติ">
        <input style={inputStyle} value={s.domain} onChange={e => on('domain', e.target.value)} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="ประเทศ">
          <Select value={s.country} onChange={v => on('country', v)} options={COUNTRIES.map(c => ({ value: c.value, label: c.label }))} />
        </Field>
        <Field label="สกุลเงิน">
          <Select value={s.currency} onChange={v => on('currency', v)} options={CURRENCIES.map(c => ({ value: c, label: c }))} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="ภาษาเริ่มต้น">
          <Select value={s.language} onChange={v => on('language', v)} options={LANGUAGES} />
        </Field>
        <Field label="เขตเวลา" hint="ผู้ใช้ใหม่จะเห็นเขตเวลานี้เป็นค่าเริ่มต้น">
          <Select value={s.timezone} onChange={v => on('timezone', v)} options={TIMEZONES.map(z => ({ value: z, label: z }))} />
        </Field>
      </div>
    </div>
  );
}

function AIDefaultsSection({ s, on }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="โมเดลเริ่มต้น" hint="ใช้ประเมินใบเสนอราคาและสัญญาทุกฉบับ สามารถกำหนดเฉพาะโครงการได้">
        <Select value={s.defaultModel} onChange={v => on('defaultModel', v)} options={MODELS} />
      </Field>

      <ToggleRow
        label="คัดกรองอัตโนมัติเมื่ออัปโหลด"
        hint="เริ่มการประเมิน AI ทันทีเมื่ออัปโหลดใบเสนอราคา"
        value={s.autoEvaluateOnUpload}
        onChange={v => on('autoEvaluateOnUpload', v)}
      />
      <ToggleRow
        label="คำนวณคะแนนใหม่เมื่อ RFQ เปลี่ยน"
        hint="จัดอันดับผู้ขายใหม่อัตโนมัติเมื่อแก้ไขเงื่อนไข RFQ"
        value={s.recomputeOnRequirementChange}
        onChange={v => on('recomputeOnRequirementChange', v)}
      />

      <Field label="ระดับคำอธิบาย">
        <Segmented
          value={s.explanationLevel}
          onChange={v => on('explanationLevel', v)}
          options={[
            { value: 'short',    label: 'สั้น' },
            { value: 'medium',   label: 'พอดี' },
            { value: 'detailed', label: 'ละเอียด' },
          ]}
        />
      </Field>

      <ToggleRow
        label="แสดงช่วงความมั่นใจ"
        hint="แสดงค่า ± ข้างคะแนน"
        value={s.showConfidence}
        onChange={v => on('showConfidence', v)}
      />
    </div>
  );
}

function SecuritySection({ s, on }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <ToggleRow
        label="บังคับใช้ 2FA สำหรับผู้ดูแลระบบ"
        hint="ต้องยืนยันรหัส OTP ทุกครั้งที่ login (แนะนำ)"
        value={s.require2FA}
        onChange={v => on('require2FA', v)}
        divider
      />
      <ToggleRow
        label="ปิดบังข้อมูลส่วนบุคคล (PII) ในรายงาน"
        hint="ชื่อ-อีเมล-โทรศัพท์จะถูกแสดงบางส่วน เช่น s***@i***.com"
        value={s.maskPII}
        onChange={v => on('maskPII', v)}
        divider
      />
      <ToggleRow
        label="ใส่ลายน้ำเอกสารที่ดาวน์โหลด"
        hint="ฝังชื่อผู้ดาวน์โหลด + เวลาเข้า PDF เพื่อตามรอยข้อมูลรั่ว"
        value={s.watermarkDownloads}
        onChange={v => on('watermarkDownloads', v)}
        divider
      />
      <ToggleRow
        label="บล็อก field ที่ละเอียดอ่อนจาก export"
        hint="ห้าม export คอลัมน์เลขประจำตัวประชาชน, เงินเดือน, ข้อมูลธนาคาร"
        value={s.restrictedFieldsBlock}
        onChange={v => on('restrictedFieldsBlock', v)}
        divider
      />

      <div style={{ padding: '16px 0', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>หมดเวลา Session</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>
          ออกจากระบบอัตโนมัติเมื่อไม่ได้ใช้งานนานเกินที่กำหนด
        </div>
        <Segmented
          value={s.sessionTimeoutHours}
          onChange={v => on('sessionTimeoutHours', v)}
          options={SESSION_OPTIONS}
        />
      </div>

      <div style={{ padding: '16px 0', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>จำกัด export ครั้งละ</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              ห้าม export ข้อมูลผู้ขาย/ผู้ใช้เกินจำนวนต่อครั้ง (ป้องกัน bulk leak)
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number" min="10" max="10000"
              style={{ ...inputStyle, width: 100, textAlign: 'right' }}
              value={s.maxBulkExport}
              onChange={e => on('maxBulkExport', parseInt(e.target.value) || 0)}
            />
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>รายการ</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 0', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>IP allowlist</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>
          ระบุ IP ที่อนุญาตเข้าระบบ (คั่นด้วยจุลภาค) — เว้นว่าง = ไม่จำกัด
        </div>
        <textarea
          rows={2}
          placeholder="203.0.113.45, 198.51.100.0/24"
          style={{ ...inputStyle, fontFamily: 'var(--font-mono)', resize: 'vertical' }}
          value={s.ipAllowlist}
          onChange={e => on('ipAllowlist', e.target.value)}
        />
      </div>

      <div style={{ paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>เก็บ audit log</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            ระยะเวลาเก็บประวัติการเข้าถึงและแก้ไขข้อมูล
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number" min="30" max="3650"
            style={{ ...inputStyle, width: 100, textAlign: 'right' }}
            value={s.auditLogRetentionDays}
            onChange={e => on('auditLogRetentionDays', parseInt(e.target.value) || 0)}
          />
          <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>วัน</span>
        </div>
      </div>
    </div>
  );
}

function AIUsageSection({ s, on }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ padding: '4px 0 16px', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>งบ token รายเดือน</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              จำกัดค่าใช้จ่าย AI — ถ้าใช้ครบจะหยุดคัดกรองอัตโนมัติ (ยังทำมือได้)
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number" min="0" step="100000"
              style={{ ...inputStyle, width: 140, textAlign: 'right' }}
              value={s.monthlyTokenBudget}
              onChange={e => on('monthlyTokenBudget', parseInt(e.target.value) || 0)}
            />
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>tokens</span>
          </div>
        </div>
      </div>

      <ToggleRow
        label="อนุญาตให้ผู้ให้บริการ AI เก็บข้อมูลเพื่อฝึกโมเดล"
        hint="ปิดไว้เพื่อความปลอดภัย — Anthropic ไม่ใช้ข้อมูลฝึกโมเดลโดยค่าเริ่มต้น"
        value={s.allowTrainingData}
        onChange={v => on('allowTrainingData', v)}
        tone={s.allowTrainingData ? 'warn' : 'ok'}
        divider
      />
      <ToggleRow
        label="ต้องให้คนตรวจสอบก่อนตัดสินใจสำคัญ"
        hint="AI เสนอผลได้แต่การอนุมัติสุดท้ายต้องเป็นคน (Human-in-the-loop)"
        value={s.requireHumanReview}
        onChange={v => on('requireHumanReview', v)}
        divider
      />
      <ToggleRow
        label="บล็อกผู้ให้บริการ AI ภายนอกที่ไม่ได้รับอนุมัติ"
        hint="ป้องกันการเรียก API ของ OpenAI, Gemini, ฯลฯ ที่ยังไม่ได้เซ็น DPA"
        value={s.blockExternalProviders}
        onChange={v => on('blockExternalProviders', v)}
        divider
      />

      <div style={{ paddingTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>ที่ตั้งข้อมูล (Data Residency)</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
          ตำแหน่งที่ข้อมูลถูกประมวลผลและจัดเก็บ
        </div>
        <div style={{
          padding: '10px 14px', background: 'var(--surface-2)',
          border: '1px solid var(--rule)', borderRadius: 6,
          fontSize: 13, color: 'var(--ink-2)',
          fontFamily: 'var(--font-mono)',
        }}>{s.dataResidency}</div>
      </div>
    </div>
  );
}

function PrivacySection({ dsar, subProc, settings, onShowDsar }) {
  return (
    <div>
      {/* DSAR Row */}
      <PrivacyRow
        title="คำขอเข้าถึงข้อมูลของเจ้าของข้อมูล (DSAR)"
        desc="ผู้ใช้/ผู้ขายขอดู, แก้ไข, โอนย้าย, หรือลบข้อมูลของตนได้ PDPA กำหนดให้ตอบกลับภายใน 30 วัน"
        action="ดูคิว DSAR"
        onAction={onShowDsar}
        footer={
          <div style={{ display: 'flex', gap: 18, marginTop: 4, fontSize: 13 }}>
            <span style={{ color: 'var(--clay)', fontWeight: 500 }}>
              ● {dsar.stats.pending} คำขอที่ค้างอยู่
            </span>
            <span style={{ color: 'var(--ink-3)' }}>
              เวลาเฉลี่ยในการตอบกลับ: {dsar.stats.avgDays} วัน
            </span>
          </div>
        }
      />

      <PrivacyRow
        title="บันทึกความยินยอม"
        desc={`ผู้ใช้และผู้ขายทุกคนยอมรับประกาศความเป็นส่วนตัวเมื่อสมัคร — บันทึกแก้ไขไม่ได้ (เวอร์ชัน ${settings.consentVersion}) ส่งออกได้`}
        action="ส่งออกบันทึกความยินยอม"
        onAction={() => alert('ส่งออกบันทึกความยินยอม — ฟังก์ชันนี้จะ generate CSV ในระบบจริง')}
      />

      <PrivacyRow
        title="ข้อตกลงประมวลผลข้อมูล (DPA)"
        desc="DPA มาตรฐานพร้อมดาวน์โหลด จำเป็นสำหรับความสัมพันธ์ผู้ควบคุม-ผู้ประมวลผลข้อมูล"
        action="ดาวน์โหลด DPA (PDF)"
        onAction={() => alert('ดาวน์โหลด DPA — ฟังก์ชันนี้จะส่งไฟล์ PDF ในระบบจริง')}
        footer={
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>ผู้ประมวลผลรอง</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {subProc.map(p => (
                <div key={p.code} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', background: 'var(--surface-2)',
                  borderRadius: 8,
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 6,
                    background: 'var(--paper-2)', color: 'var(--ink-2)',
                    display: 'grid', placeItems: 'center',
                    fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 600,
                  }}>{p.name[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      {p.purpose} · {p.region}
                      {p.note && ` (${p.note})`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>
              บริการของบุคคลที่สามที่ประมวลผลข้อมูลในนามของคุณ
            </div>
          </div>
        }
      />

      <PrivacyRow
        title="สิทธิในการลบข้อมูล (RTBF)"
        desc={`การลบที่ผู้ใช้/ผู้ขายร้องขอจะดำเนินการภายใน ${settings.rtbfDays} วัน รายการในบันทึกตรวจสอบจะถูกทำให้ไม่ระบุตัวตน ไม่ลบ`}
        last
      />
    </div>
  );
}

function TeamMini({ members }) {
  const display = (members || []).slice(0, 4);
  return (
    <div>
      {display.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
          ยังไม่มีสมาชิก
        </div>
      )}
      {display.map((m, i) => {
        const initials = (m.name || m.email).slice(0, 2).toUpperCase();
        const roleShort = {
          admin: 'ผู้ดูแล',
          hr_manager: 'หัวหน้างาน',
          procurement: 'จัดซื้อ',
          accountant: 'บัญชี',
          manager: 'ผู้จัดการ',
          user: 'ผู้ดู',
        }[m.role] || m.role;
        return (
          <div key={m.email} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 0',
            borderBottom: i === display.length - 1 ? 'none' : '1px solid var(--rule)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--paper-2)', color: 'var(--ink-2)',
              display: 'grid', placeItems: 'center',
              fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 500,
            }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{m.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{m.email}</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{roleShort}</div>
          </div>
        );
      })}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--rule)', fontSize: 12, color: 'var(--ink-3)' }}>
        เปลี่ยน role หรือลบสมาชิกได้ที่หน้า Users (เฉพาะ Admin)
      </div>
    </div>
  );
}

function DsarModal({ dsar, onClose, onResolved }) {
  async function resolve(id) {
    if (!confirm('ทำเครื่องหมายว่าตอบกลับคำขอนี้แล้ว?')) return;
    const res = await fetch('/api/workspace/dsar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) onResolved();
    else alert('ไม่สำเร็จ');
  }
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(20,18,14,0.5)',
      display: 'grid', placeItems: 'center', zIndex: 100, padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', padding: 28, borderRadius: 12,
        width: '100%', maxWidth: 720,
        maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 16px 48px -12px rgba(20,18,14,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500 }}>คิวคำขอ DSAR</div>
          <button className="btn ghost sm" onClick={onClose}>ปิด</button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>อีเมล</th>
              <th>ประเภท</th>
              <th>หมายเหตุ</th>
              <th>วันที่ขอ</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {dsar.queue.map(r => {
              const meta = DSAR_TYPE[r.type] || { label: r.type, color: 'var(--ink-2)', bg: 'var(--paper-2)' };
              return (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.applicantEmail}</td>
                  <td>
                    <span style={{
                      padding: '3px 9px', borderRadius: 999,
                      fontSize: 11, fontWeight: 500,
                      background: meta.bg, color: meta.color,
                    }}>{meta.label}</span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.note || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    {new Date(r.createdAt).toLocaleDateString('th-TH')}
                  </td>
                  <td>
                    {r.status === 'pending' ? (
                      <span style={{ fontSize: 12, color: 'var(--clay)' }}>● รอดำเนินการ</span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--moss)' }}>✓ เสร็จสิ้น</span>
                    )}
                  </td>
                  <td>
                    {r.status === 'pending' && (
                      <button className="btn sm" onClick={() => resolve(r.id)}>ทำเครื่องหมายเสร็จ</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================
   Small UI primitives
   ============================================================ */

function Card({ title, subtitle, children, actionLabel, onAction, style }) {
  return (
    <div className="card" style={{ padding: 28, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500, color: 'var(--ink)' }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{subtitle}</div>
          )}
        </div>
        {actionLabel && (
          <button
            onClick={onAction}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: 'var(--teal)', fontWeight: 500,
              fontFamily: 'var(--font-sans)', padding: '4px 8px',
            }}
          >{actionLabel}</button>
        )}
      </div>
      <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--rule)' }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 500,
        color: 'var(--ink-2)', marginBottom: 6, letterSpacing: '0.02em',
      }}>{label}</label>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>{hint}</div>
      )}
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(typeof options[0]?.value === 'number' ? Number(e.target.value) : e.target.value)}
      style={{
        ...inputStyle, paddingRight: 36, appearance: 'none',
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%236E6859' stroke-width='1.4' stroke-linecap='round'><path d='m3 4.5 3 3 3-3'/></svg>")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
        cursor: 'pointer',
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div style={{
      display: 'inline-flex', background: 'var(--paper-2)',
      borderRadius: 8, padding: 3, gap: 2,
    }}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              padding: '6px 14px', borderRadius: 6,
              background: active ? 'var(--surface)' : 'transparent',
              border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: active ? 500 : 400,
              color: active ? 'var(--ink)' : 'var(--ink-3)',
              fontFamily: 'var(--font-sans)',
              boxShadow: active ? '0 1px 2px rgba(20,18,14,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

function ToggleRow({ label, hint, value, onChange, tone, divider }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 16,
      padding: '14px 0',
      borderBottom: divider ? '1px solid var(--rule)' : 'none',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2, color: 'var(--ink)' }}>
          {label}
          {tone === 'warn' && value && (
            <span style={{
              marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 999,
              background: '#F0E4C5', color: '#6B5121',
            }}>คำเตือน</span>
          )}
        </div>
        {hint && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{hint}</div>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        position: 'relative', flexShrink: 0,
        width: 38, height: 22,
        background: value ? 'var(--ochre)' : 'var(--rule-2)',
        borderRadius: 999, border: 'none', cursor: 'pointer',
        padding: 0, transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: value ? 18 : 2,
        width: 18, height: 18, background: 'white', borderRadius: '50%',
        transition: 'left 0.2s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
      }} />
    </button>
  );
}

function PrivacyRow({ title, desc, action, onAction, footer, last }) {
  return (
    <div style={{
      padding: '18px 0',
      borderBottom: last ? 'none' : '1px solid var(--rule)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>{desc}</div>
        </div>
        {action && (
          <button
            onClick={onAction}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: 'var(--teal)', fontWeight: 500,
              fontFamily: 'var(--font-sans)', padding: '4px 8px',
              whiteSpace: 'nowrap',
            }}
          >{action}</button>
        )}
      </div>
      {footer}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 12px',
  border: '1px solid var(--rule-2)', borderRadius: 6,
  fontSize: 14, fontFamily: 'var(--font-sans)',
  outline: 'none', boxSizing: 'border-box',
  background: 'var(--surface)',
  color: 'var(--ink)',
};
