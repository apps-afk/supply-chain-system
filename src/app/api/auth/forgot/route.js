import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabase';

const DOMAIN = 'initialestate.com';

// Forgot password from login page (user is NOT authenticated).
// We enqueue the request and admin can action it from the workspace settings page.
export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'กรุณาระบุอีเมล' }, { status: 400 });
    }
    // Reject obviously-invalid emails BEFORE the domain check — prevents the
    // queue from filling with junk like "foo bar@initialestate.com" that the
    // domain suffix check alone would accept.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }, { status: 400 });
    }
    if (!email.toLowerCase().endsWith(`@${DOMAIN}`)) {
      return NextResponse.json(
        { error: `อนุญาตเฉพาะบัญชี @${DOMAIN} เท่านั้น` },
        { status: 403 }
      );
    }

    if (isSupabaseConfigured) {
      // Persist to DB so admin sees it across cold starts
      const { error } = await supabase
        .from('forgot_password_queue')
        .insert({ email: email.toLowerCase() });
      if (error) {
        console.error('forgot queue insert failed:', error.message);
        // Continue anyway — don't leak the error to the user
      }
    } else {
      if (!globalThis.__ieForgotQueue) globalThis.__ieForgotQueue = [];
      globalThis.__ieForgotQueue.push({
        id: Date.now(),
        email: email.toLowerCase(),
        requested_at: new Date().toISOString(),
        resolved_at: null,
      });
    }

    // Always return success to avoid leaking which emails exist (anti-enumeration)
    return NextResponse.json({
      ok: true,
      message: 'คำขอถูกบันทึก — ผู้ดูแลระบบจะติดต่อกลับเพื่อรีเซ็ตรหัสผ่านให้คุณ',
    });
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
