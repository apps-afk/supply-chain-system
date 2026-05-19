import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { uploadToCategory, CATEGORIES, isGDriveConfigured } from '../../../lib/gdrive';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { appendAudit } from '../../../lib/workspace';

const MAX_MB = 25;
const ALLOWED_MIME = ['application/pdf'];

export const runtime = 'nodejs';  // googleapis isn't Edge-safe

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }
  if (!isGDriveConfigured) {
    return NextResponse.json({
      error: 'ยังไม่ได้ตั้งค่า Google Drive — ติดต่อ admin'
    }, { status: 503 });
  }

  let form;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: 'อัปโหลดไม่สำเร็จ' }, { status: 400 }); }

  const file        = form.get('file');
  const categoryKey = form.get('category');
  const entityType  = form.get('entity_type') || '';
  const entityId    = form.get('entity_id')   || '';
  const entityRef   = form.get('entity_ref')  || '';

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'กรุณาเลือกไฟล์' }, { status: 400 });
  }
  if (!CATEGORIES[categoryKey]) {
    return NextResponse.json({ error: `หมวดหมู่ไม่ถูกต้อง — ที่ใช้ได้: ${Object.keys(CATEGORIES).join(', ')}` }, { status: 400 });
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `ไฟล์ใหญ่เกิน — สูงสุด ${MAX_MB}MB` }, { status: 413 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: `รับเฉพาะ PDF (ได้รับ: ${file.type || 'ไม่ระบุ'})` }, { status: 415 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await uploadToCategory({
      categoryKey,
      filename: file.name,
      mimeType: file.type,
      body: buf,
      entityRef,
    });

    // Persist attachment metadata so we can list later
    let attachmentRow = null;
    if (isSupabaseConfigured) {
      const row = {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        entity_type: entityType,
        entity_id:   entityId,
        category:    categoryKey,
        drive_file_id: result.id,
        drive_view_link: result.webViewLink || null,
        filename:    result.name,
        mime_type:   file.type,
        size:        Number(result.size) || file.size,
        uploaded_by: session.user.email,
      };
      const { data, error } = await supabase
        .from('file_attachments').insert(row).select().single();
      if (error) console.error('attachment insert failed:', error.message);
      else attachmentRow = data;
    }

    await appendAudit({
      actor: session.user.email,
      action: 'attachment.upload',
      target: result.id,
      changes: { category: categoryKey, entity: `${entityType}/${entityId}` },
    });

    return NextResponse.json({
      ok: true,
      file: {
        id: result.id,
        name: result.name,
        viewLink: result.webViewLink,
        size: result.size,
      },
      attachment: attachmentRow,
    });
  } catch (e) {
    console.error('upload failed:', e);
    return NextResponse.json(
      { error: e.message || 'อัปโหลดไม่สำเร็จ' },
      { status: 500 }
    );
  }
}
