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
  // Restrict powerful browser features we don't use. Camera + mic are allowed
  // for our own origin (self) — needed for avatar/voice mock interviews.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=()" },
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
      // Soro (app.trysoro.com): the embedded blog widget on /blog — its loader
      // script, the CSS/fonts it injects, and the API it fetches articles from.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://*.clerk.com https://*.clerk.accounts.dev https://clerk.jobsai.work https://challenges.cloudflare.com https://js.stripe.com https://api.leadconnectorhq.com https://www.googletagmanager.com https://*.googletagmanager.com https://*.trysoro.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.clerk.com https://clerk.jobsai.work https://*.trysoro.com",
      "font-src 'self' data: https://fonts.gstatic.com https://*.clerk.com https://clerk.jobsai.work https://*.trysoro.com",
      "img-src 'self' data: blob: https: http:",
      // LiveAvatar (avatar mock interview): api.liveavatar.com for session start/stop/keep-alive
      // (called client-side), plus the LiveKit WebRTC room (*.livekit.cloud) and HeyGen WebSocket
      // signaling (*.heygen.io) the SDK connects to. Without these the SDK's session.start() is
      // blocked by CSP, throws, and the room silently falls back to the simulated/initials avatar.
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.clerk.com https://*.clerk.accounts.dev https://clerk.jobsai.work https://challenges.cloudflare.com https://api.clerk.dev https://api.skyvern.com https://api.resend.com https://api.stripe.com https://api.liveavatar.com https://*.livekit.cloud wss://*.livekit.cloud https://*.heygen.io wss://*.heygen.io https://www.googletagmanager.com https://*.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://*.trysoro.com",
      "frame-src blob: https://*.clerk.com https://clerk.jobsai.work https://challenges.cloudflare.com https://js.stripe.com https://hooks.stripe.com https://api.leadconnectorhq.com https://www.googletagmanager.com https://*.trysoro.com",
      "media-src 'self' blob:",
      "worker-src blob:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  // Serve next/image output as AVIF (then WebP) — AVIF is ~20-30% smaller than
  // WebP — and cache the optimized variants for 31 days so repeat visits and
  // crawlers don't re-fetch. Defaults are WebP-only with a 60s TTL.
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400, // 31 days
  },
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
  // The super-admin portal lives on the enterprise deploy (app.jobsai.work/admin),
  // which is a superset of this consumer admin and manages both consumer +
  // enterprise from one place. Send any /admin visit on www there so there's one
  // door. This redirect only ships on the consumer (main) build — the enterprise
  // build keeps serving /admin normally.
  async redirects() {
    return [
      { source: "/admin", destination: "https://app.jobsai.work/admin", permanent: false },
      { source: "/admin/:path*", destination: "https://app.jobsai.work/admin/:path*", permanent: false },
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
