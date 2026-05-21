import { createCrudRoutes } from '../../../lib/crud';

const h = createCrudRoutes('material_sub_categories', {
  fields: ['main_id', 'name', 'notes', 'active'],
  orderBy: 'name',
  idPrefix: 'msc',
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
