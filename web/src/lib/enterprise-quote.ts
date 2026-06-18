// Pricing engine for enterprise sales quotes. Pure + catalog-driven: every
// number comes from the `plans` / `features` / `plan_features` catalog so quotes
// reflect real pricing. All money is handled in cents.

export type QuotePlan = {
  slug: string;
  name: string;
  price_monthly: number | null; // dollars; null = custom (Enterprise)
  price_yearly: number | null;  // dollars; already 20% off annual
  sort_order: number;
};

export type CatalogFeature = {
  feature_key: string;
  name: string;
  category: string | null;
  is_addon: boolean;
  price_monthly: number | null; // dollars; add-on price
};

export type Catalog = {
  plans: QuotePlan[];
  features: CatalogFeature[];
  planFeatures: Record<string, string[]>; // plan_slug -> feature_key[]
};

export type QuoteAddon = { feature_key: string; quantity: number };

export type QuoteInput = {
  planSlug: string;
  billingPeriod: "monthly" | "yearly";
  addons: QuoteAddon[];
  extraRecruiters: number;
  discountPct: number;
  founding: boolean;
  priceOverrideMonthlyCents?: number | null;
};

export type QuoteLine = { key: string; name: string; qty: number; monthlyCents: number; yearlyCents: number };

export type QuoteResult = {
  plan: { slug: string; name: string; monthlyCents: number; yearlyCents: number; custom: boolean };
  addonLines: QuoteLine[];
  extraRecruiterLine: QuoteLine | null;
  subtotalMonthlyCents: number;
  subtotalYearlyCents: number;
  discountPct: number;
  founding: boolean;
  override: boolean;
  custom: boolean; // Enterprise custom pricing with no override set
  monthlyTotalCents: number;
  yearlyTotalCents: number;
  firstYearCents: number;        // first-year total for the chosen billing period, after founding
  yearlySavingsCents: number;    // saved by paying yearly vs monthly×12
  foundingSavingsCents: number;  // saved by the founding 50% first year
};

export const EXTRA_RECRUITER_PRICE = 29; // dollars / seat / month
const YEAR = 12;

// Maps the coarse intake `tool_prefs` keys to catalog `feature_key`s, so a lead's
// selections pre-fill the builder. Add-on intake keys map to their add-on feature.
export const INTAKE_TO_CATALOG: Record<string, string[]> = {
  ats: ["ats", "candidate_database", "career_pages", "candidate_portal", "job_posting", "resume_parsing"],
  ai_scoring: ["ai_scoring", "ai_top_picks", "ai_comparison"],
  scheduling: ["scheduling_google", "scheduling_outlook", "self_service_scheduling"],
  offers: ["offers", "e_signature"],
  crm: ["crm", "talent_pools", "candidate_nurturing"],
  outreach: ["outreach_campaigns"],
  ai_sourcing: ["ai_sourcing", "talent_rediscovery", "candidate_recommendations"],
  client_portal: ["client_portal", "candidate_sharing", "client_reporting"],
  white_label: ["white_label", "custom_domain"],
  ats_integration: [], // no single catalog feature — handled via integrations
  hiring_manager: ["hiring_manager_workspace"],
  workflow: ["workflow_automation"],
  analytics: ["executive_analytics", "funnel_reporting", "productivity_metrics"],
  sso: ["sso"],
  compliance: ["compliance_gdpr", "retention_policies", "audit_logs", "legal_hold"],
  dedicated: ["dedicated_support", "sla"],
  custom_integrations: ["custom_integrations", "workday_integration", "adp_integration"],
  onboarding: ["private_onboarding", "security_reviews"],
  // Add-ons (sold separately)
  ai_interviews: ["ai_interviews"],
  recruiting_agent: ["recruiting_agent"],
  sms_whatsapp: ["sms_whatsapp"],
};

function plansAsc(catalog: Catalog): QuotePlan[] {
  return [...catalog.plans].sort((a, b) => a.sort_order - b.sort_order);
}

