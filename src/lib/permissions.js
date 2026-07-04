// Central role → capability map — the single place that decides what each
// role may do. session.user.role (set in lib/auth.js) is the source field.
//
//   admin       — ทุกอย่าง รวม master data + จัดการผู้ใช้
//   procurement — สร้าง/แก้เอกสารจัดซื้อ (RFQ, เปรียบเทียบ, สัญญา, PO, ราคา)
//   manager     — เท่ากับจัดซื้อ + กดอนุมัติเอกสารได้
//   hr_manager / accountant / user — ดูอย่างเดียว (read-only)
//
// Server guards (lib/crud.js + custom routes) and client UI both import
// from here so the rules never drift apart.

export const WRITER_ROLES   = ['admin', 'procurement', 'manager'];
export const APPROVER_ROLES = ['admin', 'manager'];

export function canWrite(role)   { return WRITER_ROLES.includes(role); }
export function canApprove(role) { return APPROVER_ROLES.includes(role); }
export function isAdmin(role)    { return role === 'admin'; }

// Message shown to read-only roles when they hit a write endpoint.
export const READ_ONLY_MSG = 'สิทธิ์ของคุณเป็นแบบดูอย่างเดียว — ติดต่อผู้ดูแลระบบหากต้องการแก้ไขข้อมูล';
