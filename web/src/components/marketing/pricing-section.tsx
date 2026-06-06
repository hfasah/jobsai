"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  CheckCircle2, Sparkles, Send, Zap, Rocket, ShieldCheck,
  Building2, Users, BarChart3, Plug, Lock, Headphones, Globe, Layers,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { SectionBadge } from "@/components/ui/section-badge";
import { gradientButtonVariants } from "@/components/ui/gradient-button";
import { cn } from "@/lib/utils";

type Tier = {
  name: string;
  planKey: string;
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
    planKey: "free",
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
    planKey: "pro",
    icon: Send,
    monthly: 29,
    tagline: "Best for students and early-career professionals.",
    cta: "Start Pro",
    features: [
      "Automatic applying, every day",
      "Unlimited jobs, resumes & tailoring",
      "Recruiter outreach + cover letters",
      "90-day interview guarantee",
      "5,000 tokens/mo for interview prep",
    ],
  },
  {
    name: "Premium",
    planKey: "premium",
    icon: Zap,
    monthly: 79,
    tagline: "Best for active mid-to-senior job seekers.",
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
    planKey: "accelerator",
    icon: Rocket,
    monthly: 199,
    tagline: "Best for executive candidates and career changers.",
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

const ENTERPRISE_FEATURES: { icon: React.ElementType; label: string; detail: string }[] = [
  { icon: Users,      label: "Unlimited team seats",         detail: "Recruiters, sourcers & HR, all in one workspace" },
  { icon: Layers,     label: "Bulk candidate screening",     detail: "AI match scores across every applicant, instantly" },
  { icon: Plug,       label: "ATS integrations",             detail: "Greenhouse, Lever, Workday, Ashby & more out of the box" },
  { icon: Globe,      label: "White-label candidate portal", detail: "Your brand, your domain, powered by JobsAI" },
  { icon: BarChart3,  label: "Advanced analytics",           detail: "Pipeline health, time-to-hire, source quality & more" },
  { icon: Lock,       label: "SSO / SAML & audit logs",      detail: "Enterprise security, compliance & access controls" },
  { icon: Headphones, label: "Dedicated account manager",    detail: "Onboarding, custom workflows & priority SLA" },
  { icon: Zap,        label: "Custom AI & API access",       detail: "Fine-tune matching models for your roles & industries" },
];

function EnterpriseCard() {
  return (
    <div className="gradient-border mt-8 overflow-hidden rounded-2xl">
      <div className="relative overflow-hidden rounded-[calc(1rem-1px)] bg-card p-8 lg:p-10">
        {/* mesh glow */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-desyn-purple/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-desyn-brand/10 blur-3xl" />

        <div className="relative flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-16">
          {/* left, feature grid */}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand shadow-glow">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Enterprise</h3>
                <p className="text-xs text-muted-foreground">For recruiters, agencies &amp; HR teams</p>
              </div>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {ENTERPRISE_FEATURES.map(({ icon: Icon, label, detail }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* right, pitch + CTA */}
          <div className="flex w-full shrink-0 flex-col items-start gap-6 rounded-2xl border border-border bg-background/60 p-7 lg:w-80">
            <div>
              <span className="rounded-full bg-desyn-purple/15 px-3 py-1 text-xs font-semibold text-desyn-purple">
                Custom pricing
              </span>
              <p className="mt-3 text-2xl font-bold leading-tight text-foreground">
                Hire smarter.<br />
                <span className="text-gradient">At any scale.</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Replace weeks of manual screening with AI that matches, ranks, and engages candidates before your team even logs in.
              </p>
            </div>

            <ul className="w-full space-y-2 text-sm text-muted-foreground">
              {["Volume pricing per seat", "Custom SLA & onboarding", "Free proof-of-concept"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-desyn-success" />
                  {item}
                </li>
              ))}
            </ul>

            <a
              href="mailto:enterprise@jobsai.co"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow transition-opacity hover:opacity-90"
            >
              Talk to sales
            </a>
            <p className="w-full text-center text-xs text-muted-foreground">
              Usually responds within one business day
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [loading, setLoading] = useState<string | null>(null);
  const { isSignedIn } = useUser();

  const handlePlanClick = useCallback(async (planKey: string, e: React.MouseEvent) => {
    if (!isSignedIn) return; // let the Link navigate to sign-up
    e.preventDefault();
    setLoading(planKey);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey, interval: yearly ? "yearly" : "monthly" }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        // Surface the error then send to billing page so they can retry
        alert(json.error ?? "Checkout failed — please try from the billing page.");
        window.location.href = "/dashboard/billing";
      }
    } catch {
      alert("Could not reach the server. Please try again from the billing page.");
      window.location.href = "/dashboard/billing";
    } finally {
      setLoading(null);
    }
  }, [isSignedIn, yearly]);

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
            directly. Every paid plan is backed by our 90-day interview guarantee.
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
                  href={isSignedIn ? "#" : (t.monthly === 0 ? "/sign-up" : `/sign-up?plan=${t.planKey}`)}
                  onClick={(e) => t.monthly > 0 ? handlePlanClick(t.planKey, e) : undefined}
                  className={cn(
                    "mt-5 w-full",
                    t.highlight
                      ? gradientButtonVariants({ size: "default" })
                      : "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted",
                    loading === t.planKey && "opacity-60 pointer-events-none"
                  )}
                >
                  {loading === t.planKey ? "Redirecting…" : t.cta}
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

        {/* Enterprise */}
        <EnterpriseCard />

        {/* token top-up note */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Need more in a crunch?{" "}
          <span className="font-medium text-foreground">
            Top up tokens anytime, 5k / $9, 20k / $29, 60k / $69.
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
                Land an interview within 90 days or your money back, no questions asked.
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
