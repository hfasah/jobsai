"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { Check, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const TIERS = [
  {
    key: "pro",
    name: "Pro",
    monthly: 39,
    credits: "9,000 credits/mo",
    bullets: ["20 auto-applies per day", "Resume tailoring & cover letters", "Voice interview practice", "1 free coaching session/mo"],
    featured: false,
  },
  {
    key: "premium",
    name: "Premium",
    monthly: 79,
    credits: "18,000 credits/mo",
    bullets: ["100 auto-applies per day", "Everything in Pro", "AI avatar interview practice", "Priority support"],
    featured: true,
  },
  {
    key: "accelerator",
    name: "Career Accelerator",
    monthly: 199,
    credits: "45,000 credits/mo",
    bullets: ["250 auto-applies per day", "Everything in Premium", "Most interview practice minutes", "Fastest path to offers"],
    featured: false,
  },
] as const;

export function StartTrialClient({ trialEligible }: { trialEligible: boolean }) {
  const { signOut } = useClerk();
  const [yearly, setYearly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async (plan: string) => {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval: yearly ? "yearly" : "monthly", trial: trialEligible }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) { setError(json.error ?? "Could not start checkout."); setBusy(null); return; }
      window.location.href = json.url;
    } catch {
      setError("Something went wrong — try again.");
      setBusy(null);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
      <div className="w-full max-w-4xl text-center">
        {trialEligible ? (
          <>
            <h1 className="text-3xl font-bold sm:text-4xl">Try everything free for 7 days</h1>
            <p className="mx-auto mt-2 text-lg font-bold text-emerald-500 sm:text-xl">
              $0 today — your card will <span className="underline decoration-2 underline-offset-2">not</span> be charged
            </p>
            {/* The reassurances ARE the message — big, bold, colored, impossible
                to miss. Nobody reads fine print under a price grid. */}
            <div className="mx-auto mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-2 sm:gap-3">
              {[
                { icon: <Sparkles className="h-4 w-4" />, text: "500 FREE credits" },
                { icon: <ShieldCheck className="h-4 w-4" />, text: "No charge for 7 days" },
                { icon: <Check className="h-4 w-4" />, text: "Cancel anytime — 1 click" },
              ].map(({ icon, text }) => (
                <span key={text} className="inline-flex items-center gap-1.5 rounded-full border-2 border-emerald-500/50 bg-emerald-500/10 px-4 py-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {icon} {text}
                </span>
              ))}
            </div>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground">
              Pick the plan to try — a card is needed to start, but nothing is charged today. Cancel before day 7 and
              you pay nothing at all; otherwise your plan starts automatically.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold sm:text-4xl">Choose a plan to continue</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Your account doesn&apos;t have an active subscription (free trials are one per customer). Pick a plan to
              get back to your job search — you can cancel anytime.
            </p>
          </>
        )}

        {/* Billing interval */}
        <div className="mt-6 inline-flex items-center rounded-full border border-border bg-card p-1 text-xs font-semibold">
          <button onClick={() => setYearly(false)} className={cn("rounded-full px-4 py-1.5", !yearly ? "bg-primary text-white" : "text-muted-foreground")}>Monthly</button>
          <button onClick={() => setYearly(true)} className={cn("rounded-full px-4 py-1.5", yearly ? "bg-primary text-white" : "text-muted-foreground")}>Yearly · save 20%</button>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {TIERS.map((t) => {
            const perMo = yearly ? Math.round(t.monthly * 0.8) : t.monthly;
            return (
              <div key={t.key} className={cn("flex flex-col rounded-2xl border bg-card p-5 text-left", t.featured ? "border-primary shadow-lg" : "border-border")}>
                {t.featured && <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-primary">Most popular</p>}
                <h2 className="text-lg font-semibold">{t.name}</h2>
                <p className="mt-1 text-3xl font-bold">${perMo}<span className="text-sm font-normal text-muted-foreground">/mo{yearly ? " · billed yearly" : ""}</span></p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">{t.credits}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {t.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {b}</li>
                  ))}
                </ul>
                <button
                  onClick={() => startCheckout(t.key)}
                  disabled={busy !== null}
                  className={cn("mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60", t.featured ? "btn-cta" : "border border-border bg-background hover:bg-accent")}
                >
                  {busy === t.key ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {trialEligible ? "Start 7-day free trial" : `Continue with ${t.name}`}
                </button>
                {trialEligible && (
                  <p className="mt-2 text-center text-xs font-bold text-emerald-500">$0 due today · 500 free credits</p>
                )}
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-6 flex max-w-xl items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          {trialEligible
            ? "No charge until your trial ends. Cancel in one click from Billing. Card details are handled by Stripe — we never see them."
            : "Secure checkout by Stripe. Cancel anytime — you keep access until the end of the period you paid for."}
        </p>

        <button onClick={() => signOut({ redirectUrl: "/" })} className="mt-8 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Not now — sign out
        </button>
      </div>
    </main>
  );
}
