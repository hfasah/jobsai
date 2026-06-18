import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep private app, admin, API, and per-customer surfaces out of the index.
        disallow: [
          "/admin",
          "/dashboard",
          "/api",
          "/enterprise/quote",
          "/enterprise/onboard",
          "/enterprise/locked",
          "/enterprise/candidates",
          "/enterprise/inbox",
          "/enterprise/settings",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
