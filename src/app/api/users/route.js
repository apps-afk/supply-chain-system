import { NextResponse } from 'next/server';
import { FORBIDDEN_MESSAGE, requireAuth } from '../../../lib/api-auth';
import {
  listUsers, updateUserRole, deleteUser, adminCreateUser, adminResetPassword,
} from '../../../lib/users';
import { appendAudit } from '../../../lib/workspace';

const DOMAIN = 'initialestate.com';

async function requireAdmin() {
  const gate = await requireAuth(['admin']);
  return gate.ok ? { session: gate.session } : { err: gate.response };
}

export async function GET(request) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const session = gate.session;
  // `?scope=contacts` returns a minimal directory (name + email) that any
  // authenticated user may read — used by RFQ/contact pickers. Full user
  // management data stays admin-only.
  const url = new URL(request.url);
  const contactsOnly = url.searchParams.get('scope') === 'contacts';
  if (!contactsOnly && session.user.role !== 'admin') {
    return NextResponse.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
  }
  const users = await listUsers();
  if (contactsOnly) {
    return NextResponse.json({
      users: (users || []).map(u => ({ id: u.id, name: u.name, email: u.email })),
    });
  }
  return NextResponse.json({ users });
}

export async function POST(request) {
  const { err, session } = await requireAdmin();
  if (err) return err;
  try {
    const { name, email, password, role } = await request.json();
    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }, { status: 400 });
    }
    if (!email.toLowerCase().endsWith(`@${DOMAIN}`)) {
      return NextResponse.json({ error: `อนุญาตเฉพาะบัญชี @${DOMAIN} เท่านั้น` }, { status: 403 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
    }
    const user = await adminCreateUser(name.trim(), email.toLowerCase(), password, role || 'user');
    await appendAudit({ actor: session.user.email, action: 'users.create', target: `${email.toLowerCase()} (${role || 'user'})` });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'เกิดข้อผิดพลาด' }, { status: 400 });
  }
}

export async function PATCH(request) {
  const { err, session } = await requireAdmin();
  if (err) return err;
  try {
    const body = await request.json();
    const { email, role, password } = body;
    if (!email) {
      return NextResponse.json({ error: 'กรุณาระบุ email' }, { status: 400 });
    }
    if (role) {
      await updateUserRole(email, role);
      await appendAudit({ actor: session.user.email, action: 'users.role_change', target: `${email} → ${role}` });
    }
    if (password) {
      if (password.length < 8) {
        return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
      }
      await adminResetPassword(email, password);
      await appendAudit({ actor: session.user.email, action: 'users.password_reset', target: email });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'เกิดข้อผิดพลาด' }, { status: 400 });
  }
}

export async function DELETE(request) {
  const { err, session } = await requireAdmin();
  if (err) return err;
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'กรุณาระบุ email' }, { status: 400 });
    }
    if (session.user.email.toLowerCase() === email.toLowerCase()) {
      return NextResponse.json({ error: 'ไม่สามารถลบบัญชีตัวเองได้' }, { status: 400 });
    }
    await deleteUser(email);
    await appendAudit({ actor: session.user.email, action: 'users.delete', target: email });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'เกิดข้อผิดพลาด' }, { status: 400 });
  }
}
