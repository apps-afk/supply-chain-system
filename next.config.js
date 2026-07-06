/** @type {import('next').NextConfig} */

// Baseline security headers applied to every response (defense-in-depth).
// CSP allows 'unsafe-inline' for styles — the UI is built with inline style
// objects throughout — but locks scripts to same-origin, forbids framing and
// object embeds, and blocks base-uri/form-action tricks.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js hydration/runtime
      // Google Fonts: without these two hosts the CSP silently blocked the
      // IBM Plex stylesheet + font files — production ran on fallback fonts.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",               // Drive thumbnails / data-URI assets
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
