import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { uploadToCategory, CATEGORIES, isGDriveConfigured } from '../../../lib/gdrive';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { appendAudit } from '../../../lib/workspace';

const MAX_MB = 25;
// Accept PDF, Word documents, and common image formats.
// Keep this list explicit so users can't sneak in executables or zips.
const ALLOWED_MIME = [
  'application/pdf',
  'application/msword',                                                       // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  // .docx
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
];
// Whitelisted entity_type values — keeps the file_attachments table tidy and
// prevents callers from inventing categories that break later joins.
const ALLOWED_ENTITY_TYPES = new Set(['rfq', 'contract', 'comparison', 'supplier', 'pricedb', '']);

export const runtime = 'nodejs';  // googleapis isn't Edge-safe
export const maxDuration = 60;    // PDFs can take a bit on slow links
// Tell Next not to attempt static analysis: googleapis pulls in ~3MB of code
// that the build's static-trace can hold onto. Force-dynamic keeps it lazy.
export const dynamic = 'force-dynamic';

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
  // Reject 0-byte uploads — these come from empty file inputs / drag of a
  // folder / corrupted browser state and produce useless empty PDFs in Drive.
  if (!file.size || file.size === 0) {
    return NextResponse.json({ error: 'ไฟล์ว่างเปล่า (0 ไบต์) — กรุณาเลือกไฟล์ใหม่' }, { status: 400 });
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `ไฟล์ใหญ่เกิน — สูงสุด ${MAX_MB}MB` }, { status: 413 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({
      error: `รองรับเฉพาะไฟล์ PDF / Word (.doc, .docx) / รูปภาพ (.jpg, .png, .webp, .heic, .gif) — ได้รับ: ${file.type || 'ไม่ระบุ'}`
    }, { status: 415 });
  }
  if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
    return NextResponse.json({ error: `entity_type ไม่ถูกต้อง: ${entityType}` }, { status: 400 });
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
      if (error) {
        // The file is already in Drive — we surface this so the caller knows
        // the upload "succeeded" in Drive but won't appear in any list view.
        // Previously this was logged only, leaving orphaned Drive files with
        // no way for the UI to know they exist.
        console.error('attachment insert failed:', error.message);
        return NextResponse.json({
          ok: false,
          error: 'อัปโหลด Drive สำเร็จ แต่บันทึก metadata ไม่สำเร็จ',
          detail: error.message,
          file: { id: result.id, name: result.name, viewLink: result.webViewLink },
        }, { status: 500 });
      }
      attachmentRow = data;
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
    // Surface the most helpful detail to the client + log full stack server-side
    console.error('upload failed:', e?.stack || e);
    const inner = e?.cause?.response?.data?.error?.message
              || e?.cause?.errors?.[0]?.message
              || null;
    return NextResponse.json(
      {
        error: e.message || 'อัปโหลดไม่สำเร็จ',
        detail: inner,
        // helpful hint if it's a body-size issue
        hint: file && file.size > 4.4 * 1024 * 1024
          ? 'ไฟล์อาจใหญ่เกินขีดจำกัดของ Vercel Hobby plan (4.5MB) — ลองไฟล์เล็กกว่านี้ หรืออัปเกรด plan'
          : undefined,
      },
      { status: 500 }
    );
  }
}
