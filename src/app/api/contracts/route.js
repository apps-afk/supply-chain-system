import { NextResponse } from 'next/server';
import { UNAUTHORIZED_MESSAGE, FORBIDDEN_MESSAGE } from '../../../lib/auth-messages';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { createCrudRoutes } from '../../../lib/crud';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { deleteFile } from '../../../lib/gdrive';
import { appendAudit } from '../../../lib/workspace';

export const runtime = 'nodejs';   // googleapis (used in cascade delete) needs node runtime

// Integrity guard (fraud audit): retention_released_by always follows the
// session (can't be pinned on someone else), and the money terms of a
// contract are frozen once it's no longer a draft.
const TERM_FIELDS = ['amount', 'warranty', 'start_date', 'end_date', 'type_id',
                     'supplier_id', 'currency'];

function guardMutation(session, body, current, kind) {
  if (body.retention_released_at !== undefined || body.retention_released_by !== undefined) {
    body.retention_released_by = session.user.email;
  }
  if (kind === 'update' && current && current.status !== 'draft') {
    for (const f of TERM_FIELDS) {
      if (body[f] !== undefined && String(body[f]) !== String(current[f] ?? '')) {
        return NextResponse.json(
          { error: 'แก้ไขมูลค่า/เงื่อนไขสัญญาได้เฉพาะตอนสถานะ "ร่าง" เท่านั้น' },
          { status: 409 }
        );
      }
    }
  }
  return null;
}

const h = createCrudRoutes('contracts', {
  fields: ['no', 'project_id', 'supplier_id', 'type_id', 'title',
           'amount', 'currency', 'status', 'start_date', 'end_date',
           'signed_at', 'warranty', 'notes',
           'retention_released_at', 'retention_released_by', 'created_by'],
  orderBy: 'created_at',
  orderDir: 'desc',
  idPrefix: 'ct',
  // Contracts are uploaded by procurement users; only the DELETE handler
  // below remains admin-only because it cascades into Drive file deletes.
  writeRole: 'session',
  guardMutation,
});

export const GET   = h.list;
export const POST  = h.create;
export const PATCH = h.update;

// Custom DELETE — cascade-deletes attachments from Drive + DB before
// removing the contract row.
export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 });
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
  }

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: 'ต้องระบุ id' }, { status: 400 });

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase ยังไม่ได้ตั้งค่า' }, { status: 503 });
  }

  try {
    // 1) Fetch all attachments for this contract. Surface fetch errors so we
    //    don't proceed blind and orphan Drive files on a DB hiccup.
    const { data: atts, error: attsErr } = await supabase
      .from('file_attachments')
      .select('id, drive_file_id, filename')
      .eq('entity_type', 'contract')
      .eq('entity_id', body.id);
    if (attsErr) {
      console.error('contracts.delete: attachments fetch failed', attsErr.message);
      return NextResponse.json({ error: 'ดึงรายการไฟล์ไม่สำเร็จ' }, { status: 500 });
    }

    // 2) Best-effort delete from Drive, in parallel — semantics identical to
    //    the old serial loop (per-file error capture) but one round trip.
    const delResults = await Promise.allSettled(
      (atts || []).map(a => deleteFile(a.drive_file_id))
    );
    const driveErrors = delResults
      .map((r, i) => r.status === 'rejected'
        ? `${(atts || [])[i].filename}: ${r.reason?.message || r.reason}` : null)
      .filter(Boolean);

    // 3) Delete attachment rows in DB. If this fails after Drive succeeded,
    //    surface — returning 200 would leave ghost rows pointing at deleted
    //    Drive files.
    if (atts && atts.length > 0) {
      const { error: delErr } = await supabase.from('file_attachments')
        .delete()
        .eq('entity_type', 'contract')
        .eq('entity_id', body.id);
      if (delErr) {
        console.error('contracts.delete: attachment rows not removed', delErr.message);
        return NextResponse.json({
          error: 'ลบไฟล์จาก Drive แล้ว แต่ลบ metadata ในฐานข้อมูลไม่สำเร็จ',
        }, { status: 500 });
      }
    }

    // 4) Delete the contract row itself — .select('id') so we can detect
    //    "row didn't exist" and surface 404 instead of silently returning ok
    //    when two admins delete the same contract simultaneously.
    const { data: deleted, error } = await supabase
      .from('contracts').delete().eq('id', body.id).select('id');
    if (error) {
      console.error('contracts.delete: row delete failed', error.message);
      return NextResponse.json({ error: 'ลบไม่สำเร็จ' }, { status: 400 });
    }
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
    console.error('contracts.delete failed:', e?.stack || e);
    return NextResponse.json({ error: 'ลบไม่สำเร็จ' }, { status: 500 });
  }
}
