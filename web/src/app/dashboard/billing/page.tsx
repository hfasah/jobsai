"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2, CheckCircle2, Zap, Crown, Rocket, Mic,
  ArrowRight, ExternalLink, Copy, Check, RefreshCw, Puzzle, Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { cn } from "@/lib/utils";
import type { Plan, PaidPlan, BillingInterval } from "@/lib/billing";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Usage { used: number; limit: number }
interface BillingData {
  plan: Plan;
  subscription_status: string;
  current_period_end: string | null;
  usage: { resumes: Usage; jobs_this_month: Usage };
}
interface TokenPack { id: string; tokens: number; price: string }
interface TokenData { balance: number; monthly_grant: number; plan: Plan; packs: TokenPack[] }

// ─── Plan metadata ──────────────────────────────────────────────────────────────

const PLAN_META: Record<Plan, { label: string; icon: React.ElementType; color: string }> = {
  free:        { label: "Free",               icon: Zap,     color: "text-muted-foreground" },
  pro:         { label: "Pro",                icon: Crown,   color: "text-primary" },
  premium:     { label: "Premium",            icon: Mic,     color: "text-desyn-accent" },
  accelerator: { label: "Career Accelerator", icon: Rocket,  color: "text-desyn-purple" },
};

const PLAN_FEATURES: Record<Plan, string[]> = {
  free: [
    "500 starter tokens",
    "5 written interview sessions",
    "1 voice + 1 avatar trial",
    "ATS scanner & resume tailoring",
  ],
  pro: [
    "5,000 tokens / month",
    "Unlimited AI Written Coach",
    "Auto-apply + resume tools",
    "Voice interviews from tokens",
    "Avatar via token top-up",
  ],
  premium: [
    "20,000 tokens / month",
    "Everything in Pro",
    "AI Voice Interviewer + analysis",
    "AI Avatar Room access",
  ],
  accelerator: [
    "60,000 tokens / month",
    "Everything in Premium",
    "Avatar webcam + body-language",
    "Interview recordings & replay",
    "Human coaching add-on",
  ],
};

const UPGRADE_TIERS: { plan: PaidPlan; icon: React.ElementType; tagline: string; popular?: boolean }[] = [
  { plan: "pro",         icon: Crown,  tagline: "For active job seekers" },
  { plan: "premium",     icon: Mic,    tagline: "Most chosen by interviewees", popular: true },
  { plan: "accelerator", icon: Rocket, tagline: "Maximum realism + coaching" },
];

