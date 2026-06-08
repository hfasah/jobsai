"use client";

import { useState } from "react";
import Link from "next/link";
import { X, CheckCircle2, Loader2, Crown, Mic, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaidPlan } from "@/lib/billing";

interface PlanCard {
  plan: PaidPlan;
  label: string;
  tagline: string;
  price: number; // USD monthly
  popular?: boolean;
  icon: React.ElementType;
  features: string[];
}

const PLANS: PlanCard[] = [
  {
    plan: "pro", label: "Pro", tagline: "For active job seekers", price: 39, icon: Crown,
    features: ["5,000 tokens / month", "Auto-apply up to 20 jobs/day", "Unlimited AI Written Coach", "Unlimited résumés & job imports"],
  },
  {
    plan: "premium", label: "Premium", tagline: "Most chosen by interviewees", price: 79, popular: true, icon: Mic,
    features: ["20,000 tokens / month", "Auto-apply up to 80 jobs/day", "AI Voice Interviewer + analysis", "AI Avatar Room access"],
  },
  {
    plan: "accelerator", label: "Career Accelerator", tagline: "Maximum realism + coaching", price: 199, icon: Rocket,
    features: ["60,000 tokens / month", "Auto-apply up to 240 jobs/day", "1 free coaching session/mo", "Interview recordings & replay"],
  },
];

// Friendly upgrade screen shown when a free user hits a paid-only limit.
export function UpgradePlansModal({ reason, onClose }: { reason?: string; onClose: () => void }) {
  const [loading, setLoading] = useState<PaidPlan | null>(null);

  async function choose(plan: PaidPlan) {
    setLoading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval: "monthly" }),
      });
      const json = await res.json();
      if (json.url) { window.location.assign(json.url); return; }
      setLoading(null);
    } catch {
      setLoading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Upgrade your plan"
        onClick={(e) => e.stopPropagation()}
        className="relative my-8 w-full max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8"
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X className="h-5 w-5" />
        </button>

        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight">Upgrade to keep going</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {reason ?? "You've hit a limit on the Free plan. Upgrade to unlock the full toolkit."}
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {PLANS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.plan} className={cn("relative flex flex-col rounded-2xl border bg-background/40 p-5", p.popular ? "border-primary shadow-glow" : "border-border")}>
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-brand px-3 py-0.5 text-[11px] font-bold text-white shadow-glow">
                    Most Popular
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <p className="font-semibold">{p.label}</p>
                </div>
                <p className="text-xs text-muted-foreground">{p.tagline}</p>
                <p className="mt-3 text-3xl font-bold tabular-nums">
                  ${p.price}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <ul className="mt-4 flex-1 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-desyn-success" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => choose(p.plan)}
                  disabled={loading !== null}
                  className={cn(
                    "mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-70",
                    p.popular ? "btn-cta" : "border border-border bg-background hover:bg-muted"
                  )}
                >
                  {loading === p.plan ? <Loader2 className="h-4 w-4 animate-spin" /> : `Choose ${p.label}`}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-center gap-4 text-sm">
          <Link href="/dashboard/billing" className="text-primary hover:underline">Compare all plans & currencies</Link>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">Maybe later</button>
        </div>
      </div>
    </div>
  );
}
