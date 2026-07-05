/**
 * Generic CRUD route factory for master-data tables backed by Supabase.
 *
 * Usage in app/api/<entity>/route.js:
 *   import { createCrudRoutes } from '../../../lib/crud';
 *   const h = createCrudRoutes('units', { fields: ['code','name','type','notes','active'] });
 *   export const GET    = h.list;
 *   export const POST   = h.create;
 *   export const PATCH  = h.update;
 *   export const DELETE = h.remove;
 *
 * Behaviour:
 *   - GET:    any logged-in user (master data is needed for dropdowns)
 *   - POST/PATCH/DELETE: admin only
 *   - If Supabase not configured: GET returns [], mutations return 503 with a
 *     clear "configure Supabase first" message
 */
import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from './supabase';
import { appendAudit } from './workspace';
import { WRITER_ROLES } from './permissions';
import { requireAuth } from './api-auth';

// All three guards ride on the central requireAuth (lib/api-auth.js) so the
// canonical 401/403 messages are uniform across the whole API surface:
//   - no/dead session          → 401 UNAUTHORIZED_MESSAGE (always wins)
//   - role outside allowedRoles → 403 FORBIDDEN_MESSAGE
async function requireSession() {
  const gate = await requireAuth();
  return gate.ok ? { session: gate.session } : { err: gate.response };
}

async function requireAdmin() {
  const gate = await requireAuth(['admin']);
  return gate.ok ? { session: gate.session } : { err: gate.response };
}

// Roles that may write documents: admin/procurement/manager.
async function requireWriter() {
  const gate = await requireAuth(WRITER_ROLES);
  return gate.ok ? { session: gate.session } : { err: gate.response };
}

// Exported for custom routes (upload, approvals, …) that don't use the factory.
export { requireSession, requireAdmin, requireWriter };

function notConfigured() {
  return NextResponse.json(
    { error: 'ระบบยังไม่ได้เชื่อม Supabase — ดูคู่มือใน supabase/SETUP.md' },
    { status: 503 }
  );
}

function pickFields(body, allowed) {
  const out = {};
  for (const f of allowed) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  return out;
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Compact, safe copy of a payload for the audit trail: scalar fields only
// (skip *_json blobs so the log stays readable) so money-field changes like
// amount / paid_amount / payment_status / status are captured verbatim.
function auditableChanges(payload) {
  const out = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k.endsWith('_json')) { out[k] = '[changed]'; continue; }
    if (v == null || typeof v !== 'object') out[k] = v;
  }
  return out;
}

