// "Built For" — JobsAI Enterprise is positioned by buyer persona, not industry:
// recruiters across industries share the same problems. Each persona drives a
// dropdown entry + a dedicated landing page.
export type PersonaFeature = { name: string; desc: string };
export type Persona = {
  slug: string;
  name: string;
  tagline: string; // short, for the dropdown
  headline: string; // hero H1 on the page
  intro: string; // hero subcopy
  features: PersonaFeature[];
};

export const PERSONAS: Persona[] = [
  {
    slug: "recruiting-agencies",
    name: "Recruiting Agencies",
    tagline: "Multi-client workspaces & placements",
    headline: "Run every client from one workspace",
    intro:
      "Manage multiple clients, pipelines, and placements without switching tools — branded for each account.",
    features: [
      { name: "Recruiting CRM", desc: "Track clients, contacts, and deals alongside candidates." },
      { name: "Client Portal", desc: "Give each client a branded view of their pipeline." },
      { name: "White Label", desc: "Your logo, domain, and colors across the candidate experience." },
      { name: "Candidate Presentation", desc: "Share polished shortlists clients can review in a click." },
      { name: "Placement Tracking", desc: "Follow every submission from intro to placement." },
    ],
  },
  {
    slug: "staffing-firms",
    name: "Staffing Firms",
    tagline: "High-volume sourcing & automation",
    headline: "Scale high-volume hiring with AI",
    intro:
      "Source, screen, and move thousands of candidates with AI and automation doing the repetitive work.",
    features: [
      { name: "AI Sourcing", desc: "Surface qualified candidates automatically from your network and the web." },
      { name: "Bulk Screening", desc: "AI-score and rank large applicant pools in minutes." },
      { name: "Workflow Automation", desc: "Automate stage moves, outreach, and follow-ups." },
      { name: "SMS & WhatsApp", desc: "Reach candidates where they actually reply." },
      { name: "Talent Pools", desc: "Build reusable pipelines for recurring roles." },
    ],
  },
  {
    slug: "corporate-hr",
    name: "Corporate HR Teams",
    tagline: "Centralized hiring across departments",
    headline: "One hiring system for the whole company",
    intro:
      "Centralize hiring across departments and locations with the structure and oversight HR needs.",
    features: [
      { name: "ATS", desc: "A modern applicant tracking system at the core." },
      { name: "Hiring Manager Workspace", desc: "Give managers a focused space to review and decide." },
      { name: "Offer Management", desc: "Generate, approve, and e-sign offers in one flow." },
      { name: "Compliance", desc: "GDPR tooling, retention policies, and consent built in." },
      { name: "Analytics", desc: "See pipeline health and hiring performance company-wide." },
    ],
  },
  {
    slug: "talent-acquisition",
    name: "Talent Acquisition Teams",
    tagline: "Faster time-to-hire & productivity",
    headline: "Hire faster, with less busywork",
    intro:
      "Reduce time-to-hire and lift recruiter productivity with AI that does the heavy lifting.",
    features: [
      { name: "AI Top Picks", desc: "The best-fit candidates surfaced for every role." },
      { name: "Candidate Ranking", desc: "Objective, explainable scoring across your pipeline." },
      { name: "AI Copilot", desc: "Ask questions and act on your data in plain language." },
      { name: "Interview Intelligence", desc: "AI-generated kits, notes, and structured feedback." },
      { name: "Workflow Automation", desc: "Remove the manual steps between stages." },
    ],
  },
  {
    slug: "hiring-managers",
    name: "Hiring Managers",
    tagline: "Review, feedback & approvals",
    headline: "Review and approve hires in minutes",
    intro:
      "A focused workspace to review candidates, leave feedback, and approve hires — without the recruiter back-and-forth.",
    features: [
      { name: "Hiring Manager Workspace", desc: "Everything you need for your roles, nothing you don't." },
      { name: "Candidate Reviews", desc: "Compare shortlists and weigh in quickly." },
      { name: "Interview Feedback", desc: "Structured scorecards keep decisions fair and fast." },
      { name: "Approval Workflows", desc: "Route offers and decisions for sign-off automatically." },
    ],
  },
  {
    slug: "enterprise-organizations",
    name: "Enterprise Organizations",
    tagline: "Security, compliance & governance",
    headline: "Secure, compliant hiring at scale",
    intro:
      "Run hiring operations across the org with the security, access control, and governance enterprises require.",
    features: [
      { name: "SAML SSO", desc: "Single sign-on with your identity provider." },
      { name: "RBAC", desc: "Granular role-based access control per team and action." },
      { name: "Compliance Center", desc: "GDPR, retention, consent, and legal hold in one place." },
      { name: "Audit Logs", desc: "A complete, exportable trail of every action." },
      { name: "Governance", desc: "Policies and oversight that scale with your org." },
    ],
  },
];

export function getPersona(slug: string): Persona | undefined {
  return PERSONAS.find((p) => p.slug === slug);
}

