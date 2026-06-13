// "Compare" — JobsAI Enterprise vs. competitors. SEO/decision pages that
// intercept buyers actively evaluating recruiting platforms and convert them.
// Scope is deliberately the direct platform competitors (not point tools).
// Order reflects strategic priority:
//   Phase 1 (most strategic): Loxo, Ashby, Pin
//   Phase 2: Greenhouse, Lever, Teamtailor
// Positioning is honest: JobsAI is an AI-native all-in-one talent-acquisition
// platform; competitors are strong but typically lack native AI voice/avatar
// interviews and/or agency white-label. We acknowledge each one's real strength
// (builds trust) and compare at the capability level rather than asserting
// specific competitor prices (which change and would be fabricated here).
//
// `cmp` values: true = has it, false = doesn't, "partial" = limited / add-on /
// via integrations only. JobsAI is true across the standard capability matrix
// by design (it's the all-in-one platform), so we only store the competitor's
// column per row.

export type Cmp = boolean | "partial";

export type CompareRow = { label: string; cmp: Cmp };
export type WhyPoint = { title: string; body: string };
export type FaqItem = { q: string; a: string };

export type Comparison = {
  slug: string;
  competitor: string;        // "Ashby"
  category: string;          // what they're known for — shown as their strength
  tagline: string;           // dropdown / footer subcopy
  headline: string;          // hero H1 ("JobsAI vs Ashby")
  intro: string;             // hero subcopy
  verdict: string;           // TL;DR callout
  rows: CompareRow[];        // capability matrix (competitor column)
  why: WhyPoint[];           // why teams pick JobsAI
  competitorStrength: string; // honest "what they're good at"
  featured?: boolean;        // surfaced in the footer Compare column
};

// The standard capability matrix. JobsAI = true for every row; each comparison
// supplies the competitor's column in the same order.
export const CAPABILITIES: string[] = [
  "Applicant Tracking System (ATS)",
  "AI candidate sourcing",
  "Recruiting CRM & talent pools",
  "AI screening & scoring",
  "AI voice & avatar interviews",
  "Automated outreach & email sequences",
  "Interview scheduling",
  "Offer letters & e-signature",
  "Workflow automation",
  "Executive analytics & reporting",
  "White-label & client portals",
  "All-in-one — no extra tools to stitch together",
];

function row(label: string, cmp: Cmp): CompareRow {
  return { label, cmp };
}

