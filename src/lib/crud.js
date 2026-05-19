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
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { supabase, isSupabaseConfigured } from './supabase';
import { appendAudit } from './workspace';

async function requireSession() {
  const s = await getServerSession(authOptions);
  if (!s?.user) {
    return { err: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 }) };
  }
  return { session: s };
}

async function requireAdmin() {
  const { session, err } = await requireSession();
  if (err) return { err };
  if (session.user.role !== 'admin') {
    return { err: NextResponse.json({ error: 'ต้องเป็นผู้ดูแลระบบเท่านั้น' }, { status: 403 }) };
  }
  return { session };
}

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

export function createCrudRoutes(table, opts = {}) {
  const allowedFields = opts.fields || [];
  const orderBy       = opts.orderBy || 'created_at';
  const orderDir      = opts.orderDir || 'asc';
  const idPrefix      = opts.idPrefix || table;
  // Default: writes are admin-only (safe default for master data). Pass
  // `writeRole: 'session'` for tables like rfqs/comparisons that any
  // authenticated user must be able to write.
  const writeGuard    = opts.writeRole === 'session' ? requireSession : requireAdmin;

  async function list() {
    const { err } = await requireSession();
    if (err) return err;
    if (!isSupabaseConfigured) return NextResponse.json({ items: [] });

    const { data, error } = await supabase
      .from(table).select('*').order(orderBy, { ascending: orderDir === 'asc' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data || [] });
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

    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await appendAudit({ actor: session.user.email, action: `${table}.create`, target: payload.id });
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
    // .single() returns an error when no rows match — use maybeSingle so we
    // can distinguish "DB error" from "row gone" and return a proper 404.
    const { data, error } = await supabase
      .from(table).update(payload).eq('id', body.id).select().maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });
    await appendAudit({ actor: session.user.email, action: `${table}.update`, target: body.id });
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
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการ (อาจถูกลบไปแล้ว)' }, { status: 404 });
    }
    await appendAudit({ actor: session.user.email, action: `${table}.delete`, target: body.id });
    return NextResponse.json({ ok: true });
  }

  return { list, create, update, remove };
}
