import { createCrudRoutes } from '../../../lib/crud';

const h = createCrudRoutes('suppliers', {
  fields: ['code', 'name', 'type', 'contact_name', 'email', 'phone',
           'address', 'tax_id', 'payment_terms', 'rating', 'notes', 'active', 'status'],
  orderBy: 'name',
  idPrefix: 'sup',
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
