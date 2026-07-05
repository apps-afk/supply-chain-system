import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';
import { getSettings } from '../../../../lib/workspace';
import { AI_MODELS, hasApiKey, resolveModel } from '../../../../lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Status for the UI: whether AI is usable right now (key present) and which
// model the admin picked. The model itself is CHANGED via PATCH /api/workspace
// (admin-only) — this endpoint is read-only and available to any logged-in
// user so screens can show/hide the "ให้ AI ช่วย…" buttons.
export async function GET() {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;

  let model = 'claude-opus-4-8';
  try {
    const s = await getSettings();
    model = resolveModel(s?.ai?.defaultModel);
  } catch { /* fall back to default */ }

  return NextResponse.json({
    hasKey: hasApiKey(),
    enabled: hasApiKey(),
    model,
    models: AI_MODELS,
  });
}
