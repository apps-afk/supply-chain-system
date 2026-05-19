import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { appendAudit } from '../../../lib/workspace';

async function requireAdmin() {
  const s = await getServerSession(authOptions);
  if (!s?.user) return { err: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 }) };
  if (s.user.role !== 'admin') return { err: NextResponse.json({ error: 'ต้องเป็นผู้ดูแลระบบ' }, { status: 403 }) };
  return { session: s };
}

// List pending forgot-password requests so admin can action them.
export async function GET() {
  const { err } = await requireAdmin();
  if (err) return err;

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('forgot_password_queue').select('*')
      .order('requested_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data || [] });
  }

  if (!globalThis.__ieForgotQueue) globalThis.__ieForgotQueue = [];
  return NextResponse.json({ items: globalThis.__ieForgotQueue });
}

// Mark a forgot-password request as resolved (admin reset the user manually
// via the Team page after seeing it here).
export async function PATCH(request) {
  const { err, session } = await requireAdmin();
  if (err) return err;
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ต้องระบุ id' }, { status: 400 });

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('forgot_password_queue')
        .update({ resolved_at: new Date().toISOString(), resolved_by: session.user.email })
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else {
      if (!globalThis.__ieForgotQueue) globalThis.__ieForgotQueue = [];
      const r = globalThis.__ieForgotQueue.find(x => String(x.id) === String(id));
      if (!r) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });
      r.resolved_at = new Date().toISOString();
      r.resolved_by = session.user.email;
    }
    await appendAudit({ actor: session.user.email, action: 'forgot.resolve', target: String(id) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'เกิดข้อผิดพลาด' }, { status: 400 });
  }
}
