import type { NextConfig } from "next";
import path from "path";

const securityHeaders = [
  // Clickjacking protection lives in CSP frame-ancestors below (supersedes
  // X-Frame-Options in modern browsers): same-origin plus the Sanity Studio,
  // whose Presentation pane embeds the site for visual editing previews.
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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://*.clerk.com https://*.clerk.accounts.dev https://clerk.jobsai.work https://challenges.cloudflare.com https://js.stripe.com https://api.leadconnectorhq.com https://link.msgsndr.com https://cdn.merge.dev",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.clerk.com https://clerk.jobsai.work",
      "font-src 'self' data: https://fonts.gstatic.com https://*.clerk.com https://clerk.jobsai.work",
      "img-src 'self' data: blob: https: http:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.clerk.com https://*.clerk.accounts.dev https://clerk.jobsai.work https://challenges.cloudflare.com https://api.clerk.dev https://api.skyvern.com https://api.resend.com https://api.stripe.com https://api.leadconnectorhq.com https://link.msgsndr.com https://*.merge.dev",
      "frame-src blob: https://*.clerk.com https://clerk.jobsai.work https://challenges.cloudflare.com https://js.stripe.com https://hooks.stripe.com https://api.leadconnectorhq.com https://*.merge.dev",
      "media-src 'self' blob:",
      "worker-src blob:",
      "frame-ancestors 'self' https://jobsai-marketing.sanity.studio",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  // Don't redirect on trailing slash so PostHog's API requests proxy cleanly.
  skipTrailingSlashRedirect: true,
  // Reverse-proxy PostHog through our own origin (/ingest → PostHog US cloud).
  // First-party requests satisfy our CSP (connect-src 'self') and slip past ad/
  // privacy blockers that would otherwise drop analytics for many real visitors.
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
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
