import { createCrudRoutes } from '../../../lib/crud';

const h = createCrudRoutes('purchase_orders', {
  fields: ['no', 'comparison_id', 'project_id', 'supplier_id', 'supplier_name',
           'title', 'status', 'items_json', 'amount', 'notes', 'created_by',
           'ordered_at', 'received_at', 'closed_at',
           // P3 Source-to-Pay: goods receipts + billing/payment
           'received_json', 'invoice_no', 'invoice_date',
           'paid_at', 'paid_amount', 'payment_ref', 'payment_status'],
  orderBy: 'created_at',
  orderDir: 'desc',
  idPrefix: 'po',
  // POs are created/updated by procurement users, not only admins.
  writeRole: 'session',
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