export function createCrudRoutes(table, opts = {}) {
  const allowedFields = opts.fields || [];
  const orderBy       = opts.orderBy || 'created_at';
  const orderDir      = opts.orderDir || 'asc';
  const idPrefix      = opts.idPrefix || table;
  // Server-authoritative fields: never trust the client for who created a
  // record. If created_by is whitelisted it's always stamped from the
  // session so authorship can't be forged (audit fraud finding).
  const stampCreatedBy = allowedFields.includes('created_by');
  // Optional per-route mutation guard: (session, body, currentRow|null,
  // kind) → NextResponse to reject, or null/undefined to allow. Lets a route
  // enforce immutability / financial rules without re-implementing CRUD.
  const guardMutation = typeof opts.guardMutation === 'function' ? opts.guardMutation : null;
  // Default: writes are admin-only (safe default for master data). Pass
  // `writeRole: 'session'` for document tables (rfqs/comparisons/…) — since
  // P2 that means "any WRITER role" (admin/procurement/manager); read-only
  // roles get 403 from requireWriter.
  const writeGuard    = opts.writeRole === 'session' ? requireWriter : requireAdmin;

  async function list(req) {
    const { err } = await requireSession();
    if (err) return err;
    if (!isSupabaseConfigured) return NextResponse.json({ items: [] });

    // Optional server-side pagination: ?limit=&offset=. Without params the
    // full list returns exactly as before (screens that compute stats over
    // the whole table keep working); with limit the response adds `total`
    // so callers can render pagers as data grows.
    let limit = 0, offset = 0;
    try {
      const sp = new URL(req.url).searchParams;
      limit  = Math.min(Math.max(parseInt(sp.get('limit')  || '0', 10) || 0, 0), 1000);
      offset = Math.max(parseInt(sp.get('offset') || '0', 10) || 0, 0);
    } catch { /* no URL (older callers) → full list */ }

    let query = supabase
      .from(table)
      .select('*', limit ? { count: 'exact' } : undefined)
      .order(orderBy, { ascending: orderDir === 'asc' });
    if (limit) query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) { console.error(`[crud:${table}] list error:`, error.message); return NextResponse.json({ error: 'โหลดข้อมูลไม่สำเร็จ' }, { status: 500 }); }
    return NextResponse.json(
      limit ? { items: data || [], total: count ?? 0, limit, offset }
            : { items: data || [] }
    );
  }

  // Unique-violation (two people saving the same running number at once)
  // deserves a human answer, not a raw constraint name. The message keeps
  // the tokens "duplicate"/"ซ้ำ" so existing retry regexes keep matching.
  function friendlyDbError(error) {
    if (/duplicate key|unique constraint/i.test(error.message || '')) {
      return NextResponse.json(
        { error: 'เลขที่เอกสารซ้ำ (duplicate) — มีการบันทึกพร้อมกัน กรุณากดบันทึกอีกครั้ง ระบบจะออกเลขใหม่ให้',
          code: 'duplicate' },
        { status: 409 }
      );
    }
    // Don't leak raw DB errors (table/column/constraint names) to clients —
    // log the detail server-side, return a generic message.
    console.error(`[crud:${table}] db error:`, error.message);
    return NextResponse.json({ error: 'บันทึกข้อมูลไม่สำเร็จ' }, { status: 400 });
  }

  async function create(req) {
    const { err, session } = await writeGuard();
    if (err) return err;
    if (!isSupabaseConfigured) return notConfigured();

    let body;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

    const payload = pickFields(body, allowedFields);
    payload.id = body.id || newId(idPrefix);
    // Authorship is server-set, never client-supplied (anti-forgery).
    if (stampCreatedBy) payload.created_by = session.user.email;

    if (guardMutation) {
      const rej = await guardMutation(session, body, null, 'create');
      if (rej) return rej;
    }

    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) return friendlyDbError(error);
    await appendAudit({ actor: session.user.email, action: `${table}.create`, target: payload.id,
                        changes: auditableChanges(payload) });
    return NextResponse.json({ ok: true, item: data });
  }

  async function update(req) {
    const { err, session } = await writeGuard();
    if (err) return err;
    if (!isSupabaseConfigured) return notConfigured();

    let body;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
    if (!body.id) return NextResponse.json({ error: 'ต้องระบุ id' }, { status: 400 });

    const payload = pickFields(body, allowedFields);
    // created_by is immutable after creation — never let an update rewrite it.
    delete payload.created_by;

    // Per-route mutation guard (immutability / financial rules). It gets the
    // current row so it can compare against the requested change.
    if (guardMutation) {
      const { data: current } = await supabase
        .from(table).select('*').eq('id', body.id).maybeSingle();
      if (!current) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });
      const rej = await guardMutation(session, body, current, 'update');
      if (rej) return rej;
    }

    // Optimistic lock on state transitions: `_expect: { status: '<current>' }`
    // turns the update into compare-and-swap — if someone else already moved
    // the document, no row matches and the caller gets a 409 instead of
    // silently clobbering the other person's transition.
    let query = supabase.from(table).update(payload).eq('id', body.id);
    const expectStatus = body._expect && typeof body._expect.status === 'string'
      ? body._expect.status : null;
    if (expectStatus !== null) query = query.eq('status', expectStatus);

    // .single() returns an error when no rows match — use maybeSingle so we
    // can distinguish "DB error" from "row gone" and return a proper 404/409.
    const { data, error } = await query.select().maybeSingle();
    if (error) return friendlyDbError(error);
    if (!data) {
      if (expectStatus !== null) {
        // Row exists but the status moved under us → conflict, not not-found.
        const { data: still } = await supabase
          .from(table).select('id').eq('id', body.id).maybeSingle();
        if (still) {
          return NextResponse.json(
            { error: 'เอกสารถูกแก้ไขโดยผู้อื่นระหว่างที่คุณดูอยู่ — กรุณารีเฟรชหน้าแล้วลองใหม่', code: 'conflict' },
            { status: 409 }
          );
        }
      }
      return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });
    }
    await appendAudit({ actor: session.user.email, action: `${table}.update`, target: body.id,
                        changes: auditableChanges(payload) });
    return NextResponse.json({ ok: true, item: data });
  }

  async function remove(req) {
    const { err, session } = await writeGuard();
    if (err) return err;
    if (!isSupabaseConfigured) return notConfigured();

    let body;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
    if (!body.id) return NextResponse.json({ error: 'ต้องระบุ id' }, { status: 400 });

    // Return how many rows actually got deleted so concurrent double-delete
    // doesn't silently look "successful" — second caller now gets 404.
    const { data, error } = await supabase
      .from(table).delete().eq('id', body.id).select('id');
    if (error) { console.error(`[crud:${table}] delete error:`, error.message); return NextResponse.json({ error: 'ลบไม่สำเร็จ' }, { status: 400 }); }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการ (อาจถูกลบไปแล้ว)' }, { status: 404 });
    }
    await appendAudit({ actor: session.user.email, action: `${table}.delete`, target: body.id });
    return NextResponse.json({ ok: true });
  }

  return { list, create, update, remove };
}
