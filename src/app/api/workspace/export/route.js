import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/crud';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabase';
import { appendAudit, stripPrivateSettings } from '../../../../lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Full-workspace JSON export (admin) — the self-serve backup path.
// Attachments' binary content lives in Google Drive; this includes the
// file_attachments manifest (drive ids + links) so files stay reachable.
const TABLES = [
  'workspace_settings', 'units', 'project_types', 'projects',
  'suppliers', 'materials', 'material_main_categories', 'material_sub_categories',
  'subcontracts', 'subcontract_categories', 'contract_types', 'approval_roles',
  'rfqs', 'rfq_items', 'price_points', 'comparisons', 'contracts',
  'purchase_orders', 'file_attachments', 'dsar_requests',
];

export async function GET() {
  const { session, err } = await requireAdmin();
  if (err) return err;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'ระบบยังไม่ได้เชื่อม Supabase' }, { status: 503 });
  }

  const dump = { exported_at: new Date().toISOString(), by: session.user.email, tables: {} };
  // All table reads are independent — run them concurrently so the export
  // takes ~one query's time instead of the sum of 22 sequential round trips.
  const results = await Promise.all([
    ...TABLES.map(t => supabase.from(t).select('*').then(r => [t, r])),
    // users WITHOUT credentials — a backup must never carry password hashes.
    supabase.from('users')
      .select('id, email, name, phone, role, verified, created_at, last_login')
      .then(r => ['users', r]),
    // recent audit trail (bounded — the full log can be large)
    supabase.from('audit_log').select('*')
      .order('timestamp', { ascending: false }).limit(5000)
      .then(r => ['audit_log', r]),
  ]);
  for (const [t, { data, error }] of results) {
    // Backups must never carry 2FA secrets — strip the server-private keys
    // out of the settings blob (same rule as password hashes above).
    const rows = t === 'workspace_settings' && Array.isArray(data)
      ? data.map(r => ({ ...r, settings: stripPrivateSettings(r.settings) }))
      : data;
    dump.tables[t] = error ? { error: error.message } : rows;
  }

  await appendAudit({ actor: session.user.email, action: 'workspace.export', target: 'full-backup' });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(dump), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="supplychain-backup-${stamp}.json"`,
    },
  });
}
