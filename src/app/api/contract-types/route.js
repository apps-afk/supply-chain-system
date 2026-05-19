import { createCrudRoutes } from '../../../lib/crud';

const h = createCrudRoutes('contract_types', {
  fields: ['code', 'name', 'description', 'deposit_pct', 'retention_pct', 'active'],
  orderBy: 'code',
  idPrefix: 'ctype',
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
