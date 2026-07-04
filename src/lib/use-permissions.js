'use client';

import { useSession } from 'next-auth/react';
import { canWrite, canApprove, isAdmin } from './permissions';

// Client-side view of the same capability map the server enforces.
// UI uses this to hide write actions from read-only roles — the real
// enforcement still happens in the API guards.
export function usePermissions() {
  const { data: session } = useSession();
  const role = session?.user?.role || '';
  return {
    role,
    user: session?.user || null,
    canWrite: canWrite(role),
    canApprove: canApprove(role),
    isAdmin: isAdmin(role),
  };
}
