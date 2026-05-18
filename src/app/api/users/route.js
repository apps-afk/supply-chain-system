import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import {
  listUsers, updateUserRole, deleteUser, adminCreateUser, adminResetPassword,
} from '../../../lib/users';

const DOMAIN = 'initialestate.com';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { err: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 }) };
  }
  if (session.user.role !== 'admin') {
    return { err: NextResponse.json({ error: 'ต้องเป็นผู้ดูแลระบบเท่านั้น' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const { err } = await requireAdmin();
  if (err) return err;
  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(request) {
  const { err } = await requireAdmin();
  if (err) return err;
  try {
    const { name, email, password, role } = await request.json();
    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }
    if (!email.toLowerCase().endsWith(`@${DOMAIN}`)) {
      return NextResponse.json({ error: `อนุญาตเฉพาะบัญชี @${DOMAIN} เท่านั้น` }, { status: 403 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
    }
    const user = await adminCreateUser(name.trim(), email.toLowerCase(), password, role || 'user');
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'เกิดข้อผิดพลาด' }, { status: 400 });
  }
}

export async function PATCH(request) {
  const { err } = await requireAdmin();
  if (err) return err;
  try {
    const body = await request.json();
    const { email, role, password } = body;
    if (!email) {
      return NextResponse.json({ error: 'กรุณาระบุ email' }, { status: 400 });
    }
    if (role) await updateUserRole(email, role);
    if (password) {
      if (password.length < 8) {
        return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
      }
      await adminResetPassword(email, password);
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
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'เกิดข้อผิดพลาด' }, { status: 400 });
  }
}
