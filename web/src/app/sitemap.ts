import type { MetadataRoute } from "next";
import { FEATURE_BY_SLUG } from "@/lib/marketing-features";

const BASE = (process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work").replace(/\/$/, "");

// Public marketing/SEO pages for the consumer site (jobsai.work). Tenant pages
// (careers/[slug], e/[slug]) and gated app routes are excluded (see robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPaths = [
    "/", "/salaries", "/faq", "/job-alerts", "/contact", "/affiliate",
    "/launch", "/privacy", "/terms", "/refund-policy",
  ];
  const featurePaths = Object.keys(FEATURE_BY_SLUG).map((slug) => `/features/${slug}`);

  return [...staticPaths, ...featurePaths].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "/" ? 1 : 0.7,
  }));
}
