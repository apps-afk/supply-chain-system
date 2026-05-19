import { createCrudRoutes } from '../../../lib/crud';

const h = createCrudRoutes('projects', {
  fields: ['code', 'name', 'type_id', 'status', 'location', 'budget',
           'start_date', 'end_date', 'notes', 'active'],
  orderBy: 'code',
  idPrefix: 'proj',
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
