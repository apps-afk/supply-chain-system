import { createCrudRoutes } from '../../../lib/crud';

const h = createCrudRoutes('materials', {
  fields: ['code', 'name', 'main_category', 'category', 'unit_id', 'spec', 'notes', 'active'],
  orderBy: 'category',
  idPrefix: 'mat',
  // Master data is maintained by procurement users, not only admins.
  writeRole: 'session',
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
