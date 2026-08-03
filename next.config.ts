import type { NextConfig } from "next";

// Content-Security-Policy. Locks down where the app may load/connect:
//  - script/style keep 'unsafe-inline' (Next's hydration bootstrap + the
//    viewport script in layout.tsx are inline; nonce-based CSP would need
//    per-request middleware — not worth the cost at this scale).
//  - connect-src is pinned to self + Supabase (REST/Realtime over https + wss).
//  - img-src allows https/data/blob so Google avatars + Unsplash/Pexels load.
//  - object-src/base-uri/form-action/frame-ancestors are the cheap high-value
//    locks (clickjacking, base-tag hijack, form exfiltration).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
  ],
};

export default nextConfig;
