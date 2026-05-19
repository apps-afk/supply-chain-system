import { createCrudRoutes } from '../../../lib/crud';

const h = createCrudRoutes('approval_roles', {
  fields: ['code', 'name', 'level', 'active'],
  orderBy: 'level',
  idPrefix: 'role',
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
