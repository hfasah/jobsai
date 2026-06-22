"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS, fmt, monthlyEquiv, annualTotal, yearlySavings } from "@/lib/enterprise-plans";

export function EnterprisePricingCards() {
  const [annual, setAnnual] = useState(true);

  return (
    <div>
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
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${annual ? "bg-white/20" : "bg-emerald-500/15 text-emerald-500"}`}>Save 20%</span>
          </button>
        </div>
        {annual && <p className="text-xs text-muted-foreground">Billed annually · two months free vs. monthly</p>}
      </div>

      {/* Plan cards */}
      <div className="grid gap-6 lg:grid-cols-4">
        {PLANS.map((p) => (
          <div key={p.name} className={`relative flex flex-col rounded-2xl border bg-card p-6 ${p.popular ? "border-primary shadow-glow" : "border-border"}`}>
            {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand px-3 py-0.5 text-[11px] font-semibold text-white">⭐ Most Popular</span>}
            <h2 className="text-lg font-bold">{p.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{p.sub}</p>

            {/* Price */}
            <div className="mt-4 min-h-[88px]">
              {p.monthly == null ? (
                <>
                  <span className="text-3xl font-bold">Custom</span>
                  {annual && <p className="mt-1 text-xs text-muted-foreground">Annual & multi-year contracts available</p>}
                </>
              ) : annual ? (
                <>
                  <div>
                    <span className="text-3xl font-bold">{fmt(monthlyEquiv(p.monthly))}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    billed annually · {fmt(annualTotal(p.monthly))}/year
                  </p>
                  <p className="mt-1 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">
                    Save {fmt(yearlySavings(p.monthly))}/year
                  </p>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-3xl font-bold">{fmt(p.monthly)}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">billed monthly</p>
                </>
              )}
            </div>

            <ul className="mt-5 flex-1 space-y-2">
              {p.highlights.map((h) => <li key={h} className="flex items-start gap-2 text-sm text-muted-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{h}</li>)}
            </ul>
            <p className="mt-4 text-xs font-medium text-muted-foreground">{p.limits}</p>
            {p.href.startsWith("http")
              ? <a href={p.href} target="_blank" rel="noreferrer" className="mt-5 flex items-center justify-center rounded-xl border border-border bg-card py-2.5 text-sm font-semibold hover:bg-muted">{p.cta}</a>
              : <Link href={p.href} className={`mt-5 flex items-center justify-center rounded-xl py-2.5 text-sm font-semibold ${p.popular ? "bg-gradient-brand text-white shadow-glow" : "border border-border bg-card hover:bg-muted"}`}>{p.cta}</Link>}
          </div>
        ))}
      </div>
    </div>
  );
}
