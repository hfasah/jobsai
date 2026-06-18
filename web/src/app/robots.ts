import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep gated app, admin, API, auth, and per-tenant pages out of the index.
        disallow: [
          "/dashboard",
          "/admin",
          "/api",
          "/onboard",
          "/account",
          "/sign-in",
          "/sign-up",
          "/e/",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
