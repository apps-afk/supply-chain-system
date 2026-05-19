import { createCrudRoutes } from '../../../lib/crud';

const h = createCrudRoutes('comparisons', {
  fields: ['no', 'title', 'project_id', 'status', 'items_json',
           'suppliers_json', 'total_low', 'total_high', 'notes', 'created_by'],
  orderBy: 'created_at',
  orderDir: 'desc',
  idPrefix: 'cmp',
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
