"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, Zap, Crown, Building2, ArrowRight, ExternalLink, Copy, Check, RefreshCw, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/billing";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Usage {
  used: number;
  limit: number; // Infinity serialised as null from server
}

interface BillingData {
  plan: Plan;
  subscription_status: string;
  current_period_end: string | null;
  usage: {
    resumes: Usage;
    jobs_this_month: Usage;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLAN_META: Record<Plan, { label: string; icon: React.ElementType; color: string }> = {
  free:     { label: "Free",     icon: Zap,       color: "text-muted-foreground" },
  pro:      { label: "Pro",      icon: Crown,     color: "text-primary" },
  business: { label: "Business", icon: Building2, color: "text-desyn-accent" },
};

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const isUnlimited = limit === null || !isFinite(limit);
  const pct = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const nearLimit = !isUnlimited && pct >= 80;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn("text-xs", nearLimit ? "text-amber-600 font-medium" : "text-muted-foreground")}>
          {isUnlimited ? `${used} (unlimited)` : `${used} / ${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", nearLimit ? "bg-amber-500" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

const PLAN_FEATURES: Record<Plan, string[]> = {
  free: [
    "1 resume upload",
    "10 job imports / month",
    "ATS scanner",
    "Resume tailoring",
    "Cover letter generator",
    "Mock interview (5 questions)",
  ],
  pro: [
    "Unlimited resumes",
    "Unlimited job imports",
    "Auto-apply (Lever & Ashby)",
    "Daily job discovery",
    "Email notifications",
    "LinkedIn import",
    "Mock interview (unlimited)",
  ],
  business: [
    "Everything in Pro",
    "Browser-based form filling",
    "Greenhouse & Workday support",
    "Unlimited auto-applications",
    "Priority support",
  ],
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<"pro" | "business" | null>(null);
  const [portaling, setPortaling] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const justUpgraded = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  useEffect(() => {
    Promise.all([
      fetch("/api/billing").then((r) => r.json()),
      fetch("/api/user/api-key").then((r) => r.json()),
    ]).then(([billingJson, keyJson]) => {
      setBilling(billingJson.data);
      setApiKey(keyJson.api_key ?? null);
    }).finally(() => setLoading(false));
  }, []);

  const copyApiKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
  };

  const regenerateKey = async () => {
    setRegenerating(true);
    try {
      const res = await fetch("/api/user/api-key", { method: "POST" });
      const json = await res.json();
      setApiKey(json.api_key);
    } finally {
      setRegenerating(false);
    }
  };

  const upgrade = async (plan: "pro" | "business") => {
    setUpgrading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
    } finally {
      setUpgrading(null);
    }
  };

  const manageSubscription = async () => {
    setPortaling(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
    } finally {
      setPortaling(false);
    }
  };

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading billing…
          </div>
        </main>
      </>
    );
  }

  if (!billing) return null;

  const { plan, usage, current_period_end } = billing;
  const meta = PLAN_META[plan];
  const Icon = meta.icon;
  const isPaid = plan !== "free";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">Account</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Billing &amp; Plan</h1>

        {justUpgraded && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-desyn-success/30 bg-desyn-success/10 px-4 py-3 text-sm text-desyn-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Welcome to {meta.label}! Your plan is now active.
          </div>
        )}
        {canceled && (
          <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            Checkout canceled — your plan has not changed.
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Current plan card */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className={cn("h-5 w-5", meta.color)} />
                </div>
                <div>
                  <p className="font-semibold">{meta.label} plan</p>
                  {isPaid && current_period_end && (
                    <p className="text-xs text-muted-foreground">
                      Renews {new Date(current_period_end).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              {isPaid && (
                <Button variant="outline" size="sm" onClick={manageSubscription} disabled={portaling}>
                  {portaling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-1.5 h-3.5 w-3.5" />}
                  Manage subscription
                </Button>
              )}
            </div>

            <div className="mt-5 space-y-1.5">
              {PLAN_FEATURES[plan].map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-desyn-success" />
                  {f}
                </div>
              ))}
            </div>
          </section>

          {/* Usage */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 font-semibold">Usage this month</h2>
            <div className="space-y-4">
              <UsageBar
                label="Resumes"
                used={usage.resumes.used}
                limit={usage.resumes.limit === Infinity ? null : usage.resumes.limit}
              />
              <UsageBar
                label="Job imports"
                used={usage.jobs_this_month.used}
                limit={usage.jobs_this_month.limit === Infinity ? null : usage.jobs_this_month.limit}
              />
            </div>
          </section>

          {/* Chrome Extension API key */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Puzzle className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Chrome Extension</h2>
                <p className="text-xs text-muted-foreground">Import jobs from any site with one click</p>
              </div>
            </div>

            <p className="mb-3 text-sm text-muted-foreground">
              Copy your personal API key and paste it into the extension settings. Never share this key.
            </p>

            {apiKey ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-hidden text-ellipsis rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs">
                  {apiKey}
                </code>
                <Button variant="outline" size="sm" onClick={copyApiKey} className="shrink-0">
                  {apiKeyCopied ? <Check className="h-3.5 w-3.5 text-desyn-success" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="outline" size="sm" onClick={regenerateKey} disabled={regenerating} className="shrink-0">
                  {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading key…
              </div>
            )}
          </section>

          {/* Upgrade section — only for free users */}
          {!isPaid && (
            <section>
              <h2 className="mb-4 font-semibold">Upgrade your plan</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Pro */}
                <div className="relative rounded-2xl border-2 border-primary bg-card p-5">
                  <span className="absolute -top-3 left-4 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                    Most popular
                  </span>
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    <p className="font-semibold">Pro</p>
                  </div>
                  <p className="mt-1 text-2xl font-bold">$19<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                  <ul className="mt-4 space-y-1.5">
                    {PLAN_FEATURES.pro.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-desyn-success" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-5 w-full"
                    onClick={() => upgrade("pro")}
                    disabled={upgrading !== null}
                  >
                    {upgrading === "pro" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Upgrade to Pro <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>

                {/* Business */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-desyn-accent" />
                    <p className="font-semibold">Business</p>
                  </div>
                  <p className="mt-1 text-2xl font-bold">$49<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                  <ul className="mt-4 space-y-1.5">
                    {PLAN_FEATURES.business.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-desyn-success" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="outline"
                    className="mt-5 w-full"
                    onClick={() => upgrade("business")}
                    disabled={upgrading !== null}
                  >
                    {upgrading === "business" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Upgrade to Business
                  </Button>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
