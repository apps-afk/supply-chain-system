import { NextResponse } from 'next/server';
import { createCrudRoutes } from '../../../lib/crud';

// Financial-integrity guard (fraud audit): the "deal" fields of a PO are
// frozen once it leaves 'ordered', and payment_status is derived on the
// server from paid_amount vs amount — a client can't stamp "paid" for an
// arbitrary amount or exceed the order value.
const DEAL_FIELDS = ['amount', 'items_json', 'supplier_id', 'supplier_name',
                     'title', 'ordered_at', 'project_id', 'comparison_id'];

function guardMutation(session, body, current, kind) {
  if (kind !== 'update' || !current) return null;

  // Freeze deal fields once the PO has moved past 'ordered' (received/closed/
  // cancelled) — you can still record payments, but not rewrite the order.
  if (current.status !== 'ordered') {
    for (const f of DEAL_FIELDS) {
      if (body[f] !== undefined && String(body[f]) !== String(current[f] ?? '')) {
        return NextResponse.json(
          { error: 'แก้ไขรายละเอียดใบสั่งซื้อได้เฉพาะตอนสถานะ "สั่งแล้ว" เท่านั้น' },
          { status: 409 }
        );
      }
    }
  }

  // Payment sanity: paid_amount within [0, amount]; payment_status is derived,
  // never trusted from the client.
  if (body.paid_amount !== undefined || body.payment_status !== undefined) {
    const amount = Number(current.amount) || 0;
    let paid = body.paid_amount !== undefined ? Number(body.paid_amount) : (Number(current.paid_amount) || 0);
    if (!Number.isFinite(paid) || paid < 0) {
      return NextResponse.json({ error: 'ยอดจ่ายไม่ถูกต้อง' }, { status: 400 });
    }
    if (paid > amount + 0.01) {
      return NextResponse.json({ error: 'ยอดจ่ายเกินมูลค่าใบสั่งซื้อไม่ได้' }, { status: 400 });
    }
    body.paid_amount = paid;
    body.payment_status = paid <= 0 ? 'unpaid' : (paid + 0.01 >= amount ? 'paid' : 'partial');
  }
  return null;
}

const h = createCrudRoutes('purchase_orders', {
  fields: ['no', 'comparison_id', 'project_id', 'supplier_id', 'supplier_name',
           'title', 'status', 'items_json', 'amount', 'notes', 'created_by',
           'ordered_at', 'received_at', 'closed_at',
           // P3 Source-to-Pay: billing/payment. received_json is deliberately
           // NOT here — receipts append server-side via ./receive so two
           // concurrent staff can't clobber each other's events.
           'invoice_no', 'invoice_date',
           'paid_at', 'paid_amount', 'payment_ref', 'payment_status'],
  orderBy: 'created_at',
  orderDir: 'desc',
  idPrefix: 'po',
  // POs are created/updated by procurement users, not only admins.
  writeRole: 'session',
  guardMutation,
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
