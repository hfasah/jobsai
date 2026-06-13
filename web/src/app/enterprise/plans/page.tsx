import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, Check } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyMembership, orgHasAccess } from "@/lib/enterprise";
import { getOrgEntitlements } from "@/lib/enterprise-entitlements";
import { ChoosePlan } from "./choose-plan";
import { PlanComparison } from "@/components/enterprise/plan-comparison";

export const dynamic = "force-dynamic";

// Short, marketing-friendly highlights per plan (the full matrix lives in the DB).
const HIGHLIGHTS: Record<string, string[]> = {
  professional: ["ATS, candidate database & career pages", "AI scoring, top picks & comparison", "Scheduling, offers & e-signature", "3 recruiters · 10 jobs · 5,000 candidates"],
  agency: ["Everything in Professional", "Recruiting CRM, talent pools & outreach", "AI sourcing + client portal & reporting", "White label · 10 recruiters · 50 jobs"],
  business: ["Everything in Agency", "SAML/SSO, workflow automation", "Executive analytics & compliance suite", "25 recruiters · unlimited jobs & candidates"],
  enterprise: ["Everything in Business", "Dedicated support + SLA", "Workday / ADP & custom integrations", "Private onboarding & security reviews"],
};

const SUBTITLE: Record<string, string> = {
  professional: "For growing recruiting teams.",
  agency: "For staffing agencies and recruiting firms.",
  business: "For corporate HR and Talent Acquisition teams.",
  enterprise: "For large organizations.",
};

export default async function EnterprisePlansPage() {
  const { data } = await supabaseAdmin
    .from("plans")
    .select("slug,name,price_monthly,sort_order")
    .eq("active", true)
    .order("sort_order");
  const plans = (data ?? []) as { slug: string; name: string; price_monthly: number | null }[];

  // Back link: existing active members came from Billing → back to dashboard;
  // everyone else (onboarding) → back to the marketing home.
  const { userId } = await auth();
  let backHref = "/enterprise/home";
  let backLabel = "Back to home";
  if (userId) {
    const member = await getMyMembership(userId);
    if (member) {
      const ent = await getOrgEntitlements(member.org_id);
      if (orgHasAccess(ent.accessStatus)) { backHref = "/enterprise/dashboard"; backLabel = "Back to dashboard"; }
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <Link href={backHref} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Choose your plan</h1>
        <p className="mt-2 text-muted-foreground">14-day free trial. Cancel anytime.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {plans.map((p) => {
          const popular = p.slug === "agency";
          const isEnterprise = p.price_monthly == null;
          return (
            <div
              key={p.slug}
              className={
                "relative flex flex-col rounded-2xl border bg-card p-6 " +
                (popular ? "border-primary shadow-glow" : "border-border")
              }
            >
              {popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand px-3 py-0.5 text-[11px] font-semibold text-white">
                  ⭐ Most Popular
                </span>
              )}
              <h2 className="text-lg font-bold">{p.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{SUBTITLE[p.slug] ?? ""}</p>
              <div className="mt-4">
                {isEnterprise ? (
                  <span className="text-2xl font-bold">Custom</span>
                ) : (
                  <>
                    <span className="text-3xl font-bold">${p.price_monthly}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </>
                )}
              </div>

              <ul className="mt-5 flex-1 space-y-2">
                {(HIGHLIGHTS[p.slug] ?? []).map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {h}
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isEnterprise ? (
                  <a
                    href="mailto:sales@jobsai.work?subject=JobsAI%20Enterprise%20demo"
                    className="flex w-full items-center justify-center rounded-xl border border-border bg-card py-2.5 text-sm font-semibold hover:bg-muted"
                  >
                    Book a demo
                  </a>
                ) : (
                  <ChoosePlan slug={p.slug} popular={popular} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-14">
        <h2 className="mb-6 text-center text-2xl font-bold">Compare every plan</h2>
        <PlanComparison />
      </div>
    </main>
  );
}
