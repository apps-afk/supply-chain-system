import { createCrudRoutes } from '../../../lib/crud';

const h = createCrudRoutes('rfqs', {
  fields: ['no', 'project_id', 'title', 'status', 'due_date', 'notes', 'created_by'],
  orderBy: 'created_at',
  orderDir: 'desc',
  idPrefix: 'rfq',
  // RFQs are operational data — any authenticated user (procurement, etc.)
  // must be able to create / update / delete their own RFQs.
  writeRole: 'session',
});

export const GET    = h.list;
export const POST   = h.create;
export const PATCH  = h.update;
export const DELETE = h.remove;
