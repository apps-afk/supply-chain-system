import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { deleteFile } from '../../../lib/gdrive';
import { appendAudit } from '../../../lib/workspace';

export const runtime = 'nodejs';

// List attachments — supports filtering by entity_type, entity_id, category
export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  if (!isSupabaseConfigured) return NextResponse.json({ items: [] });

  const url = new URL(request.url);
  let q = supabase.from('file_attachments').select('*').order('uploaded_at', { ascending: false });
  const et = url.searchParams.get('entity_type');
  const ei = url.searchParams.get('entity_id');
  const ct = url.searchParams.get('category');
  if (et) q = q.eq('entity_type', et);
  if (ei) q = q.eq('entity_id', ei);
  if (ct) q = q.eq('category', ct);
  const rawLimit = parseInt(url.searchParams.get('limit') || '200', 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 1000) : 200;
  q = q.limit(limit);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

// Delete one attachment by id — removes from Drive and DB
export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ต้องระบุ id' }, { status: 400 });

    if (isSupabaseConfigured) {
      // Fetch the row to get the Drive file ID
      const { data: row, error: e1 } = await supabase
        .from('file_attachments').select('*').eq('id', id).maybeSingle();
      if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
      if (!row) return NextResponse.json({ error: 'ไม่พบ attachment' }, { status: 404 });

      // Only the uploader or admin can delete
      if (row.uploaded_by !== session.user.email && session.user.role !== 'admin') {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์ลบไฟล์นี้' }, { status: 403 });
      }

      // Delete from Drive first; if fails, leave DB row so we don't orphan
      try { await deleteFile(row.drive_file_id); } catch (e) {
        return NextResponse.json({ error: `ลบจาก Drive ไม่สำเร็จ: ${e.message}` }, { status: 500 });
      }
      const { error: e2 } = await supabase.from('file_attachments').delete().eq('id', id);
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

      await appendAudit({ actor: session.user.email, action: 'attachment.delete', target: row.drive_file_id });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Supabase ยังไม่ได้ตั้งค่า' }, { status: 503 });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'ลบไม่สำเร็จ' }, { status: 500 });
  }
}
