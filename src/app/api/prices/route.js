import { createCrudRoutes } from '../../../lib/crud';

const h = createCrudRoutes('price_points', {
  fields: ['material_id', 'supplier_id', 'price', 'unit_id', 'source', 'source_id'],
  orderBy: 'captured_at',
  orderDir: 'desc',
  idPrefix: 'price',
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
