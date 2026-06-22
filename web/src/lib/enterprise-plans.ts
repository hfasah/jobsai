// Single source of truth for enterprise plan pricing — used by the pricing
// cards (UI) and the pricing page's Product/OfferCatalog JSON-LD, so prices in
// structured data can never drift from what's displayed.

export type Plan = {
  name: string;
  sub: string;
  monthly: number | null; // null = custom (Enterprise)
  highlights: string[];
  limits: string;
  cta: string;
  href: string;
  popular?: boolean;
};

const BOOK_DEMO = "/enterprise/demo";

export const PLANS: Plan[] = [
  {
    name: "Professional", monthly: 299, sub: "For startups, small HR teams, and growing recruiting firms.",
    highlights: ["ATS, career pages & candidate portal", "AI scoring, top picks & comparison", "Interview scheduling (Google/Microsoft)", "Offer letters & e-signature"],
    limits: "3 recruiters · 10 active jobs · 5,000 candidates", cta: "Start free trial", href: "/enterprise-login",
  },
  {
    name: "Agency", monthly: 799, popular: true, sub: "For recruiting agencies, staffing firms, and executive search.",
    highlights: ["Everything in Professional", "Recruiting CRM, talent pools & email sequences", "AI sourcing & advanced search", "Client portal, reporting & white label"],
    limits: "10 recruiters · 50 active jobs · 50,000 candidates", cta: "Start free trial", href: "/enterprise-login",
  },
  {
    name: "Business", monthly: 1499, sub: "For corporate HR and talent acquisition teams.",
    highlights: ["Everything in Agency", "Hiring manager workspace & workflows", "Executive analytics & SAML/SSO", "Compliance center (GDPR, audit, legal hold)"],
    limits: "25 recruiters · unlimited jobs & candidates", cta: "Start free trial", href: "/enterprise-login",
  },
  {
    name: "Enterprise", monthly: null, sub: "For healthcare, banking, government, and large organizations.",
    highlights: ["Everything in Business", "Annual contracts, volume & multi-year discounts", "Dedicated onboarding, support & custom SLA", "Workday / ADP & custom integrations"],
    limits: "Unlimited everything", cta: "Book a demo", href: BOOK_DEMO,
  },
];

export const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;
// Annual = 20% off. Monthly-equivalent is rounded first, then ×12 (so the
// headline /month and the /year total stay consistent).
export const monthlyEquiv = (m: number) => Math.round(m * 0.8);
export const annualTotal = (m: number) => monthlyEquiv(m) * 12;
export const yearlySavings = (m: number) => m * 12 - annualTotal(m);
