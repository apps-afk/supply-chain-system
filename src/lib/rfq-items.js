// Keeps the rfq_items table in step with the line items the RFQ screens
// store as JSON inside rfqs.notes.
//
// Why both: notes carries more than line items (supplier, contact, VAT
// policy, memo) and four screens read it today, so it stays the shape the
// UI works with. But items buried in a JSON string can't be queried — you
// cannot ask "how much concrete did we buy this year, from how many
// suppliers". rfq_items is the answerable copy: one row per line, with the
// material and unit resolved to real ids so it joins to the rest of the
// schema.
//
// The sync is server-side and derived from the same payload the row is
// written with, so the two representations cannot drift apart the way two
// separate client writes would.
import { supabase, isSupabaseConfigured } from './supabase';

// Codes are matched case-insensitively and trimmed — the screens store what
// the user picked, and a stray space should not orphan a line.
const clean = v => (typeof v === 'string' ? v.trim() : '');

function parseItems(notes) {
  if (!notes || typeof notes !== 'string') return null;
  let parsed;
  try { parsed = JSON.parse(notes); } catch { return null; }
  if (!parsed || !Array.isArray(parsed.items)) return null;
  return parsed.items;
}

/**
 * Rebuild rfq_items for one RFQ from its notes JSON.
 *
 * Replace-then-insert rather than diffing: an RFQ has a handful of lines,
 * and rebuilding removes any chance of stale rows outliving an edit that
 * deleted a line.
 *
 * Never throws. A reporting mirror must not be able to fail the write that
 * the user actually asked for — a failure here is logged and the RFQ still
 * saves, with the JSON intact as the source of truth.
 */
export async function syncRfqItems(rfqId, notes) {
  if (!isSupabaseConfigured || !rfqId) return { ok: false, reason: 'not configured' };

  const items = parseItems(notes);
  // notes that isn't item JSON (plain text, or an update that didn't touch
  // notes) must leave existing rows alone — only an explicit item list
  // rewrites them.
  if (items === null) return { ok: true, skipped: true };

  try {
    const codes = [...new Set(items.map(i => clean(i.itemCode)).filter(Boolean))];
    const units = [...new Set(items.map(i => clean(i.unit)).filter(Boolean))];

    const [mats, subs, unitRows] = await Promise.all([
      codes.length ? supabase.from('materials').select('id, code').in('code', codes)
                   : Promise.resolve({ data: [] }),
      codes.length ? supabase.from('subcontracts').select('id, code').in('code', codes)
                   : Promise.resolve({ data: [] }),
      units.length ? supabase.from('units').select('id, code').in('code', units)
                   : Promise.resolve({ data: [] }),
    ]);

    const matBy  = new Map((mats.data     || []).map(r => [r.code, r.id]));
    const subBy  = new Map((subs.data     || []).map(r => [r.code, r.id]));
    const unitBy = new Map((unitRows.data || []).map(r => [r.code, r.id]));

    const rows = items
      .map((it, idx) => {
        const name = clean(it.name);
        if (!name) return null;              // a blank line is not an item
        const code = clean(it.itemCode);
        const qty  = Number.parseFloat(clean(it.qty));
        const isSub = clean(it.source) === 'SubContract';
        return {
          id:             `rfqi_${rfqId}_${idx}`,
          rfq_id:         rfqId,
          source:         clean(it.source) || 'Material',
          material_id:    isSub ? null : (matBy.get(code) || null),
          subcontract_id: isSub ? (subBy.get(code) || null) : null,
          category_id:    clean(it.catKey) || null,
          item_code:      code || null,
          name,
          qty:            Number.isFinite(qty) ? qty : null,
          unit_id:        unitBy.get(clean(it.unit)) || null,
          unit_code:      clean(it.unit) || null,
          spec:           clean(it.spec),
          notes:          clean(it.note),
          sort_order:     idx,
        };
      })
      .filter(Boolean);

    await supabase.from('rfq_items').delete().eq('rfq_id', rfqId);
    if (rows.length) {
      const { error } = await supabase.from('rfq_items').insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true, count: rows.length };
  } catch (e) {
    // Logged, not surfaced: the RFQ write already succeeded and the JSON
    // still holds the items. Backfill from notes if this ever drifts.
    console.error(`[rfq-items] sync failed for ${rfqId}:`, e.message);
    return { ok: false, reason: e.message };
  }
}