// Smallest plan tier whose bundled features cover every requested (non-add-on)
// feature. Falls back to the highest tier (Enterprise has everything).
export function minPlanForFeatures(featureKeys: string[], catalog: Catalog): string {
  const addonKeys = new Set(catalog.features.filter((f) => f.is_addon).map((f) => f.feature_key));
  const required = featureKeys.filter((k) => !addonKeys.has(k));
  const sorted = plansAsc(catalog);
  for (const p of sorted) {
    const have = new Set(catalog.planFeatures[p.slug] ?? []);
    if (required.every((k) => have.has(k))) return p.slug;
  }
  return sorted[sorted.length - 1]?.slug ?? "enterprise";
}

const round = (n: number) => Math.round(n);

export function computeQuote(input: QuoteInput, catalog: Catalog): QuoteResult {
  const plan = catalog.plans.find((p) => p.slug === input.planSlug) ?? plansAsc(catalog)[0];
  const featByKey = new Map(catalog.features.map((f) => [f.feature_key, f] as const));

  const planCustom = plan.price_monthly == null;
  const planMonthly = (plan.price_monthly ?? 0) * 100;
  // Yearly base: explicit price_yearly if present, else monthly×12.
  const planYearly = plan.price_yearly != null ? plan.price_yearly * 100 : planMonthly * YEAR;

  // Add-on line items (recurring monthly; yearly = monthly×12).
  const addonLines: QuoteLine[] = input.addons
    .map((a) => {
      const f = featByKey.get(a.feature_key);
      if (!f || !f.is_addon) return null;
      const qty = Math.max(1, a.quantity || 1);
      const m = (f.price_monthly ?? 0) * 100 * qty;
      return { key: f.feature_key, name: f.name, qty, monthlyCents: m, yearlyCents: m * YEAR };
    })
    .filter((x): x is QuoteLine => x != null);

  const extra = Math.max(0, input.extraRecruiters || 0);
  const extraMonthly = extra * EXTRA_RECRUITER_PRICE * 100;
  const extraRecruiterLine: QuoteLine | null = extra > 0
    ? { key: "extra_recruiter", name: "Additional recruiters", qty: extra, monthlyCents: extraMonthly, yearlyCents: extraMonthly * YEAR }
    : null;

  const addonsMonthly = addonLines.reduce((s, l) => s + l.monthlyCents, 0) + extraMonthly;
  const subtotalMonthlyCents = planMonthly + addonsMonthly;
  const subtotalYearlyCents = planYearly + addonsMonthly * YEAR;

  const pct = Math.min(100, Math.max(0, input.discountPct || 0));
  const factor = 1 - pct / 100;

  const override = input.priceOverrideMonthlyCents != null && input.priceOverrideMonthlyCents >= 0;
  let monthlyTotalCents: number;
  let yearlyTotalCents: number;
  if (override) {
    monthlyTotalCents = input.priceOverrideMonthlyCents as number;
    yearlyTotalCents = monthlyTotalCents * YEAR;
  } else {
    monthlyTotalCents = round(subtotalMonthlyCents * factor);
    yearlyTotalCents = round(subtotalYearlyCents * factor);
  }

  // First-year total for the chosen billing period, then founding 50% off.
  const firstYearBase = input.billingPeriod === "yearly" ? yearlyTotalCents : monthlyTotalCents * YEAR;
  const firstYearCents = input.founding ? round(firstYearBase * 0.5) : firstYearBase;

  return {
    plan: { slug: plan.slug, name: plan.name, monthlyCents: planMonthly, yearlyCents: planYearly, custom: planCustom },
    addonLines,
    extraRecruiterLine,
    subtotalMonthlyCents,
    subtotalYearlyCents,
    discountPct: pct,
    founding: input.founding,
    override,
    custom: planCustom && !override,
    monthlyTotalCents,
    yearlyTotalCents,
    firstYearCents,
    yearlySavingsCents: Math.max(0, monthlyTotalCents * YEAR - yearlyTotalCents),
    foundingSavingsCents: input.founding ? firstYearBase - firstYearCents : 0,
  };
}

export function fmtUSD(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
