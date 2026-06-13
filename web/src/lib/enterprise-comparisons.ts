// "Compare" — JobsAI Enterprise vs. competitors. SEO/decision pages that help a
// prospect choose JobsAI. The angle is honest positioning: JobsAI is an
// all-in-one AI talent-acquisition platform (ATS + CRM + sourcing + AI
// interviews + outreach + analytics), while most competitors are strong point
// solutions. We acknowledge what each competitor is genuinely good at (builds
// trust) and compare at the capability/category level rather than asserting
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
  competitor: string;        // "LinkedIn Recruiter"
  category: string;          // what they're known for — shown as their strength
  tagline: string;           // dropdown / footer subcopy
  headline: string;          // hero H1 ("JobsAI vs LinkedIn Recruiter")
  intro: string;             // hero subcopy
  verdict: string;           // TL;DR callout
  rows: CompareRow[];        // capability matrix (competitor column)
  why: WhyPoint[];           // why teams pick JobsAI
  competitorStrength: string; // honest "what they're good at"
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
  {
    slug: "linkedin-recruiter",
    competitor: "LinkedIn Recruiter",
    category: "Candidate sourcing on LinkedIn",
    tagline: "An all-in-one hiring platform vs. a sourcing seat",
    headline: "JobsAI vs LinkedIn Recruiter",
    intro: "LinkedIn Recruiter is built for searching and messaging candidates on LinkedIn. JobsAI Enterprise runs the entire hiring lifecycle — sourcing, screening, interviewing, and hiring — in one AI-powered platform.",
    verdict: "Choose LinkedIn Recruiter to message people on LinkedIn. Choose JobsAI when you want sourcing, an ATS, AI screening, AI interviews, outreach, and analytics in one place — without paying for premium seats on top of your other recruiting tools.",
    rows: [
      row("Applicant Tracking System (ATS)", false),
      row("AI candidate sourcing", "partial"),
      row("Recruiting CRM & talent pools", "partial"),
      row("AI screening & scoring", false),
      row("AI voice & avatar interviews", false),
      row("Automated outreach & email sequences", "partial"),
      row("Interview scheduling", false),
      row("Offer letters & e-signature", false),
      row("Workflow automation", false),
      row("Executive analytics & reporting", "partial"),
      row("White-label & client portals", false),
      row("All-in-one — no extra tools to stitch together", false),
    ],
    why: [
      { title: "One platform, not one channel", body: "Source beyond a single network, then screen, interview, and hire in the same system — no exporting to an ATS." },
      { title: "AI does the heavy lifting", body: "Auto-score and rank applicants, run AI voice/avatar interviews, and draft personalized outreach — work LinkedIn Recruiter leaves to you." },
      { title: "Predictable pricing", body: "No per-seat premium licenses layered on top of your ATS and CRM. JobsAI replaces several tools at once." },
    ],
    competitorStrength: "LinkedIn Recruiter has unmatched access to LinkedIn's professional graph and is excellent for InMail outreach to passive candidates on that network.",
  },
  {
    slug: "hireez",
    competitor: "hireEZ",
    category: "AI sourcing & talent intelligence",
    tagline: "Sourcing tool vs. full hiring platform",
    headline: "JobsAI vs hireEZ",
    intro: "hireEZ is a strong AI sourcing and outbound tool. JobsAI Enterprise adds everything that happens after you find a candidate — applicant tracking, AI interviews, scheduling, offers, and analytics.",
    verdict: "hireEZ shines at outbound sourcing. JobsAI gives you that sourcing plus a full ATS, AI screening and interviews, scheduling, and offer management — so candidates move from sourced to hired without leaving the platform.",
    rows: [
      row("Applicant Tracking System (ATS)", false),
      row("AI candidate sourcing", true),
      row("Recruiting CRM & talent pools", true),
      row("AI screening & scoring", "partial"),
      row("AI voice & avatar interviews", false),
      row("Automated outreach & email sequences", true),
      row("Interview scheduling", "partial"),
      row("Offer letters & e-signature", false),
      row("Workflow automation", "partial"),
      row("Executive analytics & reporting", "partial"),
      row("White-label & client portals", false),
      row("All-in-one — no extra tools to stitch together", false),
    ],
    why: [
      { title: "From sourced to hired in one system", body: "Keep candidates in the same platform through screening, interviews, offers, and onboarding — no separate ATS required." },
      { title: "AI interviews built in", body: "Run AI voice and avatar screens with automatic scoring, not just outbound messaging." },
      { title: "Built for agencies too", body: "White-label client portals and reporting come standard on Agency plans." },
    ],
    competitorStrength: "hireEZ is excellent at outbound sourcing breadth and contact-data enrichment for proactive recruiting teams.",
  },
  {
    slug: "gem",
    competitor: "Gem",
    category: "Recruiting CRM & sourcing analytics",
    tagline: "CRM layer vs. complete platform",
    headline: "JobsAI vs Gem",
    intro: "Gem is a well-loved recruiting CRM and analytics layer that sits alongside your ATS. JobsAI Enterprise is the ATS, the CRM, and the AI — one system instead of two.",
    verdict: "Gem is a great CRM if you already run a separate ATS and want better pipeline analytics. JobsAI gives you the CRM and the ATS together, plus AI sourcing, screening, and interviews — fewer tools, fewer integrations, one source of truth.",
    rows: [
      row("Applicant Tracking System (ATS)", "partial"),
      row("AI candidate sourcing", true),
      row("Recruiting CRM & talent pools", true),
      row("AI screening & scoring", "partial"),
      row("AI voice & avatar interviews", false),
      row("Automated outreach & email sequences", true),
      row("Interview scheduling", true),
      row("Offer letters & e-signature", false),
      row("Workflow automation", true),
      row("Executive analytics & reporting", true),
      row("White-label & client portals", false),
      row("All-in-one — no extra tools to stitch together", false),
    ],
    why: [
      { title: "ATS + CRM in one", body: "No syncing candidates between your ATS and a separate CRM — it's the same record everywhere." },
      { title: "AI interviews and scoring", body: "Screen and rank candidates with AI, then run voice/avatar interviews — beyond CRM nurture and analytics." },
      { title: "One bill, one login", body: "Replace the ATS + CRM + sourcing stack with a single platform and a single contract." },
    ],
    competitorStrength: "Gem is outstanding at sourcing analytics, pipeline reporting, and email nurture for teams committed to a separate ATS.",
  },
  {
    slug: "paradox",
    competitor: "Paradox (Olivia)",
    category: "Conversational AI for screening & scheduling",
    tagline: "Chat assistant vs. full hiring platform",
    headline: "JobsAI vs Paradox",
    intro: "Paradox's Olivia automates conversational screening and scheduling, often layered on an existing ATS. JobsAI Enterprise is the ATS itself, with AI sourcing, voice/avatar interviews, outreach, and analytics built in.",
    verdict: "Paradox is great for high-volume conversational screening and scheduling on top of your current ATS. JobsAI delivers that automation as part of a complete platform — so you're not paying for and integrating a separate assistant.",
    rows: [
      row("Applicant Tracking System (ATS)", "partial"),
      row("AI candidate sourcing", false),
      row("Recruiting CRM & talent pools", "partial"),
      row("AI screening & scoring", true),
      row("AI voice & avatar interviews", "partial"),
      row("Automated outreach & email sequences", true),
      row("Interview scheduling", true),
      row("Offer letters & e-signature", "partial"),
      row("Workflow automation", true),
      row("Executive analytics & reporting", "partial"),
      row("White-label & client portals", false),
      row("All-in-one — no extra tools to stitch together", false),
    ],
    why: [
      { title: "Sourcing the assistant can't do", body: "Find candidates with AI sourcing and talent rediscovery, not just screen the ones who already applied." },
      { title: "Real AI interviews", body: "Run structured AI voice and avatar interviews with scoring — beyond chat-based Q&A." },
      { title: "No ATS underneath required", body: "JobsAI is the system of record, so there's nothing to bolt the assistant onto." },
    ],
    competitorStrength: "Paradox is excellent at high-volume, conversational candidate experiences and frictionless scheduling, especially for hourly and frontline hiring.",
  },
  {
    slug: "hirevue",
    competitor: "HireVue",
    category: "Video interviews & assessments",
    tagline: "Interview tool vs. end-to-end platform",
    headline: "JobsAI vs HireVue",
    intro: "HireVue specializes in video interviewing and assessments. JobsAI Enterprise includes AI voice and avatar interviews as one part of a complete sourcing-to-hire platform.",
    verdict: "HireVue is a focused interview and assessment product. JobsAI gives you AI interviews plus the sourcing, ATS, outreach, and analytics around them — so interviewing is connected to the rest of your hiring, not a separate step.",
    rows: [
      row("Applicant Tracking System (ATS)", false),
      row("AI candidate sourcing", false),
      row("Recruiting CRM & talent pools", false),
      row("AI screening & scoring", true),
      row("AI voice & avatar interviews", true),
      row("Automated outreach & email sequences", false),
      row("Interview scheduling", true),
      row("Offer letters & e-signature", false),
      row("Workflow automation", "partial"),
      row("Executive analytics & reporting", "partial"),
      row("White-label & client portals", false),
      row("All-in-one — no extra tools to stitch together", false),
    ],
    why: [
      { title: "Interviews in context", body: "Candidate, scores, and interview live on one record — no exporting results back to an ATS." },
      { title: "Source and nurture too", body: "Find and engage candidates before the interview, all in the same platform." },
      { title: "One platform cost", body: "Replace a standalone interview tool plus your ATS and CRM with a single subscription." },
    ],
    competitorStrength: "HireVue offers deep, validated assessments and structured video interviewing at enterprise scale.",
  },
  {
    slug: "juicebox",
    competitor: "Juicebox (PeopleGPT)",
    category: "Natural-language AI sourcing",
    tagline: "AI search vs. complete hiring platform",
    headline: "JobsAI vs Juicebox",
    intro: "Juicebox's PeopleGPT is a natural-language candidate search tool. JobsAI Enterprise includes AI sourcing like that — and the ATS, screening, interviews, outreach, and analytics to act on the results.",
    verdict: "Juicebox is a slick way to search for people in plain English. JobsAI gives you that AI search inside a full platform, so the candidates you find flow straight into screening, interviews, and your pipeline.",
    rows: [
      row("Applicant Tracking System (ATS)", false),
      row("AI candidate sourcing", true),
      row("Recruiting CRM & talent pools", "partial"),
      row("AI screening & scoring", "partial"),
      row("AI voice & avatar interviews", false),
      row("Automated outreach & email sequences", "partial"),
      row("Interview scheduling", false),
      row("Offer letters & e-signature", false),
      row("Workflow automation", false),
      row("Executive analytics & reporting", false),
      row("White-label & client portals", false),
      row("All-in-one — no extra tools to stitch together", false),
    ],
    why: [
      { title: "Search that goes somewhere", body: "Candidates you find with AI search land in your pipeline, ready to screen and interview — no copy-paste into another tool." },
      { title: "Screen and interview with AI", body: "Auto-score sourced candidates and run AI voice/avatar interviews, not just build a list." },
      { title: "The whole funnel", body: "Sourcing is step one — JobsAI carries candidates all the way to offer." },
    ],
    competitorStrength: "Juicebox makes natural-language candidate discovery fast and intuitive, with strong search-quality for proactive sourcing.",
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
