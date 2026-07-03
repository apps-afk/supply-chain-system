'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar, Topbar } from './lib/shell';

// Dashboard is eagerly imported — it's the landing screen, no point delaying it
import { ScreenDashboard } from './screens/screen-dashboard';

// Everything else is code-split: each chunk loads only when the user navigates
// to that screen. Webpack needs literal paths in import() to emit one chunk
// per file — see https://webpack.js.org/api/module-methods/#dynamic-expressions
const LoadingPage = () => (
  <div className="page" style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>
    กำลังโหลด…
  </div>
);
const ScreenRFQ                    = dynamic(() => import('./screens/screen-rfq').then(m => ({ default: m.ScreenRFQ })), { loading: LoadingPage });
const ScreenRFQConfirm             = dynamic(() => import('./screens/screen-rfq').then(m => ({ default: m.ScreenRFQConfirm })), { loading: LoadingPage });
const ScreenRFQCreate              = dynamic(() => import('./screens/screen-rfq-create').then(m => ({ default: m.ScreenRFQCreate })), { loading: LoadingPage });
const ScreenCompareList            = dynamic(() => import('./screens/screen-compare-list').then(m => ({ default: m.ScreenCompareList })), { loading: LoadingPage });
const ScreenCompare                = dynamic(() => import('./screens/screen-compare').then(m => ({ default: m.ScreenCompare })), { loading: LoadingPage });
const ScreenCompareCreatePriceDB   = dynamic(() => import('./screens/screen-compare-create-pricedb').then(m => ({ default: m.ScreenCompareCreatePriceDB })), { loading: LoadingPage });
const ScreenCompareCreateRFQ       = dynamic(() => import('./screens/screen-compare-create-rfq').then(m => ({ default: m.ScreenCompareCreateRFQ })), { loading: LoadingPage });
const ScreenCompareUploadRef       = dynamic(() => import('./screens/screen-compare-upload-ref').then(m => ({ default: m.ScreenCompareUploadRef })), { loading: LoadingPage });
const ScreenPriceDB                = dynamic(() => import('./screens/screen-pricedb').then(m => ({ default: m.ScreenPriceDB })), { loading: LoadingPage });
const ScreenPriceDBDetail          = dynamic(() => import('./screens/screen-pricedb').then(m => ({ default: m.ScreenPriceDBDetail })), { loading: LoadingPage });
const ScreenContractList           = dynamic(() => import('./screens/screen-contract').then(m => ({ default: m.ScreenContractList })), { loading: LoadingPage });
const ScreenContract               = dynamic(() => import('./screens/screen-contract').then(m => ({ default: m.ScreenContract })), { loading: LoadingPage });
const ScreenPOList                 = dynamic(() => import('./screens/screen-po').then(m => ({ default: m.ScreenPOList })), { loading: LoadingPage });
const ScreenPODetail               = dynamic(() => import('./screens/screen-po').then(m => ({ default: m.ScreenPODetail })), { loading: LoadingPage });
const ScreenSupplierDB             = dynamic(() => import('./screens/screen-supplierdb').then(m => ({ default: m.ScreenSupplierDB })), { loading: LoadingPage });
const ScreenSupplierDBDetail       = dynamic(() => import('./screens/screen-supplierdb').then(m => ({ default: m.ScreenSupplierDBDetail })), { loading: LoadingPage });
const ScreenSettingsProjects       = dynamic(() => import('./screens/screen-settings-projects').then(m => ({ default: m.ScreenSettingsProjects })), { loading: LoadingPage });
const ScreenSettingsProjectTypes   = dynamic(() => import('./screens/screen-settings-project-types').then(m => ({ default: m.ScreenSettingsProjectTypes })), { loading: LoadingPage });
const ScreenSettingsSuppliers      = dynamic(() => import('./screens/screen-settings-suppliers').then(m => ({ default: m.ScreenSettingsSuppliers })), { loading: LoadingPage });
const ScreenSettingsMaterials      = dynamic(() => import('./screens/screen-settings-materials').then(m => ({ default: m.ScreenSettingsMaterials })), { loading: LoadingPage });
const ScreenSettingsMaterialMainCategories = dynamic(() => import('./screens/screen-settings-material-main-categories').then(m => ({ default: m.ScreenSettingsMaterialMainCategories })), { loading: LoadingPage });
const ScreenSettingsMaterialSubCategories  = dynamic(() => import('./screens/screen-settings-material-sub-categories').then(m => ({ default: m.ScreenSettingsMaterialSubCategories })), { loading: LoadingPage });
const ScreenSettingsSubcontracts   = dynamic(() => import('./screens/screen-settings-subcontracts').then(m => ({ default: m.ScreenSettingsSubcontracts })), { loading: LoadingPage });
const ScreenSettingsContractTypes  = dynamic(() => import('./screens/screen-settings-contract-types').then(m => ({ default: m.ScreenSettingsContractTypes })), { loading: LoadingPage });
const ScreenSettingsUnits          = dynamic(() => import('./screens/screen-settings-units').then(m => ({ default: m.ScreenSettingsUnits })), { loading: LoadingPage });
const ScreenSettingsUsers          = dynamic(() => import('./screens/screen-settings-users').then(m => ({ default: m.ScreenSettingsUsers })), { loading: LoadingPage });
const ScreenSettingsApprovalRoles  = dynamic(() => import('./screens/screen-settings-approval-roles').then(m => ({ default: m.ScreenSettingsApprovalRoles })), { loading: LoadingPage });
const ScreenSettingsAccount        = dynamic(() => import('./screens/screen-settings-account').then(m => ({ default: m.ScreenSettingsAccount })), { loading: LoadingPage });
const ScreenSettingsTeam           = dynamic(() => import('./screens/screen-settings-team').then(m => ({ default: m.ScreenSettingsTeam })), { loading: LoadingPage });
const ScreenSettingsWorkspace      = dynamic(() => import('./screens/screen-settings-workspace').then(m => ({ default: m.ScreenSettingsWorkspace })), { loading: LoadingPage });

