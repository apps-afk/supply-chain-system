import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabase';
import { rateLimit, clientKey } from '../../../../lib/rate-limit';
import { adminResetPassword } from '../../../../lib/users';
import { appendAudit } from '../../../../lib/workspace';

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

// Consumes a one-time reset token minted by POST /api/auth/forgot and sets
// the new password directly (no old-password check — the token itself is
// the proof of ownership, same trust level as clicking a mailed link).
export async function POST(request) {
  try {
    if (!rateLimit(`reset-pw:${clientKey(request)}`, { limit: 10, windowMs: 15 * 60 * 1000 })) {
      return NextResponse.json({ error: 'ลองบ่อยเกินไป — กรุณารอสักครู่' }, { status: 429 });
    }
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'ระบบยังไม่ได้เชื่อม Supabase' }, { status: 503 });
    }

    const { email, token, password } = await request.json();
    if (!email || !token || !password) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }
    if (String(password).length < 8) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
    }

    const key = String(email).toLowerCase();
    const tokenHash = hashToken(String(token));

    // Look up an unused, unexpired row matching this email + token hash.
    const { data: row, error } = await supabase
      .from('forgot_password_queue')
      .select('id, expires_at, used_at')
      .eq('email', key)
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !row || !row.expires_at || new Date(row.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว — กรุณาขอลิงก์ใหม่' },
        { status: 400 }
      );
    }

    await adminResetPassword(key, password);

    // One-time use: mark this row (and any other still-pending rows for the
    // same email) as consumed so an older mailed link can't be replayed.
    await supabase
      .from('forgot_password_queue')
      .update({ used_at: new Date().toISOString(), resolved_at: new Date().toISOString(), resolved_by: 'self-service' })
      .eq('email', key)
      .is('used_at', null);

    await appendAudit({ actor: key, action: 'auth.reset_password_self_service', target: key });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'เกิดข้อผิดพลาด' }, { status: 400 });
  }
}
