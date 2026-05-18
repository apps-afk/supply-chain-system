/* global React, ReactDOM, Sidebar, Topbar */
/* global ScreenDashboard, ScreenPriceDB, ScreenPriceDBDetail */
/* global ScreenRFQ, ScreenRFQConfirm, ScreenRFQCreate */
/* global ScreenCompare, ScreenCompareList, ScreenCompareCreatePriceDB, ScreenCompareCreateRFQ, ScreenCompareUploadRef */
/* global ScreenContract, ScreenContractList, ScreenSupplierDB, ScreenSupplierDBDetail */
/* global ScreenSettingsUnits, ScreenSettingsProjects, ScreenSettingsProjectTypes */
/* global ScreenSettingsSuppliers, ScreenSettingsMaterials, ScreenSettingsSubcontracts */
/* global ScreenSettingsContractTypes, ScreenSettingsUsers, ScreenSettingsApprovalRoles */

const { useState, useEffect } = React;

const CRUMBS = {
  'dashboard':       ['ภาพรวม'],
  'rfq':             ['Operation', 'RFQ'],
  'rfq-confirm':     ['Operation', 'RFQ', 'RFQ-2025-019', 'ตรวจสอบก่อนบันทึก'],
  'rfq-create':      ['Operation', 'RFQ', 'สร้างใหม่'],
  'compare':                 ['Operation', 'เปรียบเทียบราคา'],
  'compare-detail':          ['Operation', 'เปรียบเทียบราคา', 'CMP-2025-038'],
  'compare-create-pricedb':  ['Operation', 'เปรียบเทียบราคา', 'สร้างจาก Price DB'],
  'compare-create-rfq':      ['Operation', 'เปรียบเทียบราคา', 'สร้างจาก RFQ'],
  'compare-upload-ref':      ['Operation', 'เปรียบเทียบราคา', 'Upload Ref'],
  'pricedb':         ['Operation', 'Price Database'],
  'pricedb-detail':  ['Operation', 'Price Database', 'เหล็กเส้น DB12'],
  'contract':        ['Operation', 'สัญญา'],
  'contract-detail': ['Operation', 'สัญญา', 'CT-2024-018'],
  'supplierdb':        ['Intelligence', 'Supplier Database'],
  'supplierdb-detail': ['Intelligence', 'Supplier Database', 'SUP-00002'],
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

// Which sidebar item is "active" for each screen
const ACTIVE_NAV = {
  'dashboard':       'dashboard',
  'rfq':             'rfq',
  'rfq-confirm':     'rfq',
  'rfq-create':      'rfq',
  'compare':                 'compare',
  'compare-detail':          'compare',
  'compare-create-pricedb':  'compare',
  'compare-create-rfq':      'compare',
  'compare-upload-ref':      'compare',
  'pricedb':         'pricedb',
  'pricedb-detail':  'pricedb',
  'contract':        'contract',
  'contract-detail': 'contract',
  'supplierdb':        'supplierdb',
  'supplierdb-detail': 'supplierdb',
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

function App() {
  const [screen, setScreen] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return CRUMBS[hash] ? hash : 'dashboard';
  });

  useEffect(() => {
    window.location.hash = screen;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [screen]);

  // Treat unimplemented routes as "not yet"
  const go = (id) => setScreen(id);

  const renderScreen = () => {
    switch (screen) {
      case 'dashboard':       return <ScreenDashboard go={go} />;
      case 'rfq':             return <ScreenRFQ go={go} />;
      case 'rfq-confirm':     return <ScreenRFQConfirm go={go} />;
      case 'rfq-create':      return <ScreenRFQCreate go={go} />;
      case 'compare':                 return <ScreenCompareList go={go} />;
      case 'compare-detail':          return <ScreenCompare go={go} />;
      case 'compare-create-pricedb':  return <ScreenCompareCreatePriceDB go={go} />;
      case 'compare-create-rfq':      return <ScreenCompareCreateRFQ go={go} />;
      case 'compare-upload-ref':      return <ScreenCompareUploadRef go={go} />;
      case 'pricedb':         return <ScreenPriceDB go={go} />;
      case 'pricedb-detail':  return <ScreenPriceDBDetail go={go} />;
      case 'contract':        return <ScreenContractList go={go} />;
      case 'contract-detail': return <ScreenContract go={go} />;
      case 'supplierdb':        return <ScreenSupplierDB go={go} />;
      case 'supplierdb-detail': return <ScreenSupplierDBDetail go={go} />;
      case 'settings-projects':       return <ScreenSettingsProjects go={go} />;
      case 'settings-project-types':  return <ScreenSettingsProjectTypes go={go} />;
      case 'settings-suppliers':      return <ScreenSettingsSuppliers go={go} />;
      case 'settings-materials':      return <ScreenSettingsMaterials go={go} />;
      case 'settings-subcontracts':   return <ScreenSettingsSubcontracts go={go} />;
      case 'settings-contract-types': return <ScreenSettingsContractTypes go={go} />;
      case 'settings-units':          return <ScreenSettingsUnits go={go} />;
      case 'settings-users':          return <ScreenSettingsUsers go={go} />;
      case 'settings-approval-roles': return <ScreenSettingsApprovalRoles go={go} />;
      default:                return <ScreenDashboard go={go} />;
    }
  };

  const navActive = ACTIVE_NAV[screen] || 'dashboard';

  // Map sidebar clicks back to a list-screen
  const handleNav = (id) => {
    const map = {
      'dashboard':       'dashboard',
      'rfq':             'rfq',
      'pricedb':         'pricedb',
      'compare':         'compare',
      'contract':        'contract-detail',
      'supplierdb':      'supplierdb',
      'projects':        'settings-projects',
      'project-types':   'settings-project-types',
      'suppliers':       'settings-suppliers',
      'materials':       'settings-materials',
      'subcontracts':    'settings-subcontracts',
      'contract-types':  'settings-contract-types',
      'units':           'settings-units',
      'users':           'settings-users',
      'approval-roles':  'settings-approval-roles',
    };
    if (map[id]) go(map[id]);
    // other settings nav items are placeholders — no-op
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

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