const CRUMBS = {
  'dashboard':              ['ภาพรวม'],
  'rfq':                    ['งานหลัก', 'ใบขอเสนอราคา'],
  'rfq-confirm':            ['งานหลัก', 'ใบขอเสนอราคา', 'RFQ-2025-019', 'ตรวจสอบก่อนบันทึก'],
  'rfq-create':             ['งานหลัก', 'ใบขอเสนอราคา', 'สร้างใหม่'],
  'compare':                ['งานหลัก', 'เปรียบเทียบราคา'],
  'compare-detail':         ['งานหลัก', 'เปรียบเทียบราคา', 'CMP-2025-038'],
  'compare-create-pricedb': ['งานหลัก', 'เปรียบเทียบราคา', 'สร้างจากฐานข้อมูลราคา'],
  'compare-create-rfq':     ['งานหลัก', 'เปรียบเทียบราคา', 'สร้างจากใบขอเสนอราคา'],
  'compare-upload-ref':     ['งานหลัก', 'เปรียบเทียบราคา', 'อัปโหลดข้อมูลอ้างอิง'],
  'pricedb':                ['งานหลัก', 'ฐานข้อมูลราคา'],
  'pricedb-detail':         ['งานหลัก', 'ฐานข้อมูลราคา', 'เหล็กเส้น DB12'],
  'po':                     ['งานหลัก', 'ใบสั่งซื้อ'],
  'po-detail':              ['งานหลัก', 'ใบสั่งซื้อ', 'รายละเอียด'],
  'contract':               ['งานหลัก', 'เอกสาร'],
  'contract-detail':        ['งานหลัก', 'เอกสาร', 'รายละเอียดเอกสาร'],
  'supplierdb':             ['ข้อมูล', 'ฐานข้อมูลผู้ขาย'],
  'supplierdb-detail':      ['ข้อมูล', 'ฐานข้อมูลผู้ขาย', 'SUP-00002'],
  'settings-projects':       ['ตั้งค่า', 'ข้อมูลหลัก', 'โครงการ'],
  'settings-project-types':  ['ตั้งค่า', 'ข้อมูลหลัก', 'ประเภทโครงการ'],
  'settings-suppliers':      ['ตั้งค่า', 'ข้อมูลหลัก', 'ผู้ขาย/ผู้รับเหมา'],
  'settings-materials':      ['ตั้งค่า', 'ข้อมูลหลัก', 'วัสดุ · รายการ'],
  'settings-material-main-categories': ['ตั้งค่า', 'ข้อมูลหลัก', 'วัสดุ · หมวดหลัก'],
  'settings-material-sub-categories':  ['ตั้งค่า', 'ข้อมูลหลัก', 'วัสดุ · หมวดย่อย'],
  'settings-subcontracts':   ['ตั้งค่า', 'ข้อมูลหลัก', 'งานจ้างเหมา'],
  'settings-contract-types': ['ตั้งค่า', 'ข้อมูลหลัก', 'ประเภทเอกสาร'],
  'settings-units':          ['ตั้งค่า', 'ข้อมูลหลัก', 'หน่วยนับ'],
  'settings-users':          ['ตั้งค่า', 'ข้อมูลหลัก', 'ผู้ใช้งาน'],
  'settings-approval-roles': ['ตั้งค่า', 'ข้อมูลหลัก', 'ตำแหน่งผู้อนุมัติ'],
  'settings-account':        ['ตั้งค่า', 'บัญชีของฉัน'],
  'settings-team':           ['ตั้งค่า', 'ทีมงานและสิทธิ์'],
  'settings-workspace':      ['ตั้งค่า', 'พื้นที่ทำงาน'],
};

