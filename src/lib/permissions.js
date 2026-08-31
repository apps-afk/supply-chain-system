// Central role → capability map — the single place that decides what each
// role may do. session.user.role (set in lib/auth.js) is the source field.
//
//   admin       — ทุกอย่าง รวม master data + จัดการผู้ใช้ (ฝ่าย IT / ผู้ดูแลระบบ)
//   coo         — สิทธิ์เท่า admin ทุกประการ (ผู้บริหาร/กรรมการ) + อนุมัติได้
//   manager     — สร้าง/แก้เอกสารจัดซื้อ + กดอนุมัติได้ (ผู้จัดการฝ่าย)
//   procurement — สร้าง/แก้เอกสารจัดซื้อ แต่อนุมัติไม่ได้
//   user        — ดูอย่างเดียว (read-only)
//
// Server guards (lib/crud.js + custom routes) and client UI both import
// from here so the rules never drift apart.
//
// IMPORTANT: never compare a role to a string literal elsewhere in the app.
// Use ADMIN_ROLES / isAdmin() so adding a role (as `coo` was added) stays a
// one-file change instead of a hunt through two dozen call sites.

// Roles carrying full administrative rights: user management, workspace
// settings, audit log, DSAR queue, unmasked PII.
export const ADMIN_ROLES    = ['admin', 'coo'];

// Roles that may create/edit procurement documents.
export const WRITER_ROLES   = ['admin', 'coo', 'procurement', 'manager'];

// Roles that may sign an approval level.
export const APPROVER_ROLES = ['admin', 'coo', 'manager'];

export function canWrite(role)   { return WRITER_ROLES.includes(role); }
export function canApprove(role) { return APPROVER_ROLES.includes(role); }
export function isAdmin(role)    { return ADMIN_ROLES.includes(role); }

// 401/403 wire messages live in lib/auth-messages.js (API_implement spec) —
// read-only roles now receive the canonical FORBIDDEN_MESSAGE.
