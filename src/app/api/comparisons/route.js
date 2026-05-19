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
export const PATCH  = h.update;

// Custom DELETE — cascades into file_attachments + Drive. Previously the
// shared CRUD remove() would leave file_attachments rows orphaned (entity_id
// pointing at a comparison that no longer exists) plus a stray PDF in Drive.
export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: 'ต้องระบุ id' }, { status: 400 });

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase ยังไม่ได้ตั้งค่า' }, { status: 503 });
  }

  try {
    // 1) Best-effort: drop any uploaded Ref files associated with this compare doc
    const { data: atts } = await supabase
      .from('file_attachments')
      .select('id, drive_file_id, filename')
      .eq('entity_type', 'comparison')
      .eq('entity_id', body.id);

    const driveErrors = [];
    for (const a of (atts || [])) {
      try { await deleteFile(a.drive_file_id); }
      catch (e) { driveErrors.push(`${a.filename}: ${e.message}`); }
    }
    if (atts && atts.length > 0) {
      await supabase.from('file_attachments').delete()
        .eq('entity_type', 'comparison').eq('entity_id', body.id);
    }

    // 2) Delete the comparison row — surface 404 if it's already gone so two
    //    concurrent deletes don't both report success.
    const { data, error } = await supabase
      .from('comparisons').delete().eq('id', body.id).select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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
    return NextResponse.json({ error: e.message || 'ลบไม่สำเร็จ' }, { status: 500 });
  }
}
