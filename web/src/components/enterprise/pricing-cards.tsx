"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";
import { PLANS, fmt, monthlyEquiv, annualTotal } from "@/lib/enterprise-plans";

const TRUST = ["14-day Free Trial", "Cancel Anytime", "No Setup Fees", "Secure Stripe Billing", "SOC 2 Ready"];

export function EnterprisePricingCards() {
  const [annual, setAnnual] = useState(true);

  return (
    <div>
      {/* One-line reassurance: start small, grow into the ladder. */}
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Start with the plan that fits your hiring team today. Upgrade anytime as your recruiting needs grow.
      </p>

      {/* Billing toggle */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="inline-flex items-center rounded-full border border-border bg-card p-1 text-sm">
          <button
            onClick={() => setAnnual(false)}
            className={`rounded-full px-4 py-1.5 font-medium transition-colors ${!annual ? "bg-gradient-brand text-white shadow-glow" : "text-muted-foreground hover:text-foreground"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium transition-colors ${annual ? "bg-gradient-brand text-white shadow-glow" : "text-muted-foreground hover:text-foreground"}`}
          >
            Annual
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${annual ? "bg-white/20" : "bg-emerald-500/15 text-emerald-500"}`}>Save 20% · 2 months free</span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid gap-6 lg:grid-cols-4">
        {PLANS.map((p) => (
          <div key={p.name} className={`relative flex flex-col rounded-2xl border bg-card p-6 ${p.popular ? "border-primary shadow-glow" : "border-border"}`}>
            {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand px-3 py-0.5 text-[11px] font-semibold text-white">⭐ Most Popular</span>}
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{p.journey}</p>
            <h2 className="mt-1 text-lg font-bold">{p.name}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{p.sub}</p>

            {/* Price — the hero of the card */}
            <div className="mt-5 min-h-[92px]">
              {p.monthly == null ? (
                <>
                  <span className="text-4xl font-bold tracking-tight">Let&apos;s Talk</span>
                  <p className="mt-1.5 text-xs text-muted-foreground">Custom pricing · annual &amp; multi-year contracts</p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold tracking-tight">{fmt(annual ? monthlyEquiv(p.monthly) : p.monthly)}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {annual ? <>Billed annually ({fmt(annualTotal(p.monthly))}/yr) · <span className="font-semibold text-emerald-500">2 months free</span></> : "Billed monthly"}
                  </p>
                </>
              )}
            </div>

            <ul className="mt-5 flex-1 space-y-2">
              {p.highlights.map((h) => <li key={h} className="flex items-start gap-2 text-sm text-muted-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{h}</li>)}
            </ul>

            {p.href.startsWith("http")
              ? <a href={p.href} target="_blank" rel="noreferrer" className="mt-5 flex items-center justify-center rounded-xl border border-border bg-card py-2.5 text-sm font-semibold hover:bg-muted">{p.cta}</a>
              : <Link href={p.href} className={`mt-5 flex items-center justify-center rounded-xl py-2.5 text-sm font-semibold ${p.popular ? "bg-gradient-brand text-white shadow-glow" : "border border-border bg-card hover:bg-muted"}`}>{p.cta}</Link>}
          </div>
        ))}
      </div>

      {/* Trust row — removes the last bit of friction */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {TRUST.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> {t}
          </span>
        ))}
      </div>
    </div>
  );
}
