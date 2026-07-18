// Single source of truth for enterprise plan pricing — used by the pricing
// cards (UI) and the pricing page's Product/OfferCatalog JSON-LD, so prices in
// structured data can never drift from what's displayed.

export type Plan = {
  name: string;
  sub: string;            // ONE line: who this plan is for
  journey: string;        // the progression ladder label (Start Hiring → …)
  monthly: number | null; // null = custom (Enterprise)
  highlights: string[];   // max 5 — people buy fit, not feature counts
  includes: string[];     // capacity limits, shown small under the features
  cta: string;
  href: string;
  popular?: boolean;
};

const BOOK_DEMO = "/enterprise/demo";

export const PLANS: Plan[] = [
  {
    name: "Professional",
    sub: "For startups & growing teams",
    journey: "Start Hiring",
    monthly: 299,
    highlights: ["AI Recruiting ATS", "AI Candidate Screening", "Career Pages & Candidate Portal", "Interview Scheduling", "Offer Letters & E-Signatures"],
    includes: ["3 recruiters", "10 active jobs", "5,000 candidates"],
    cta: "Start free trial", href: "/enterprise-login",
  },
  {
    name: "Agency",
    sub: "For recruiting & staffing firms",
    journey: "Scale Recruiting",
    monthly: 799, popular: true,
    highlights: ["Everything in Professional", "Recruiting CRM", "AI Sourcing & Outreach", "Talent Pools", "Client Portal & White Label"],
    includes: ["10 recruiters", "50 active jobs", "50,000 candidates"],
    cta: "Start free trial", href: "/enterprise-login",
  },
  {
    name: "Business",
    sub: "For corporate HR & Talent Acquisition",
    journey: "Enterprise Hiring",
    monthly: 1499,
    highlights: ["Everything in Agency", "Hiring Manager Workspace", "Workflow Automation", "Executive Analytics", "Enterprise Security (SSO)"],
    includes: ["25 recruiters", "Unlimited jobs", "Unlimited candidates"],
    cta: "Start free trial", href: "/enterprise-login",
  },
  {
    name: "Enterprise",
    sub: "For large organizations with custom requirements",
    journey: "Global Talent Operations",
    monthly: null,
    highlights: ["Everything in Business", "Custom Integrations", "Dedicated Success Manager", "Private Deployment Options", "Custom SLA"],
    includes: ["Unlimited everything"],
    cta: "Book a Consultation", href: BOOK_DEMO,
  },
];

export const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;
// Annual = 20% off. Monthly-equivalent is rounded first, then ×12 (so the
// headline /month and the /year total stay consistent).
export const monthlyEquiv = (m: number) => Math.round(m * 0.8);
export const annualTotal = (m: number) => monthlyEquiv(m) * 12;
export const yearlySavings = (m: number) => m * 12 - annualTotal(m);
