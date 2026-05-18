'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Sidebar, Topbar } from './lib/shell';

import { ScreenDashboard } from './screens/screen-dashboard';
import { ScreenRFQ, ScreenRFQConfirm } from './screens/screen-rfq';
import { ScreenRFQCreate } from './screens/screen-rfq-create';
import { ScreenCompareList } from './screens/screen-compare-list';
import { ScreenCompare } from './screens/screen-compare';
import { ScreenCompareCreatePriceDB } from './screens/screen-compare-create-pricedb';
import { ScreenCompareCreateRFQ } from './screens/screen-compare-create-rfq';
import { ScreenCompareUploadRef } from './screens/screen-compare-upload-ref';
import { ScreenPriceDB, ScreenPriceDBDetail } from './screens/screen-pricedb';
import { ScreenContractList, ScreenContract } from './screens/screen-contract';
import { ScreenSupplierDB, ScreenSupplierDBDetail } from './screens/screen-supplierdb';
import { ScreenSettingsProjects } from './screens/screen-settings-projects';
import { ScreenSettingsProjectTypes } from './screens/screen-settings-project-types';
import { ScreenSettingsSuppliers } from './screens/screen-settings-suppliers';
import { ScreenSettingsMaterials } from './screens/screen-settings-materials';
import { ScreenSettingsSubcontracts } from './screens/screen-settings-subcontracts';
import { ScreenSettingsContractTypes } from './screens/screen-settings-contract-types';
import { ScreenSettingsUnits } from './screens/screen-settings-units';
import { ScreenSettingsUsers } from './screens/screen-settings-users';
import { ScreenSettingsApprovalRoles } from './screens/screen-settings-approval-roles';
import { ScreenSettingsAccount } from './screens/screen-settings-account';

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
  'contract':               ['งานหลัก', 'สัญญา'],
  'contract-detail':        ['งานหลัก', 'สัญญา', 'CT-2024-018'],
  'supplierdb':             ['ข้อมูล', 'ฐานข้อมูลผู้ขาย'],
  'supplierdb-detail':      ['ข้อมูล', 'ฐานข้อมูลผู้ขาย', 'SUP-00002'],
  'settings-projects':       ['ตั้งค่า', 'ข้อมูลหลัก', 'โครงการ'],
  'settings-project-types':  ['ตั้งค่า', 'ข้อมูลหลัก', 'ประเภทโครงการ'],
  'settings-suppliers':      ['ตั้งค่า', 'ข้อมูลหลัก', 'ผู้ขาย/ผู้รับเหมา'],
  'settings-materials':      ['ตั้งค่า', 'ข้อมูลหลัก', 'วัสดุก่อสร้าง'],
  'settings-subcontracts':   ['ตั้งค่า', 'ข้อมูลหลัก', 'งานจ้างเหมา'],
  'settings-contract-types': ['ตั้งค่า', 'ข้อมูลหลัก', 'ประเภทสัญญา'],
  'settings-units':          ['ตั้งค่า', 'ข้อมูลหลัก', 'หน่วยนับ'],
  'settings-users':          ['ตั้งค่า', 'ข้อมูลหลัก', 'ผู้ใช้งาน'],
  'settings-approval-roles': ['ตั้งค่า', 'ข้อมูลหลัก', 'ตำแหน่งผู้อนุมัติ'],
  'settings-account':        ['ตั้งค่า', 'บัญชีของฉัน'],
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
  'contract':               'contract',
  'contract-detail':        'contract',
  'supplierdb':             'supplierdb',
  'supplierdb-detail':      'supplierdb',
  'settings-projects':       'projects',
  'settings-project-types':  'project-types',
  'settings-suppliers':      'suppliers',
  'settings-materials':      'materials',
  'settings-subcontracts':   'subcontracts',
  'settings-contract-types': 'contract-types',
  'settings-units':          'units',
  'settings-users':          'users',
  'settings-approval-roles': 'approval-roles',
  'settings-account':        'account',
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

  const go = (id) => setScreen(id);

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
      case 'supplierdb':             return <ScreenSupplierDB go={go} />;
      case 'supplierdb-detail':      return <ScreenSupplierDBDetail go={go} />;
      case 'settings-projects':       return <ScreenSettingsProjects go={go} />;
      case 'settings-project-types':  return <ScreenSettingsProjectTypes go={go} />;
      case 'settings-suppliers':      return <ScreenSettingsSuppliers go={go} />;
      case 'settings-materials':      return <ScreenSettingsMaterials go={go} />;
      case 'settings-subcontracts':   return <ScreenSettingsSubcontracts go={go} />;
      case 'settings-contract-types': return <ScreenSettingsContractTypes go={go} />;
      case 'settings-units':          return <ScreenSettingsUnits go={go} />;
      case 'settings-users':          return <ScreenSettingsUsers go={go} />;
      case 'settings-approval-roles': return <ScreenSettingsApprovalRoles go={go} />;
      case 'settings-account':        return <ScreenSettingsAccount />;
      default:                        return <ScreenDashboard go={go} />;
    }
  };

  const navActive = ACTIVE_NAV[screen] || 'dashboard';

  const handleNav = (id) => {
    const map = {
      'dashboard':      'dashboard',
      'rfq':            'rfq',
      'pricedb':        'pricedb',
      'compare':        'compare',
      'contract':       'contract-detail',
      'supplierdb':     'supplierdb',
      'projects':       'settings-projects',
      'project-types':  'settings-project-types',
      'suppliers':      'settings-suppliers',
      'materials':      'settings-materials',
      'subcontracts':   'settings-subcontracts',
      'contract-types': 'settings-contract-types',
      'units':          'settings-units',
      'users':          'settings-users',
      'approval-roles': 'settings-approval-roles',
      'account':        'settings-account',
    };
    if (map[id]) go(map[id]);
  };

  return (
    <div className="app" data-screen-label={screen}>
      <Sidebar current={navActive} onNav={handleNav} />
      <div className="main">
        <Topbar crumbs={CRUMBS[screen] || ['ภาพรวม']} />
        {renderScreen()}
      </div>
    </div>
  );
}
