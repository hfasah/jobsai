import type { MetadataRoute } from "next";
import { COMPARISONS } from "@/lib/enterprise-comparisons";
import { GUIDE } from "@/lib/enterprise-guide";
import { PERSONAS, INDUSTRIES } from "@/lib/enterprise-personas";
import { ROLES } from "@/lib/interview-questions";
import { JD_ROLES } from "@/lib/job-descriptions";
import { POSTS } from "@/lib/blog";

const BASE = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work").replace(/\/$/, "");

// Marketing/SEO pages for the enterprise site (app.jobsai.work). Gated app and
// admin routes are intentionally excluded (see robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPaths = [
    "/enterprise/home", "/enterprise/built-for", "/enterprise/industries", "/enterprise/pricing",
    "/enterprise/compare", "/enterprise/customers", "/enterprise/about", "/enterprise/contact",
    "/enterprise/guide", "/enterprise/demo", "/enterprise/partners", "/enterprise/security",
    "/enterprise/resources", "/enterprise/resources/interview-questions",
    "/enterprise/resources/job-descriptions",
    "/enterprise/blog", "/enterprise/tour",
    "/enterprise/privacy", "/enterprise/terms",
  ];
  const dynamicPaths = [
    ...COMPARISONS.map((c) => `/enterprise/compare/${c.slug}`),
    ...PERSONAS.map((p) => `/enterprise/built-for/${p.slug}`),
    ...INDUSTRIES.map((i) => `/enterprise/industries/${i.slug}`),
    ...GUIDE.flatMap((cat) => cat.articles.map((a) => `/enterprise/guide/${a.slug}`)),
    ...ROLES.map((r) => `/enterprise/resources/interview-questions/${r.slug}`),
    ...JD_ROLES.map((r) => `/enterprise/resources/job-descriptions/${r.slug}`),
    ...POSTS.map((p) => `/enterprise/blog/${p.slug}`),
  ];

  return [...staticPaths, ...dynamicPaths].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "/enterprise/home" ? 1 : 0.7,
  }));
}
