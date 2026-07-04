import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { createCrudRoutes } from '../../../lib/crud';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { deleteFile } from '../../../lib/gdrive';
import { appendAudit } from '../../../lib/workspace';

export const runtime = 'nodejs';   // googleapis (used in cascade delete) needs node runtime

const h = createCrudRoutes('comparisons', {
  fields: ['no', 'title', 'project_id', 'status', 'items_json',
           'suppliers_json', 'total_low', 'total_high', 'notes', 'created_by'],
  orderBy: 'created_at',
  orderDir: 'desc',
  idPrefix: 'cmp',
  // Comparison docs are operational data — non-admin users must be able to
  // create/edit them (otherwise the whole Compare module is read-only).
  writeRole: 'session',
});

export const GET    = h.list;
export const POST   = h.create;

// PATCH wrapper: "finalized" is an approval outcome, not an editable field.
// When an active approval chain exists, the ONLY paths to finalized are the
// /approve endpoint (chain complete) or an admin override — otherwise any
// writer could skip the whole chain (the old Upload-Ref side door).
export async function PATCH(request) {
  let body;
  try { body = await request.clone().json(); } catch { body = null; }
  if (body?.status === 'finalized') {
    const session = await getServerSession(authOptions);
    if (session?.user && session.user.role !== 'admin' && isSupabaseConfigured) {
      const { count } = await supabase
        .from('approval_roles').select('id', { count: 'exact', head: true }).eq('active', true);
      if ((count || 0) > 0) {
        return NextResponse.json(
          { error: 'ต้องอนุมัติผ่านลำดับผู้อนุมัติในหน้าใบเปรียบเทียบ (หรือให้ผู้ดูแลระบบยืนยัน)' },
          { status: 403 }
        );
      }
    }
  }
  return h.update(request);
}

// Custom DELETE — cascades into file_attachments + Drive. Previously the
// shared CRUD remove() would leave file_attachments rows orphaned (entity_id
// pointing at a comparison that no longer exists) plus a stray PDF in Drive.
export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }
  // Cascade delete is destructive (removes Drive files). Restrict to admin
  // like the contracts DELETE — non-admins can still cancel/draft a compare
  // doc via PATCH but cannot wipe attachments.
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'ต้องเป็นผู้ดูแลระบบเท่านั้น' }, { status: 403 });
  }

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: 'ต้องระบุ id' }, { status: 400 });

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase ยังไม่ได้ตั้งค่า' }, { status: 503 });
  }

  try {
    // 1) Fetch attachments — surface the error so we don't proceed blind and
    //    orphan Drive files on a transient DB hiccup.
    const { data: atts, error: attsErr } = await supabase
      .from('file_attachments')
      .select('id, drive_file_id, filename')
      .eq('entity_type', 'comparison')
      .eq('entity_id', body.id);
    if (attsErr) {
      console.error('comparisons.delete: attachments fetch failed', attsErr.message);
      return NextResponse.json({ error: 'ดึงรายการไฟล์ไม่สำเร็จ' }, { status: 500 });
    }

    const driveErrors = [];
    for (const a of (atts || [])) {
      try { await deleteFile(a.drive_file_id); }
      catch (e) { driveErrors.push(`${a.filename}: ${e.message}`); }
    }
    if (atts && atts.length > 0) {
      const { error: delErr } = await supabase.from('file_attachments').delete()
        .eq('entity_type', 'comparison').eq('entity_id', body.id);
      if (delErr) {
        // Drive files already gone — surface so the caller knows DB is out of
        // sync. Returning 200 here would leave dangling rows pointing at
        // deleted Drive files.
        console.error('comparisons.delete: attachment rows not removed', delErr.message);
        return NextResponse.json({
          error: 'ลบไฟล์จาก Drive แล้ว แต่ลบ metadata ในฐานข้อมูลไม่สำเร็จ',
        }, { status: 500 });
      }
    }

    // 2) Delete the comparison row — surface 404 if it's already gone so two
    //    concurrent deletes don't both report success.
    const { data, error } = await supabase
      .from('comparisons').delete().eq('id', body.id).select('id');
    if (error) {
      console.error('comparisons.delete: row delete failed', error.message);
      return NextResponse.json({ error: 'ลบไม่สำเร็จ' }, { status: 400 });
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการ (อาจถูกลบไปแล้ว)' }, { status: 404 });
    }

    await appendAudit({
      actor: session.user.email,
      action: 'comparisons.delete',
      target: body.id,
      changes: { cascade_attachments: atts?.length || 0, drive_errors: driveErrors.length },
    });
    return NextResponse.json({ ok: true, deleted: { id: body.id, attachments: atts?.length || 0, drive_errors: driveErrors } });
  } catch (e) {
    console.error('comparisons.delete failed:', e?.stack || e);
    return NextResponse.json({ error: 'ลบไม่สำเร็จ' }, { status: 500 });
  }
}
