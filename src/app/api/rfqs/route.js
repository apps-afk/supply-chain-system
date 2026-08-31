import { createCrudRoutes } from '../../../lib/crud';
import { syncRfqItems } from '../../../lib/rfq-items';

export const runtime = 'nodejs';

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
export const DELETE = h.remove;   // rfq_items rows go with it (ON DELETE CASCADE)

// The line items live as JSON in `notes` for the UI, and as queryable rows in
// rfq_items for reporting. Both are written here, from the row the CRUD layer
// actually saved, so the mirror always reflects what was stored rather than
// what the client asked for. A failed sync never fails the save.
async function mirrorItems(res) {
  try {
    const clone = res.clone();
    const data = await clone.json();
    if (data?.ok && data.item?.id) {
      await syncRfqItems(data.item.id, data.item.notes);
    }
  } catch { /* response wasn't a saved row (validation error, 4xx) */ }
  return res;
}

export async function POST(request) {
  return mirrorItems(await h.create(request));
}

export async function PATCH(request) {
  return mirrorItems(await h.update(request));
}
