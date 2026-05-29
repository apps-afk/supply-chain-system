import { createCrudRoutes } from '../../../lib/crud';

const h = createCrudRoutes('subcontract_categories', {
  fields: ['name', 'notes', 'active'],
  orderBy: 'name',
  idPrefix: 'subcat',
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
