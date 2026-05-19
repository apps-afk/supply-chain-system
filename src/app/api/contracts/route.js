import { createCrudRoutes } from '../../../lib/crud';

const h = createCrudRoutes('contracts', {
  fields: ['no', 'project_id', 'supplier_id', 'type_id', 'title',
           'amount', 'currency', 'status', 'start_date', 'end_date',
           'signed_at', 'notes'],
  orderBy: 'created_at',
  orderDir: 'desc',
  idPrefix: 'ct',
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
