import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/api-auth';
import { getAuditLog } from '../../../lib/workspace';

export async function GET(request) {
  const gate = await requireAuth(['admin']);
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const rawLimit = parseInt(url.searchParams.get('limit') || '200', 10);
  // Fall back to 200 if the caller passed garbage (?limit=abc → NaN).
  // Math.min/Math.max would propagate NaN and then Supabase .limit(NaN) throws.
  const limit = Number.isFinite(rawLimit) ? rawLimit : 200;
  const safeLimit = Math.min(Math.max(limit, 1), 1000);
  const entries = await getAuditLog(safeLimit);
  return NextResponse.json({ entries });
}
