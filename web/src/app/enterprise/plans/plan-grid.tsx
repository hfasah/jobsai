"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { ChoosePlan } from "./choose-plan";

type Plan = { slug: string; name: string; price_monthly: number | null; price_yearly: number | null };

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

const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;
const monthlyEquiv = (m: number) => Math.round(m * 0.8);

export function PlanGrid({ plans }: { plans: Plan[] }) {
  const [annual, setAnnual] = useState(true);

  return (
    <div>
      {/* Billing toggle */}
      <div className="mb-8 flex justify-center">
        <div className="inline-flex items-center rounded-full border border-border bg-card p-1 text-sm">
          <button onClick={() => setAnnual(false)}
            className={`rounded-full px-4 py-1.5 font-medium transition-colors ${!annual ? "bg-gradient-brand text-white shadow-glow" : "text-muted-foreground hover:text-foreground"}`}>
            Monthly
          </button>
          <button onClick={() => setAnnual(true)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium transition-colors ${annual ? "bg-gradient-brand text-white shadow-glow" : "text-muted-foreground hover:text-foreground"}`}>
            Annual
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${annual ? "bg-white/20" : "bg-emerald-500/15 text-emerald-500"}`}>Save 20%</span>
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {plans.map((p) => {
          const popular = p.slug === "agency";
          const isEnterprise = p.price_monthly == null;
          const m = p.price_monthly ?? 0;
          const yr = p.price_yearly ?? monthlyEquiv(m) * 12;
          const save = m * 12 - yr;
          return (
            <div key={p.slug} className={"relative flex flex-col rounded-2xl border bg-card p-6 " + (popular ? "border-primary shadow-glow" : "border-border")}>
              {popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand px-3 py-0.5 text-[11px] font-semibold text-white">⭐ Most Popular</span>}
              <h2 className="text-lg font-bold">{p.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{SUBTITLE[p.slug] ?? ""}</p>

              <div className="mt-4 min-h-[84px]">
                {isEnterprise ? (
                  <span className="text-2xl font-bold">Custom</span>
                ) : annual ? (
                  <>
                    <div><span className="text-3xl font-bold">{fmt(monthlyEquiv(m))}</span><span className="text-sm text-muted-foreground">/month</span></div>
                    <p className="mt-1 text-xs text-muted-foreground">billed annually · {fmt(yr)}/year</p>
                    <p className="mt-1 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">Save {fmt(save)}/year</p>
                  </>
                ) : (
                  <>
                    <div><span className="text-3xl font-bold">{fmt(m)}</span><span className="text-sm text-muted-foreground">/month</span></div>
                    <p className="mt-1 text-xs text-muted-foreground">billed monthly</p>
                  </>
                )}
              </div>

              <ul className="mt-5 flex-1 space-y-2">
                {(HIGHLIGHTS[p.slug] ?? []).map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-muted-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{h}</li>
                ))}
              </ul>

              <div className="mt-6">
                {isEnterprise ? (
                  <a href="mailto:sales@jobsai.work?subject=JobsAI%20Enterprise%20demo" className="flex w-full items-center justify-center rounded-xl border border-border bg-card py-2.5 text-sm font-semibold hover:bg-muted">
                    Book a demo
                  </a>
                ) : (
                  <ChoosePlan slug={p.slug} popular={popular} interval={annual ? "year" : "month"} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