const ACTIVE_NAV = {
  'dashboard':              'dashboard',
  'rfq':                    'rfq',
  'rfq-confirm':            'rfq',
  'rfq-create':             'rfq',
  'compare':                'compare',
  'compare-detail':         'compare',
  'compare-create-pricedb': 'compare',
  'compare-create-rfq':     'compare',
  'compare-upload-ref':     'compare',
  'pricedb':                'pricedb',
  'pricedb-detail':         'pricedb',
  'po':                     'po',
  'po-detail':              'po',
  'contract':               'contract',
  'contract-detail':        'contract',
  'supplierdb':             'supplierdb',
  'supplierdb-detail':      'supplierdb',
  'settings-projects':       'projects',
  'settings-project-types':  'project-types',
  'settings-suppliers':      'suppliers',
  'settings-materials':      'materials',
  'settings-material-main-categories': 'material-main-categories',
  'settings-material-sub-categories':  'material-sub-categories',
  'settings-subcontracts':   'subcontracts',
  'settings-contract-types': 'contract-types',
  'settings-units':          'units',
  'settings-users':          'users',
  'settings-approval-roles': 'approval-roles',
  'settings-account':        'account',
  'settings-team':           'team',
  'settings-workspace':      'workspace',
};

export default function App() {
  // Always start with 'dashboard' so server-side HTML matches client-side
  // hydration (reading window.location.hash here would cause a mismatch
  // and trigger a full client re-render after hydration)
  const [screen, setScreen] = useState('dashboard');
  const isFirstMount = useRef(true);

  // After hydration, sync screen from the URL hash and listen for back/forward
  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (CRUMBS[hash]) setScreen(prev => (prev !== hash ? hash : prev));
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  // Update URL hash + scroll when the user navigates (but NOT on first mount,
  // otherwise we'd overwrite any deep-link the user opened)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const current = window.location.hash.replace('#', '');
    if (current !== screen) window.location.hash = screen;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [screen]);

  // Stable identity so memoized Sidebar/Topbar don't re-render when only
  // unrelated state in App changes
  const go = useCallback((id) => setScreen(id), []);

  const renderScreen = () => {
    switch (screen) {
      case 'dashboard':              return <ScreenDashboard go={go} />;
      case 'rfq':                    return <ScreenRFQ go={go} />;
      case 'rfq-confirm':            return <ScreenRFQConfirm go={go} />;
      case 'rfq-create':             return <ScreenRFQCreate go={go} />;
      case 'compare':                return <ScreenCompareList go={go} />;
      case 'compare-detail':         return <ScreenCompare go={go} />;
      case 'compare-create-pricedb': return <ScreenCompareCreatePriceDB go={go} />;
      case 'compare-create-rfq':     return <ScreenCompareCreateRFQ go={go} />;
      case 'compare-upload-ref':     return <ScreenCompareUploadRef go={go} />;
      case 'pricedb':                return <ScreenPriceDB go={go} />;
      case 'pricedb-detail':         return <ScreenPriceDBDetail go={go} />;
      case 'contract':               return <ScreenContractList go={go} />;
      case 'contract-detail':        return <ScreenContract go={go} />;
      case 'po':                     return <ScreenPOList go={go} />;
      case 'po-detail':              return <ScreenPODetail go={go} />;
      case 'supplierdb':             return <ScreenSupplierDB go={go} />;
      case 'supplierdb-detail':      return <ScreenSupplierDBDetail go={go} />;
      case 'settings-projects':       return <ScreenSettingsProjects go={go} />;
      case 'settings-project-types':  return <ScreenSettingsProjectTypes go={go} />;
      case 'settings-suppliers':      return <ScreenSettingsSuppliers go={go} />;
      case 'settings-materials':      return <ScreenSettingsMaterials go={go} />;
      case 'settings-material-main-categories': return <ScreenSettingsMaterialMainCategories go={go} />;
      case 'settings-material-sub-categories':  return <ScreenSettingsMaterialSubCategories  go={go} />;
      case 'settings-subcontracts':   return <ScreenSettingsSubcontracts go={go} />;
      case 'settings-contract-types': return <ScreenSettingsContractTypes go={go} />;
      case 'settings-units':          return <ScreenSettingsUnits go={go} />;
      case 'settings-users':          return <ScreenSettingsUsers go={go} />;
      case 'settings-approval-roles': return <ScreenSettingsApprovalRoles go={go} />;
      case 'settings-account':        return <ScreenSettingsAccount />;
      case 'settings-team':           return <ScreenSettingsTeam />;
      case 'settings-workspace':      return <ScreenSettingsWorkspace go={go} />;
      default:                        return <ScreenDashboard go={go} />;
    }
  };

  const navActive = ACTIVE_NAV[screen] || 'dashboard';

  // Stable identity so the memoized Sidebar/Topbar (and their UserMenu)
  // don't re-render on every screen change
  const handleNav = useCallback((id) => {
    const map = {
      'dashboard':      'dashboard',
      'rfq':            'rfq',
      'pricedb':        'pricedb',
      'compare':        'compare',
      'po':             'po',
      'contract':       'contract-detail',
      'supplierdb':     'supplierdb',
      'projects':       'settings-projects',
      'project-types':  'settings-project-types',
      'suppliers':      'settings-suppliers',
      'materials':      'settings-materials',
      'material-main-categories': 'settings-material-main-categories',
      'material-sub-categories':  'settings-material-sub-categories',
      'subcontracts':   'settings-subcontracts',
      'contract-types': 'settings-contract-types',
      'units':          'settings-units',
      'users':          'settings-users',
      'approval-roles': 'settings-approval-roles',
      'account':        'settings-account',
      'team':           'settings-team',
      'workspace':      'settings-workspace',
    };
    if (map[id]) go(map[id]);
  }, [go]);

  return (
    <div className="app" data-screen-label={screen}>
      <Sidebar current={navActive} onNav={handleNav} />
      <div className="main">
        <Topbar crumbs={CRUMBS[screen] || ['ภาพรวม']} onNav={handleNav} />
        {renderScreen()}
      </div>
    </div>
  );
}
