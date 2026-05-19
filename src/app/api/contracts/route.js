import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { createCrudRoutes } from '../../../lib/crud';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { deleteFile } from '../../../lib/gdrive';
import { appendAudit } from '../../../lib/workspace';

export const runtime = 'nodejs';   // googleapis (used in cascade delete) needs node runtime

const h = createCrudRoutes('contracts', {
  fields: ['no', 'project_id', 'supplier_id', 'type_id', 'title',
           'amount', 'currency', 'status', 'start_date', 'end_date',
           'signed_at', 'notes'],
  orderBy: 'created_at',
  orderDir: 'desc',
  idPrefix: 'ct',
  // Contracts are uploaded by procurement users; only the DELETE handler
  // below remains admin-only because it cascades into Drive file deletes.
  writeRole: 'session',
});

export const GET   = h.list;
export const POST  = h.create;
export const PATCH = h.update;

// Custom DELETE — cascade-deletes attachments from Drive + DB before
// removing the contract row.
export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }
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
    // 1) Fetch all attachments for this contract
    const { data: atts } = await supabase
      .from('file_attachments')
      .select('id, drive_file_id, filename')
      .eq('entity_type', 'contract')
      .eq('entity_id', body.id);

    // 2) Best-effort delete from Drive (one by one — don't fail the whole
    //    operation if a single Drive call errors out)
    const driveErrors = [];
    for (const a of (atts || [])) {
      try {
        await deleteFile(a.drive_file_id);
      } catch (e) {
        driveErrors.push(`${a.filename}: ${e.message}`);
      }
    }

    // 3) Delete attachment rows in DB
    if (atts && atts.length > 0) {
      await supabase.from('file_attachments')
        .delete()
        .eq('entity_type', 'contract')
        .eq('entity_id', body.id);
    }

    // 4) Delete the contract row itself — .select('id') so we can detect
    //    "row didn't exist" and surface 404 instead of silently returning ok
    //    when two admins delete the same contract simultaneously.
    const { data: deleted, error } = await supabase
      .from('contracts').delete().eq('id', body.id).select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'ไม่พบสัญญา (อาจถูกลบไปแล้ว)' }, { status: 404 });
    }

    await appendAudit({
      actor: session.user.email,
      action: 'contracts.delete',
      target: body.id,
      changes: { cascade_attachments: atts?.length || 0, drive_errors: driveErrors.length },
    });

    return NextResponse.json({
      ok: true,
      deleted: {
        contract_id: body.id,
        attachments: atts?.length || 0,
        drive_errors: driveErrors,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'ลบไม่สำเร็จ' }, { status: 500 });
  }
}
