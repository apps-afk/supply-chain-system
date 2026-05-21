import { createCrudRoutes } from '../../../lib/crud';

const h = createCrudRoutes('material_main_categories', {
  fields: ['name', 'notes', 'active'],
  orderBy: 'name',
  idPrefix: 'mmc',
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
