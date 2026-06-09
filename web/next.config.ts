import type { NextConfig } from "next";
import path from "path";

const securityHeaders = [
  // Prevent clickjacking — stop the site being embedded in iframes.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Stop browsers guessing MIME types (XSS vector).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't send the Referer header to third-party sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Force HTTPS for 1 year once first visited.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Restrict powerful browser features we don't use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
  // Basic XSS protection for older browsers.
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // Content Security Policy — allows our own origin, Clerk, Stripe, Supabase,
  // Google (calendar/fonts), and the coaching/booking widget.
  // 'unsafe-inline' on scripts is needed for Next.js inline script chunks;
  // 'unsafe-eval' is needed for Clerk's hosted JS.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.jobsai.work https://*.clerk.accounts.dev https://js.stripe.com https://api.leadconnectorhq.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https: http:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.clerk.accounts.dev https://api.clerk.dev https://api.skyvern.com https://api.resend.com https://api.stripe.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com https://api.leadconnectorhq.com",
      "media-src 'self' blob:",
      "worker-src blob:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  async headers() {
    return [
      {
        // Apply to all routes.
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
