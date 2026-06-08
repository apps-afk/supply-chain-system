import { createCrudRoutes } from '../../../lib/crud';

const h = createCrudRoutes('subcontracts', {
  fields: ['code', 'name', 'category', 'unit_id', 'notes', 'active'],
  orderBy: 'category',
  idPrefix: 'sub',
  // Master data is maintained by procurement users, not only admins.
  writeRole: 'session',
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