// Industries — the SAME platform capabilities, framed for each sector's hiring
// challenges. We intentionally reuse real features (not invented industry tools)
// to keep the positioning honest.
export const INDUSTRIES: Persona[] = [
  {
    slug: "technology",
    name: "Technology",
    tagline: "Engineering, product & data roles",
    headline: "Win the race for technical talent",
    intro: "Move fast in a competitive market with AI screening and structured, fair technical interviews.",
    features: [
      { name: "AI Candidate Scoring", desc: "Rank applicants on skills and experience instantly." },
      { name: "Structured Interview Kits", desc: "Consistent, fair technical interviews every time." },
      { name: "Workflow Automation", desc: "Cut the manual steps between sourcing and offer." },
      { name: "Talent Pools", desc: "Keep strong engineers warm for the next req." },
      { name: "Analytics", desc: "Track time-to-hire and pipeline health by team." },
    ],
  },
  {
    slug: "healthcare",
    name: "Healthcare",
    tagline: "Clinical & allied hiring at scale",
    headline: "Staff clinical and allied roles, fast",
    intro: "Handle high application volume with AI sourcing and screening — with compliance built in.",
    features: [
      { name: "AI Sourcing", desc: "Find qualified clinical and allied candidates faster." },
      { name: "Bulk Screening", desc: "AI-score large applicant pools in minutes." },
      { name: "Compliance", desc: "GDPR tooling, retention policies, and consent built in." },
      { name: "SMS & WhatsApp", desc: "Reach shift-based candidates where they reply." },
      { name: "Audit Logs", desc: "A complete record of every hiring decision." },
    ],
  },
  {
    slug: "financial-services",
    name: "Financial Services",
    tagline: "Compliant, governed hiring",
    headline: "Hire with governance and a full audit trail",
    intro: "Recruit for risk, compliance, and finance roles with the oversight regulators expect.",
    features: [
      { name: "Compliance Center", desc: "GDPR, retention, consent, and legal hold in one place." },
      { name: "Audit Logs", desc: "Exportable trail of every action and decision." },
      { name: "RBAC", desc: "Granular role-based access per team and action." },
      { name: "AI Candidate Scoring", desc: "Objective, explainable candidate ranking." },
      { name: "Offer Management", desc: "Approve and e-sign offers with full controls." },
    ],
  },
  {
    slug: "manufacturing",
    name: "Manufacturing",
    tagline: "High-volume & multi-site hiring",
    headline: "Staff every plant, shift, and location",
    intro: "Run high-volume hiring across sites with automation handling the repetitive work.",
    features: [
      { name: "Bulk Screening", desc: "Process large applicant volumes automatically." },
      { name: "Workflow Automation", desc: "Automate stage moves and candidate outreach." },
      { name: "Talent Pools", desc: "Build reusable pipelines for recurring roles." },
      { name: "SMS & WhatsApp", desc: "Connect with frontline candidates instantly." },
      { name: "Analytics", desc: "Compare hiring performance across locations." },
    ],
  },
  {
    slug: "professional-services",
    name: "Professional Services",
    tagline: "Client-facing & billable roles",
    headline: "Staff engagements with the right people",
    intro: "Win and deliver engagements with a CRM-driven approach to sourcing and placement.",
    features: [
      { name: "Recruiting CRM", desc: "Manage clients, contacts, and pipelines in one place." },
      { name: "Talent Pools", desc: "Bench-ready candidates for the next project." },
      { name: "AI Top Picks", desc: "Best-fit candidates surfaced for every role." },
      { name: "Client Portal", desc: "Share branded shortlists with stakeholders." },
      { name: "Analytics", desc: "Track utilization and time-to-staff." },
    ],
  },
  {
    slug: "government",
    name: "Government & Public Sector",
    tagline: "Compliant, auditable hiring",
    headline: "Fair, compliant, fully auditable hiring",
    intro: "Run transparent public-sector hiring with structure, access control, and a complete record.",
    features: [
      { name: "Compliance Center", desc: "Retention, consent, and legal hold built in." },
      { name: "Audit Logs", desc: "Every action logged and exportable for review." },
      { name: "RBAC", desc: "Control exactly who can see and do what." },
      { name: "Structured Interviews", desc: "Consistent scorecards keep hiring fair." },
      { name: "Governance", desc: "Policies and oversight that scale across agencies." },
    ],
  },
  {
    slug: "education",
    name: "Education",
    tagline: "Faculty & staff hiring",
    headline: "Manage faculty and staff hiring with ease",
    intro: "Coordinate seasonal faculty and staff hiring with structure and clear oversight.",
    features: [
      { name: "ATS", desc: "A modern applicant tracking system at the core." },
      { name: "Workflow Automation", desc: "Smooth approvals across departments and committees." },
      { name: "Hiring Manager Workspace", desc: "Give department heads a focused review space." },
      { name: "Compliance", desc: "Consent and retention handled for you." },
      { name: "Analytics", desc: "See pipeline health across the institution." },
    ],
  },
];

export function getIndustry(slug: string): Persona | undefined {
  return INDUSTRIES.find((p) => p.slug === slug);
}
