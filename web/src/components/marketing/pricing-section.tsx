"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2, Sparkles, Send, Zap, Rocket, ShieldCheck, ArrowRight,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { SectionBadge } from "@/components/ui/section-badge";
import { gradientButtonVariants } from "@/components/ui/gradient-button";
import { cn } from "@/lib/utils";

type Tier = {
  name: string;
  icon: React.ElementType;
  monthly: number;
  tagline: string;
  highlight?: boolean;
  badge?: string;
  features: string[];
  cta: string;
};

const TIERS: Tier[] = [
  {
    name: "Free",
    icon: Sparkles,
    monthly: 0,
    tagline: "Try the tools, no card",
    cta: "Start free",
    features: [
      "10 job imports / month",
      "Resume tailoring & ATS scan",
      "Job discovery & match scores",
      "Unlimited written interview prep",
      "1 voice + 1 avatar prep trial",
    ],
  },
  {
    name: "Pro",
    icon: Send,
    monthly: 29,
    tagline: "Auto-apply on autopilot",
    cta: "Start Pro",
    features: [
      "Automatic applying — every day",
      "Unlimited jobs, resumes & tailoring",
      "Recruiter outreach + cover letters",
      "90-day interview guarantee",
      "5,000 tokens/mo for interview prep",
    ],
  },
  {
    name: "Premium",
    icon: Zap,
    monthly: 79,
    tagline: "More volume, more interviews",
    highlight: true,
    badge: "Most Popular",
    cta: "Start Premium",
    features: [
      "Everything in Pro",
      "Higher daily auto-apply volume",
      "Priority job matching",
      "AI Voice interview prep",
      "20,000 tokens / month",
    ],
  },
  {
    name: "Career Accelerator",
    icon: Rocket,
    monthly: 199,
    tagline: "Maximum volume + coaching",
    cta: "Go all-in",
    features: [
      "Everything in Premium",
      "Highest auto-apply volume",
      "AI Avatar prep + recordings",
      "Body-language & presence analysis",
      "60,000 tokens / month",
    ],
  },
];

function priceFor(monthly: number, yearly: boolean) {
  if (monthly === 0) return { big: "$0", sub: "forever free" };
  if (yearly) {
    const perMo = Math.round(monthly * 0.8); // ~20% off annual
    return { big: `$${perMo}`, sub: "/mo · billed yearly" };
  }
  return { big: `$${monthly}`, sub: "/month" };
}

export function PricingSection() {
  const [yearly, setYearly] = useState(true);

  return (
    <section id="pricing" className="relative overflow-hidden px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <SectionBadge variant="soft">Pricing</SectionBadge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Apply more. <span className="text-gradient">Interview more.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Start free, then upgrade to auto-apply at higher volume and reach recruiters
            directly. Every paid plan is backed by our 90-day interview guarantee —
            interview prep included.
          </p>

          {/* billing toggle */}
          <div className="mt-7 inline-flex items-center gap-3 rounded-full border border-border bg-card p-1 text-sm">
            <button
              onClick={() => setYearly(false)}
              className={cn(
                "rounded-full px-4 py-1.5 font-medium transition-colors",
                !yearly ? "bg-gradient-brand text-white shadow-glow" : "text-muted-foreground"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 font-medium transition-colors",
                yearly ? "bg-gradient-brand text-white shadow-glow" : "text-muted-foreground"
              )}
            >
              Yearly
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                yearly ? "bg-white/20 text-white" : "bg-desyn-success/15 text-desyn-success"
              )}>
                −20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-4">
          {TIERS.map((t) => {
            const Icon = t.icon;
            const price = priceFor(t.monthly, yearly);
            return (
              <GlassCard
                key={t.name}
                gradientBorder={t.highlight}
                className={cn(
                  "relative flex flex-col p-6",
                  t.highlight ? "shadow-glow lg:-mt-3 lg:mb-3" : "hover-lift"
                )}
              >
                {t.badge && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gradient-brand px-3 py-1 text-[11px] font-bold text-white shadow-glow">
                    {t.badge}
                  </span>
                )}
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-foreground">{t.name}</h3>
                <p className="text-xs text-muted-foreground">{t.tagline}</p>

                <div className="mt-4 flex items-end gap-1">
                  <span className="text-4xl font-bold tracking-tight text-foreground">
                    {price.big}
                  </span>
                  <span className="mb-1 text-xs text-muted-foreground">{price.sub}</span>
                </div>

                <Link
                  href="/sign-up"
                  className={cn(
                    "mt-5 w-full",
                    t.highlight
                      ? gradientButtonVariants({ size: "default" })
                      : "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                  )}
                >
                  {t.cta}
                  {t.highlight && <ArrowRight className="h-4 w-4" />}
                </Link>

                <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-desyn-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            );
          })}
        </div>

        {/* token top-up note */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Need more in a crunch?{" "}
          <span className="font-medium text-foreground">
            Top up tokens anytime — 5k / $9, 20k / $29, 60k / $69.
          </span>
        </p>

        {/* money-back guarantee */}
        <GlassCard className="mt-8 flex flex-col items-center justify-between gap-4 p-6 sm:flex-row">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-desyn-success/15">
              <ShieldCheck className="h-6 w-6 text-desyn-success" />
            </div>
            <div>
              <p className="font-bold text-foreground">90-day interview guarantee</p>
              <p className="text-sm text-muted-foreground">
                Land an interview within 90 days or your money back — no questions asked.
              </p>
            </div>
          </div>
          <Link href="/sign-up" className={gradientButtonVariants({ size: "default" })}>
            Start risk-free
          </Link>
        </GlassCard>
      </div>
    </section>
  );
}
