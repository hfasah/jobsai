import type { MetadataRoute } from "next";
import { COMPARISONS } from "@/lib/enterprise-comparisons";
import { GUIDE } from "@/lib/enterprise-guide";
import { PERSONAS, INDUSTRIES } from "@/lib/enterprise-personas";

const BASE = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work").replace(/\/$/, "");

// Marketing/SEO pages for the enterprise site (app.jobsai.work). Gated app and
// admin routes are intentionally excluded (see robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPaths = [
    "/enterprise/home", "/enterprise/built-for", "/enterprise/industries", "/enterprise/pricing",
    "/enterprise/compare", "/enterprise/customers", "/enterprise/about", "/enterprise/contact",
    "/enterprise/guide", "/enterprise/demo", "/enterprise/partners", "/enterprise/security",
    "/enterprise/privacy", "/enterprise/terms",
  ];
  const dynamicPaths = [
    ...COMPARISONS.map((c) => `/enterprise/compare/${c.slug}`),
    ...PERSONAS.map((p) => `/enterprise/built-for/${p.slug}`),
    ...INDUSTRIES.map((i) => `/enterprise/industries/${i.slug}`),
    ...GUIDE.flatMap((cat) => cat.articles.map((a) => `/enterprise/guide/${a.slug}`)),
  ];

  return [...staticPaths, ...dynamicPaths].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "/enterprise/home" ? 1 : 0.7,
  }));
}
