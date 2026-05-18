import './globals.css';
import { getServerSession } from 'next-auth';
import { Providers } from '../providers';
import { authOptions } from '../lib/auth';

export const metadata = { title: 'Initial Estate — ระบบจัดซื้อ ซัพพลายเชน' };

export default async function RootLayout({ children }) {
  // Pre-fetch the session on the server so SessionProvider doesn't need
  // to hit /api/auth/session on initial mount. Guard against any auth-config
  // failure so a misconfigured environment never blocks the entire app.
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    session = null;
  }

  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Serif:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
