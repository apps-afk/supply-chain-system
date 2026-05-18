'use client';
import { SessionProvider } from 'next-auth/react';

export function Providers({ children, session }) {
  return (
    <SessionProvider
      session={session}
      // Default behaviour: refetch on window focus so sessions sync across tabs
      // and recover from any client/server mismatch after sign-in.
      refetchInterval={0}
    >
      {children}
    </SessionProvider>
  );
}
