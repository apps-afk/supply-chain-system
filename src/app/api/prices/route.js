import { createCrudRoutes } from '../../../lib/crud';

const h = createCrudRoutes('price_points', {
  fields: ['material_id', 'supplier_id', 'price', 'unit_id', 'source', 'source_id'],
  orderBy: 'captured_at',
  orderDir: 'desc',
  idPrefix: 'price',
  // Price points are written by the RFQ-confirm flow — any procurement user
  // must be able to add price observations, not just admins.
  writeRole: 'session',
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
