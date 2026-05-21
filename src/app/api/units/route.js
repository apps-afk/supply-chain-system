import { createCrudRoutes } from '../../../lib/crud';

const h = createCrudRoutes('units', {
  fields: ['code', 'name', 'name_en', 'aliases', 'type', 'notes', 'active'],
  orderBy: 'code',
  idPrefix: 'unit',
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
