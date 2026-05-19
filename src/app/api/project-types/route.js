import { createCrudRoutes } from '../../../lib/crud';

const h = createCrudRoutes('project_types', {
  fields: ['code', 'name', 'description', 'active'],
  orderBy: 'code',
  idPrefix: 'ptype',
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
