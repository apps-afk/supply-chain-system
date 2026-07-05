import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';
import { getPolicy, publicPolicy } from '../../../../lib/policy';
import { clientKey } from '../../../../lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Non-secret policy subset for ANY logged-in user — drives client-side
// enforcement (CSV export caps/masking, print watermark, AI auto-run) and
// tells the admin UI the caller's current IP for the allowlist helper.
export async function GET(request) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const settings = await getPolicy();
  return NextResponse.json({
    ...publicPolicy(settings),
    yourIp: clientKey(request),
    email: gate.user.email,
  });
}
