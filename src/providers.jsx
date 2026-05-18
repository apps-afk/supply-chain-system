'use client';
import { SessionProvider } from 'next-auth/react';

export function Providers({ children, session }) {
  return (
    <SessionProvider
      session={session}
      refetchOnWindowFocus={false}
      refetchInterval={0}
    >
      {children}
    </SessionProvider>
  );
}