export const COMPARISONS: Comparison[] = [
  // ── Phase 1: most strategic ───────────────────────────────────
  {
    slug: "loxo",
    competitor: "Loxo",
    category: "Talent-intelligence platform for agencies",
    tagline: "AI-native all-in-one vs. sourcing-led platform",
    headline: "JobsAI vs Loxo",
    intro: "Loxo is a strong all-in-one for staffing and executive search, combining ATS, CRM, AI sourcing, and contact data. JobsAI Enterprise matches that breadth and adds native AI voice & avatar interviews, workflow automation, compliance, and an autonomous recruiting agent.",
    verdict: "Loxo is a great fit for agencies that live in sourcing and outbound. JobsAI delivers the same all-in-one agency toolkit plus native AI interviews, deeper automation and compliance, and an autonomous agent — one platform from source to placement.",
    rows: [
      row("Applicant Tracking System (ATS)", true),
      row("AI candidate sourcing", true),
      row("Recruiting CRM & talent pools", true),
      row("AI screening & scoring", "partial"),
      row("AI voice & avatar interviews", false),
      row("Automated outreach & email sequences", true),
      row("Interview scheduling", true),
      row("Offer letters & e-signature", "partial"),
      row("Workflow automation", true),
      row("Executive analytics & reporting", true),
      row("White-label & client portals", "partial"),
      row("All-in-one — no extra tools to stitch together", true),
    ],
    why: [
      { title: "Native AI interviews", body: "Run AI voice and avatar screens with scoring — not just sourcing and outreach." },
      { title: "Compliance & automation built in", body: "Workflow automation, audit logs, and retention policies come native, not bolted on." },
      { title: "End-to-end for agencies", body: "Source, screen, interview, present to clients, and place — all in one workspace." },
    ],
    competitorStrength: "Loxo is excellent at AI sourcing, contact-data enrichment, and outbound for staffing and executive-search firms.",
    featured: true,
  },
  {
    slug: "ashby",
    competitor: "Ashby",
    category: "Analytics-first all-in-one ATS",
    tagline: "AI-native platform vs. analytics-led ATS",
    headline: "JobsAI vs Ashby",
    intro: "Ashby and JobsAI both position themselves as modern recruiting operating systems. Ashby is known for its scheduling and analytics; JobsAI is AI-native — adding deep AI sourcing and built-in AI voice & avatar interviews on the same all-in-one foundation.",
    verdict: "Ashby is excellent for analytics-driven in-house teams. Choose JobsAI when you want that all-in-one foundation plus native AI sourcing, AI voice/avatar interviews, an autonomous recruiting agent, and agency-grade white-label client portals — without bolting on extra tools.",
    rows: [
      row("Applicant Tracking System (ATS)", true),
      row("AI candidate sourcing", "partial"),
      row("Recruiting CRM & talent pools", true),
      row("AI screening & scoring", "partial"),
      row("AI voice & avatar interviews", false),
      row("Automated outreach & email sequences", true),
      row("Interview scheduling", true),
      row("Offer letters & e-signature", true),
      row("Workflow automation", true),
      row("Executive analytics & reporting", true),
      row("White-label & client portals", false),
      row("All-in-one — no extra tools to stitch together", true),
    ],
    why: [
      { title: "Native AI interviews", body: "Run structured AI voice and avatar screens with scoring inside the platform — not a third-party add-on." },
      { title: "AI sourcing built in", body: "Find and rediscover candidates with AI, then move them straight into your pipeline." },
      { title: "Made for agencies too", body: "White-label client portals and reporting come standard on Agency plans — beyond in-house use." },
    ],
    competitorStrength: "Ashby's reporting and analytics are best-in-class, and its scheduling is among the smoothest available for structured in-house hiring.",
    featured: true,
  },
  {
    slug: "pin",
    competitor: "Pin",
    category: "AI recruiting tool",
    tagline: "AI talent acquisition OS vs. AI recruiting tool",
    headline: "JobsAI vs Pin",
    intro: "Pin markets an AI recruiting tool focused on sourcing and outreach. JobsAI Enterprise is a full AI talent acquisition operating system — ATS, CRM, AI sourcing, AI interviews, offers, automation, and analytics in one place.",
    verdict: "Pin is a slick AI recruiting tool for finding and reaching candidates. JobsAI is the operating system around it — applicant tracking, AI interviews, offers, automation, and reporting — so candidates go from sourced to hired without leaving the platform.",
    rows: [
      row("Applicant Tracking System (ATS)", "partial"),
      row("AI candidate sourcing", true),
      row("Recruiting CRM & talent pools", "partial"),
      row("AI screening & scoring", "partial"),
      row("AI voice & avatar interviews", false),
      row("Automated outreach & email sequences", true),
      row("Interview scheduling", true),
      row("Offer letters & e-signature", false),
      row("Workflow automation", "partial"),
      row("Executive analytics & reporting", "partial"),
      row("White-label & client portals", false),
      row("All-in-one — no extra tools to stitch together", false),
    ],
    why: [
      { title: "An OS, not a tool", body: "Sourced candidates flow into a real ATS with screening, interviews, offers, and analytics — not a standalone list." },
      { title: "Native AI interviews", body: "Run AI voice and avatar interviews with scoring — beyond sourcing and outreach." },
      { title: "One system of record", body: "No exporting candidates to a separate ATS to actually hire them." },
    ],
    competitorStrength: "Pin offers a fast, modern AI sourcing and outreach-agent experience for proactive recruiting.",
    featured: true,
  },
  // ── Phase 2: established ATS benchmarks ───────────────────────
  {
    slug: "greenhouse",
    competitor: "Greenhouse",
    category: "Structured hiring ATS",
    tagline: "AI-native all-in-one vs. ATS + marketplace",
    headline: "JobsAI vs Greenhouse",
    intro: "Greenhouse is the gold standard for structured, compliant hiring at scale, with a large integration marketplace. JobsAI Enterprise builds sourcing, screening, AI interviews, and outreach in natively — no marketplace assembly required.",
    verdict: "Greenhouse is a superb ATS if you'll assemble sourcing, CRM, and AI tools around it via its marketplace. JobsAI gives you those capabilities natively in one platform — and still integrates with Greenhouse if you're not ready to switch.",
    rows: [
      row("Applicant Tracking System (ATS)", true),
      row("AI candidate sourcing", "partial"),
      row("Recruiting CRM & talent pools", "partial"),
      row("AI screening & scoring", "partial"),
      row("AI voice & avatar interviews", false),
      row("Automated outreach & email sequences", "partial"),
      row("Interview scheduling", true),
      row("Offer letters & e-signature", true),
      row("Workflow automation", true),
      row("Executive analytics & reporting", true),
      row("White-label & client portals", false),
      row("All-in-one — no extra tools to stitch together", "partial"),
    ],
    why: [
      { title: "Native, not assembled", body: "AI sourcing, CRM, screening, and interviews are built in — no marketplace add-ons to license and integrate." },
      { title: "AI voice & avatar interviews", body: "Screen candidates with structured AI interviews and scoring out of the box." },
      { title: "Migrate at your pace", body: "JobsAI integrates with Greenhouse via Merge, so you can adopt it gradually instead of a hard cutover." },
    ],
    competitorStrength: "Greenhouse is exceptional at structured interviewing, hiring compliance, and a deep ecosystem of integrations for large, process-mature teams.",
    featured: true,
  },
  {
    slug: "lever",
    competitor: "Lever",
    category: "ATS + CRM (talent relationship)",
    tagline: "AI-native platform vs. ATS + CRM",
    headline: "JobsAI vs Lever",
    intro: "Lever pioneered combining an ATS with a candidate-relationship CRM for nurture-driven hiring. JobsAI Enterprise pairs that ATS + CRM with native AI sourcing, AI interviews, and outreach.",
    verdict: "Lever is a strong choice for relationship-driven recruiting with built-in nurture. JobsAI adds AI sourcing, AI voice/avatar interviews, and agency white-label on the same all-in-one base.",
    rows: [
      row("Applicant Tracking System (ATS)", true),
      row("AI candidate sourcing", "partial"),
      row("Recruiting CRM & talent pools", true),
      row("AI screening & scoring", "partial"),
      row("AI voice & avatar interviews", false),
      row("Automated outreach & email sequences", true),
      row("Interview scheduling", true),
      row("Offer letters & e-signature", true),
      row("Workflow automation", true),
      row("Executive analytics & reporting", true),
      row("White-label & client portals", false),
      row("All-in-one — no extra tools to stitch together", "partial"),
    ],
    why: [
      { title: "AI does more of the work", body: "Native AI sourcing, screening, and voice/avatar interviews — beyond ATS + nurture." },
      { title: "One platform for agencies", body: "White-label client portals and reporting are included on Agency plans." },
      { title: "Switch without losing data", body: "Import candidates and integrate with Lever via Merge during migration." },
    ],
    competitorStrength: "Lever's combined ATS + CRM and nurture campaigns are excellent for teams that prioritize long-term candidate relationships.",
    featured: true,
  },
  {
    slug: "teamtailor",
    competitor: "Teamtailor",
    category: "ATS + employer branding & career sites",
    tagline: "AI-native hiring vs. branding-led ATS",
    headline: "JobsAI vs Teamtailor",
    intro: "Teamtailor is loved for its employer branding and career-site builder on top of an easy ATS. JobsAI Enterprise leads with AI — native sourcing, screening, and voice/avatar interviews — across the whole funnel.",
    verdict: "Teamtailor is great if employer branding and a beautiful careers site are your priority. JobsAI wins when AI sourcing, AI interviews, and deep automation matter more — with the ATS to back them.",
    rows: [
      row("Applicant Tracking System (ATS)", true),
      row("AI candidate sourcing", "partial"),
      row("Recruiting CRM & talent pools", true),
      row("AI screening & scoring", "partial"),
      row("AI voice & avatar interviews", false),
      row("Automated outreach & email sequences", true),
      row("Interview scheduling", true),
      row("Offer letters & e-signature", "partial"),
      row("Workflow automation", true),
      row("Executive analytics & reporting", true),
      row("White-label & client portals", "partial"),
      row("All-in-one — no extra tools to stitch together", "partial"),
    ],
    why: [
      { title: "AI-first, not branding-first", body: "Native AI sourcing, scoring, and voice/avatar interviews drive the funnel — not just a careers page." },
      { title: "Agency client portals", body: "White-label client portals and reporting are built for staffing and search firms." },
      { title: "Deeper automation", body: "Multi-step outreach sequences and workflow automation across the lifecycle." },
    ],
    competitorStrength: "Teamtailor is outstanding at employer branding, customizable career sites, and a friendly candidate experience.",
    featured: true,
  },
];

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}

// Shared FAQ-style questions, lightly templated per competitor.
export function comparisonFaqs(c: Comparison): FaqItem[] {
  return [
    {
      q: `Is JobsAI a replacement for ${c.competitor}?`,
      a: `For most teams, yes. JobsAI Enterprise covers ${c.category.toLowerCase()} and the rest of the hiring lifecycle in one platform, so you can consolidate instead of running ${c.competitor} alongside several other tools.`,
    },
    {
      q: `Can I migrate from ${c.competitor} to JobsAI?`,
      a: `Yes. You can import candidates and data, and JobsAI integrates with major ATS platforms (via Merge) so you can move at your own pace. Our team helps with onboarding and migration.`,
    },
    {
      q: `How does pricing compare?`,
      a: `JobsAI plans start at $299/mo and include a 14-day free trial. Because JobsAI replaces several point tools at once, teams typically reduce total spend versus buying ${c.competitor} plus a separate ATS, CRM, and interview tool.`,
    },
    {
      q: `Do I have to give up what ${c.competitor} is good at?`,
      a: `No. ${c.competitorStrength} JobsAI delivers comparable strength in that area within a single platform — and adds the capabilities ${c.competitor} doesn't.`,
    },
  ];
}
