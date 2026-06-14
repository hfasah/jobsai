// Enterprise intake form — the tool checklist a prospect fills in, plus the
// "smart" plan suggestion logic used by the public form and the admin portal.

export type ToolPref = "need" | "want" | "unsure" | "no";
export const TOOL_PREFS: { value: ToolPref; label: string }[] = [
  { value: "need", label: "Need" },
  { value: "want", label: "Want" },
  { value: "unsure", label: "Not sure" },
  { value: "no", label: "Don't need" },
];

// tier: minimum plan that includes the tool (1=Professional … 4=Enterprise).
// tier 0 = add-on (available on any plan; doesn't drive the base plan).
export type Tool = { key: string; label: string; desc: string; tier: 0 | 1 | 2 | 3 | 4 };

export type ToolGroup = { title: string; tools: Tool[] };

export const TOOL_GROUPS: ToolGroup[] = [
  {
    title: "Core recruiting",
    tools: [
      { key: "ats", label: "Applicant Tracking (ATS)", desc: "Pipelines, candidate database, career pages.", tier: 1 },
      { key: "ai_scoring", label: "AI candidate scoring & top picks", desc: "Auto-rank applicants against each role.", tier: 1 },
      { key: "scheduling", label: "Interview scheduling", desc: "Google / Microsoft calendar + self-booking.", tier: 1 },
      { key: "offers", label: "Offer letters & e-signature", desc: "Generate, approve, and e-sign offers.", tier: 1 },
    ],
  },
  {
    title: "Sourcing, CRM & outreach",
    tools: [
      { key: "crm", label: "Recruiting CRM & talent pools", desc: "Nurture candidates and clients over time.", tier: 2 },
      { key: "ai_sourcing", label: "AI sourcing", desc: "Find & rediscover candidates with AI.", tier: 2 },
      { key: "outreach", label: "Outreach campaigns & email sequences", desc: "Multi-step automated nurture.", tier: 2 },
      { key: "client_portal", label: "Client portals & reporting", desc: "Branded shortlists for agency clients.", tier: 2 },
      { key: "white_label", label: "White-label & custom domain", desc: "Your brand across the experience.", tier: 2 },
      { key: "ats_integration", label: "ATS integration", desc: "Sync with Greenhouse, Lever, Workday & more.", tier: 2 },
    ],
  },
  {
    title: "Scale, analytics & governance",
    tools: [
      { key: "hiring_manager", label: "Hiring manager workspace", desc: "Focused review & approvals for managers.", tier: 3 },
      { key: "workflow", label: "Workflow automation", desc: "Automate stage moves, emails, follow-ups.", tier: 3 },
      { key: "analytics", label: "Executive analytics & funnel reporting", desc: "Pipeline health and hiring performance.", tier: 3 },
      { key: "sso", label: "SAML / SSO & advanced RBAC", desc: "Enterprise login & granular roles.", tier: 3 },
      { key: "compliance", label: "Compliance center", desc: "GDPR, audit logs, retention, legal hold.", tier: 3 },
    ],
  },
  {
    title: "Enterprise",
    tools: [
      { key: "dedicated", label: "Dedicated support + SLA", desc: "Named support with response guarantees.", tier: 4 },
      { key: "custom_integrations", label: "Workday / ADP & custom integrations", desc: "Bespoke HRIS/ATS connections.", tier: 4 },
      { key: "onboarding", label: "Private onboarding & security reviews", desc: "White-glove rollout & security.", tier: 4 },
    ],
  },
  {
    title: "Add-ons (any plan)",
    tools: [
      { key: "ai_interviews", label: "AI voice & avatar interviews", desc: "Automated screening with scoring.", tier: 0 },
      { key: "recruiting_agent", label: "Autonomous recruiting agent", desc: "24/7 sourcing, outreach & follow-ups.", tier: 0 },
      { key: "sms_whatsapp", label: "SMS & WhatsApp messaging", desc: "Reach candidates where they reply.", tier: 0 },
    ],
  },
];

export const ALL_TOOLS: Tool[] = TOOL_GROUPS.flatMap((g) => g.tools);
const TOOL_BY_KEY = new Map(ALL_TOOLS.map((t) => [t.key, t]));

export const EMPLOYEE_BANDS = ["1-10", "11-50", "51-200", "201-500", "501-1,000", "1,000+"];
export const HIRING_BANDS = ["1-10 / yr", "11-50 / yr", "51-200 / yr", "201-1,000 / yr", "1,000+ / yr"];

const TIER_SLUG: Record<number, string> = { 1: "professional", 2: "agency", 3: "business", 4: "enterprise" };
const SLUG_LABEL: Record<string, string> = { professional: "Professional", agency: "Agency", business: "Business", enterprise: "Enterprise" };

export type Suggestion = { slug: string; label: string; reasons: string[] };

// Smart plan suggestion: the highest tier required by the tools they "need" or
// "want", bumped up by team size, with Enterprise for the largest orgs.
export function suggestPlan(input: {
  toolPrefs: Record<string, ToolPref>;
  numRecruiters?: number | null;
  numEmployees?: string | null;
}): Suggestion {
  const reasons: string[] = [];
  let tier = 1; // everyone needs at least Professional

  // Tools they need/want drive the base tier.
  let topTool: Tool | null = null;
  for (const [key, pref] of Object.entries(input.toolPrefs ?? {})) {
    if (pref !== "need" && pref !== "want") continue;
    const tool = TOOL_BY_KEY.get(key);
    if (!tool || tool.tier === 0) continue; // add-ons don't change the base plan
    if (tool.tier > tier) { tier = tool.tier; topTool = tool; }
  }
  if (topTool) reasons.push(`Includes ${topTool.label} (and everything below it).`);

  // Team size (seats) can require a higher tier.
  const seats = input.numRecruiters ?? 0;
  let seatTier = 1;
  if (seats > 25) seatTier = 4;
  else if (seats > 10) seatTier = 3;
  else if (seats > 3) seatTier = 2;
  if (seatTier > tier) { tier = seatTier; reasons.push(`Fits ${seats} recruiter seats.`); }
  else if (seats > 0 && seatTier === tier) reasons.push(`Covers ${seats} recruiter seats.`);

  // Very large orgs → Enterprise.
  if (input.numEmployees === "1,000+" && tier < 4) {
    tier = 4;
    reasons.push("Large organization (1,000+ employees).");
  }

  const slug = TIER_SLUG[tier];
  if (reasons.length === 0) reasons.push("Best starting point for your needs.");
  return { slug, label: SLUG_LABEL[slug], reasons };
}

export function toolLabel(key: string): string {
  return TOOL_BY_KEY.get(key)?.label ?? key;
}
