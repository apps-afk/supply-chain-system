import { NextResponse } from 'next/server';
import { requireWriter } from '../../../../lib/crud';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabase';
import { appendAudit } from '../../../../lib/workspace';

export const runtime = 'nodejs';

// Goods-receipt append (P3 hardening). The receipt event list must be
// composed SERVER-side from the current row — the old client-side
// read-append-PATCH lost events when two staff recorded receipts on the
// same PO concurrently. received_json is no longer in the generic PATCH
// whitelist; this endpoint is its only writer.
//
// POST { id, lines: [{code, qty}], note? }

export async function POST(request) {
  const { session, err } = await requireWriter();
  if (err) return err;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'ระบบยังไม่ได้เชื่อม Supabase' }, { status: 503 });
  }

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const { id, lines, note } = body || {};
  const clean = (Array.isArray(lines) ? lines : [])
    .map(l => ({ code: String(l.code || ''), qty: Number(l.qty) || 0 }))
    .filter(l => l.code && l.qty > 0);
  if (!id || clean.length === 0) {
    return NextResponse.json({ error: 'ต้องระบุ id และจำนวนรับอย่างน้อย 1 รายการ' }, { status: 400 });
  }

  const { data: po, error: poErr } = await supabase
    .from('purchase_orders').select('*').eq('id', id).maybeSingle();
  if (poErr) return NextResponse.json({ error: poErr.message }, { status: 400 });
  if (!po) return NextResponse.json({ error: 'ไม่พบใบสั่งซื้อ' }, { status: 404 });
  if (po.status !== 'ordered') {
    return NextResponse.json({ error: 'บันทึกรับของได้เฉพาะ PO สถานะ "สั่งแล้ว"' }, { status: 409 });
  }

  const items = Array.isArray(po.items_json) ? po.items_json : [];
  const receipts = Array.isArray(po.received_json) ? po.received_json : [];

  // Clamp each line to what is still outstanding so totals can never
  // exceed the ordered qty, even with a stale client.
  const got = {};
  for (const ev of receipts) for (const l of (ev.lines || [])) {
    got[l.code] = (got[l.code] || 0) + (Number(l.qty) || 0);
  }
  const orderedByCode = Object.fromEntries(items.map(it => [it.code, Number(it.qty) || 0]));
  const accepted = [];
  for (const l of clean) {
    const left = Math.max(0, (orderedByCode[l.code] ?? 0) - (got[l.code] || 0));
    const qty = Math.min(l.qty, left);
    if (qty > 0) { accepted.push({ code: l.code, qty }); got[l.code] = (got[l.code] || 0) + qty; }
  }
  if (accepted.length === 0) {
    return NextResponse.json({ error: 'ทุกรายการรับครบแล้ว — ไม่มีจำนวนค้างรับ' }, { status: 409 });
  }

  const event = {
    at: new Date().toISOString(),
    by: session.user.email,
    note: String(note || ''),
    lines: accepted,
  };
  const complete = items.every(it => (got[it.code] || 0) >= (Number(it.qty) || 0));
  const patch = { received_json: [...receipts, event] };
  if (complete) {
    patch.status = 'received';
    patch.received_at = new Date().toISOString().slice(0, 10);
  }

  const { data: updated, error: upErr } = await supabase
    .from('purchase_orders').update(patch).eq('id', id).select().single();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  await appendAudit({
    actor: session.user.email,
    action: 'purchase_orders.receive',
    target: `${id} (${accepted.map(l => `${l.code}×${l.qty}`).join(', ')})`,
  });
  return NextResponse.json({ ok: true, item: updated });
}
