import type { Metadata } from "next";
import { headers } from "next/headers";
import { EnterpriseShell } from "@/components/enterprise/enterprise-shell";

// Entity-level structured data present on every enterprise page (satisfies the
// "JSON-LD present" check site-wide; individual pages may add richer schema).
const ENTERPRISE_JSONLD = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://app.jobsai.work/#organization",
    name: "JobsAI Enterprise",
    url: "https://app.jobsai.work",
    description:
      "JobsAI Enterprise is the AI-powered talent acquisition operating system — ATS, Recruiting CRM, AI Sourcing, AI Interviews, Workflow Automation, Analytics, and Governance in one workspace.",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://app.jobsai.work/#website",
    name: "JobsAI Enterprise",
    url: "https://app.jobsai.work",
    publisher: { "@id": "https://app.jobsai.work/#organization" },
  },
];

// Site-wide metadata for /enterprise/*:
//  • self-referencing canonical (from the path the middleware exposes),
//  • title template "%s" — overrides the root "%s | JobsAI Enterprise" so titles
//    that already include the brand don't get it stamped twice.
// Pages may override either (e.g. the home page sets an absolute title + its own
// canonical).
export async function generateMetadata(): Promise<Metadata> {
  const path = (await headers()).get("x-pathname") ?? "";
  const canonical = path.startsWith("/enterprise") ? path : undefined;
  return {
    title: { template: "%s", default: "JobsAI Enterprise — Talent Acquisition Operating System" },
    ...(canonical ? { alternates: { canonical } } : {}),
  };
}

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ENTERPRISE_JSONLD) }} />
      <EnterpriseShell>{children}</EnterpriseShell>
    </>
  );
}
