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

const CRUMBS = {
  'dashboard':              ['ภาพรวม'],
  'rfq':                    ['Operation', 'RFQ'],
  'rfq-confirm':            ['Operation', 'RFQ', 'RFQ-2025-019', 'ตรวจสอบก่อนบันทึก'],
  'rfq-create':             ['Operation', 'RFQ', 'สร้างใหม่'],
  'compare':                ['Operation', 'เปรียบเทียบราคา'],
  'compare-detail':         ['Operation', 'เปรียบเทียบราคา', 'CMP-2025-038'],
  'compare-create-pricedb': ['Operation', 'เปรียบเทียบราคา', 'สร้างจาก Price DB'],
  'compare-create-rfq':     ['Operation', 'เปรียบเทียบราคา', 'สร้างจาก RFQ'],
  'compare-upload-ref':     ['Operation', 'เปรียบเทียบราคา', 'Upload Ref'],
  'pricedb':                ['Operation', 'Price Database'],
  'pricedb-detail':         ['Operation', 'Price Database', 'เหล็กเส้น DB12'],
  'contract':               ['Operation', 'สัญญา'],
  'contract-detail':        ['Operation', 'สัญญา', 'CT-2024-018'],
  'supplierdb':             ['Intelligence', 'Supplier Database'],
  'supplierdb-detail':      ['Intelligence', 'Supplier Database', 'SUP-00002'],
  'settings-projects':       ['Settings', 'Master Data', 'โครงการ'],
  'settings-project-types':  ['Settings', 'Master Data', 'ประเภทโครงการ'],
  'settings-suppliers':      ['Settings', 'Master Data', 'Supplier'],
  'settings-materials':      ['Settings', 'Master Data', 'วัสดุ'],
  'settings-subcontracts':   ['Settings', 'Master Data', 'งานจ้าง'],
  'settings-contract-types': ['Settings', 'Master Data', 'ประเภทสัญญา'],
  'settings-units':          ['Settings', 'Master Data', 'หน่วยนับ'],
  'settings-users':          ['Settings', 'Master Data', 'ผู้ใช้งาน'],
  'settings-approval-roles': ['Settings', 'Master Data', 'ตำแหน่งผู้อนุมัติ'],
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