const PRICES: Record<PaidPlan, { monthly: number; yearly: number }> = {
  pro:         { monthly: 29,  yearly: 23 },
  premium:     { monthly: 79,  yearly: 63 },
  accelerator: { monthly: 199, yearly: 159 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
          <div className={cn("h-full rounded-full transition-all", nearLimit ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  return <Suspense><BillingContent /></Suspense>;
}

function BillingContent() {
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [tokens, setTokens] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState<BillingInterval>("yearly");
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  const [portaling, setPortaling] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const justUpgraded = searchParams.get("success") === "true";
  const toppedUp = searchParams.get("topup") === "true";
  const canceled = searchParams.get("canceled") === "true";

  useEffect(() => {
    Promise.all([
      fetch("/api/billing").then((r) => r.json()),
      fetch("/api/tokens").then((r) => r.json()),
      fetch("/api/user/api-key").then((r) => r.json()),
    ]).then(([b, t, k]) => {
      setBilling(b.data);
      setTokens(t.data);
      setApiKey(k.api_key ?? null);
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
    } finally { setRegenerating(false); }
  };

  const upgrade = async (plan: PaidPlan) => {
    setUpgrading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else { alert(json.error ?? "Checkout failed."); setUpgrading(null); }
    } catch { setUpgrading(null); }
  };

  const buyPack = async (pack: string) => {
    setBuyingPack(pack);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else { alert(json.error ?? "Checkout failed."); setBuyingPack(null); }
    } catch { setBuyingPack(null); }
  };

  const manageSubscription = async () => {
    setPortaling(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
    } finally { setPortaling(false); }
  };

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading billing…
          </div>
        </main>
      </>
    );
  }
  if (!billing) return null;

  const { plan, usage } = billing;
  const meta = PLAN_META[plan];
  const Icon = meta.icon;
  const isPaid = plan !== "free";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">Account</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Billing &amp; Plan</h1>

        {justUpgraded && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-desyn-success/30 bg-desyn-success/10 px-4 py-3 text-sm text-desyn-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Welcome to {meta.label}! Your plan is now active.
          </div>
        )}
        {toppedUp && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-desyn-success/30 bg-desyn-success/10 px-4 py-3 text-sm text-desyn-success">
            <Coins className="h-4 w-4 shrink-0" /> Tokens added to your balance.
          </div>
        )}
        {canceled && (
          <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            Checkout canceled — nothing changed.
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Current plan + token balance */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className={cn("h-5 w-5", meta.color)} />
                  </div>
                  <p className="font-semibold">{meta.label} plan</p>
                </div>
                {isPaid && (
                  <Button variant="outline" size="sm" onClick={manageSubscription} disabled={portaling}>
                    {portaling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-1.5 h-3.5 w-3.5" />}
                    Manage
                  </Button>
                )}
              </div>
              <div className="mt-5 space-y-1.5">
                {PLAN_FEATURES[plan].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-desyn-success" /> {f}
                  </div>
                ))}
              </div>
            </div>

            {/* Token balance */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-desyn-accent" />
                <p className="font-semibold">Token balance</p>
              </div>
              <p className="mt-3 text-4xl font-bold tabular-nums">{tokens?.balance.toLocaleString() ?? "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tokens && tokens.monthly_grant > 0
                  ? `${tokens.monthly_grant.toLocaleString()} refill ${plan === "free" ? "(one-time)" : "/ month"}`
                  : "Tokens power voice & avatar interviews"}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(tokens?.packs ?? []).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => buyPack(p.id)}
                    disabled={buyingPack !== null}
                    className="rounded-lg border border-border p-2 text-center transition-colors hover:border-primary/50 disabled:opacity-50"
                  >
                    {buyingPack === p.id
                      ? <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      : <>
                          <p className="text-sm font-bold tabular-nums">{(p.tokens / 1000)}k</p>
                          <p className="text-xs text-muted-foreground">{p.price}</p>
                        </>}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Top up anytime — never expires.</p>
            </div>
          </section>

          {/* Usage */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 font-semibold">Usage this month</h2>
            <div className="space-y-4">
              <UsageBar label="Resumes" used={usage.resumes.used} limit={usage.resumes.limit === Infinity ? null : usage.resumes.limit} />
              <UsageBar label="Job imports" used={usage.jobs_this_month.used} limit={usage.jobs_this_month.limit === Infinity ? null : usage.jobs_this_month.limit} />
            </div>
          </section>

          {/* Upgrade tiers */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">{isPaid ? "Change plan" : "Upgrade your plan"}</h2>
              {/* interval toggle */}
              <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 text-xs">
                <button onClick={() => setInterval("monthly")}
                  className={cn("rounded-full px-3 py-1 font-medium transition-colors", interval === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  Monthly
                </button>
                <button onClick={() => setInterval("yearly")}
                  className={cn("flex items-center gap-1 rounded-full px-3 py-1 font-medium transition-colors", interval === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  Yearly <span className="rounded-full bg-desyn-success/15 px-1 text-[10px] font-bold text-desyn-success">−20%</span>
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {UPGRADE_TIERS.map(({ plan: tier, icon: TierIcon, tagline, popular }) => {
                const price = PRICES[tier][interval];
                const current = plan === tier;
                return (
                  <div key={tier} className={cn("relative rounded-2xl border bg-card p-5", popular ? "border-primary shadow-glow" : "border-border")}>
                    {popular && (
                      <span className="absolute -top-3 left-4 rounded-full bg-gradient-brand px-3 py-0.5 text-[11px] font-bold text-white shadow-glow">
                        Most Popular
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <TierIcon className={cn("h-5 w-5", PLAN_META[tier].color)} />
                      <p className="font-semibold">{PLAN_META[tier].label}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{tagline}</p>
                    <p className="mt-3 text-3xl font-bold tabular-nums">
                      ${price}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                    {interval === "yearly" && <p className="text-[11px] text-muted-foreground">billed annually</p>}
                    <ul className="mt-4 space-y-1.5">
                      {PLAN_FEATURES[tier].map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-desyn-success" /> {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant={popular ? "default" : "outline"}
                      className="mt-5 w-full"
                      disabled={upgrading !== null || current}
                      onClick={() => (isPaid ? manageSubscription() : upgrade(tier))}
                    >
                      {upgrading === tier ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {current ? "Current plan" : isPaid ? "Switch" : <>Choose {PLAN_META[tier].label} <ArrowRight className="ml-1 h-4 w-4" /></>}
                    </Button>
                  </div>
                );
              })}
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
            {apiKey ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-hidden text-ellipsis rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs">{apiKey}</code>
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
        </div>
      </main>
    </>
  );
}
