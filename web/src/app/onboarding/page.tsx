"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Star, Sparkles, Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

type PlanKey = "pro" | "premium" | "accelerator";

const PLANS: {
  key: PlanKey;
  name: string;
  tagline: string;
  monthly: number;
  yearly: number; // per-month billed yearly
  tokens: string;
  popular?: boolean;
  features: string[];
}[] = [
  {
    key: "pro",
    name: "Pro",
    tagline: "Land interviews on autopilot",
    monthly: 39,
    yearly: 31,
    tokens: "9,000 credits / mo (~15 auto-applies)",
    features: [
      "AI Auto-Apply: uses credits (~600 per job)",
      "Unlimited resumes & job matches",
      "Unlimited ATS scans, tailoring & cover letters",
      "Written AI interview coach",
      "Application tracker & analytics",
    ],
  },
  {
    key: "premium",
    name: "Premium",
    tagline: "Practice out loud",
    monthly: 79,
    yearly: 63,
    tokens: "18,000 credits / mo (~30 auto-applies)",
    popular: true,
    features: [
      "Everything in Pro",
      "AI Voice interviewer: spoken mock interviews",
      "Real-time pacing & filler-word analysis",
      "Priority job matching",
      "Inbox Apply: email recruiters directly",
    ],
  },
  {
    key: "accelerator",
    name: "Career Accelerator",
    tagline: "Face-to-face realism",
    monthly: 199,
    yearly: 159,
    tokens: "45,000 credits / mo (~75 auto-applies)",
    features: [
      "Everything in Premium",
      "AI Avatar room: face-to-face video interview",
      "Webcam body-language & eye-contact analysis",
      "Session recordings + replay",
      "Highest token allowance",
    ],
  },
];

const OFFER_WINDOW_MS = 15 * 60 * 1000; // 15-minute welcome window

function useCountdown() {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const KEY = "jobsai_welcome_offer_deadline";
    let deadline = Number(localStorage.getItem(KEY));
    if (!deadline || deadline < Date.now()) {
      deadline = Date.now() + OFFER_WINDOW_MS;
      localStorage.setItem(KEY, String(deadline));
    }
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (remaining === null) return null;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [interval, setIntervalState] = useState<"monthly" | "yearly">("yearly");
  const [loading, setLoading] = useState<PlanKey | null>(null);
  const countdown = useCountdown();

  const choosePlan = async (plan: PlanKey) => {
    setLoading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // trial:true → 7-day free trial with card collected (one per customer;
        // the API silently drops the trial for ineligible repeat customers).
        body: JSON.stringify({ plan, interval, trial: true }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.assign(json.url);
      } else {
        alert(json.error ?? "Could not start checkout.");
        setLoading(null);
      }
    } catch {
      alert("Network error. Please try again.");
      setLoading(null);
    }
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="bg-mesh">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          {/* Trust + urgency */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold">Loved by job seekers</span>
              <span className="flex">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-[var(--cta)] text-[var(--cta)]" />
                ))}
              </span>
              <span className="text-muted-foreground">4.8/5 from early users</span>
            </div>

            {countdown && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--cta)]/40 bg-[var(--cta)]/10 px-4 py-1.5 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-[var(--cta)]" />
                Welcome offer — 20% off your first year ·
                <span className="tabular-nums text-[var(--cta)]">{countdown}</span>
              </div>
            )}

            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Try everything free for 7 days.
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Pick a plan to start your free trial — 500 credits included, no charge until day 7,
              cancel anytime. We auto-apply to jobs and land you interviews — guaranteed — then
              prep you to win them with written, voice, and avatar rounds.
            </p>

            {/* Billing toggle */}
            <div className="mt-6 inline-flex items-center rounded-full border border-border bg-card p-1">
              <button
                onClick={() => setIntervalState("monthly")}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  interval === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setIntervalState("yearly")}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  interval === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                Yearly <span className="text-[var(--cta)]">−20%</span>
              </button>
            </div>
          </div>

          {/* Plan cards */}
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {PLANS.map((p) => {
              const price = interval === "yearly" ? p.yearly : p.monthly;
              return (
                <div
                  key={p.key}
                  className={cn(
                    "relative flex flex-col rounded-2xl border bg-card p-6 transition-all",
                    p.popular
                      ? "border-[var(--cta)] shadow-glow"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  {p.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--cta)] px-3 py-0.5 text-xs font-bold text-[var(--cta-foreground)]">
                      MOST POPULAR
                    </span>
                  )}
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  <p className="text-sm text-muted-foreground">{p.tagline}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-[var(--cta)]">${price}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  {interval === "yearly" && (
                    <p className="mt-0.5 text-xs text-muted-foreground">billed yearly</p>
                  )}
                  <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium">
                    <Sparkles className="h-3.5 w-3.5 text-desyn-accent" />
                    {p.tokens}
                  </span>

                  <ul className="mt-5 space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-desyn-success" />
                        <span className="text-foreground/90">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => choosePlan(p.key)}
                    disabled={loading !== null}
                    className={cn(
                      "mt-6 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-60",
                      p.popular
                        ? "btn-cta"
                        : "bg-primary text-primary-foreground hover:brightness-105"
                    )}
                  >
                    {loading === p.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>Try {p.name} free for 7 days<ArrowRight className="h-4 w-4" /></>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Trial trust microcopy — card-required model: every plan starts
              with a 7-day free trial; there is no card-free path. */}
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <button
              onClick={() => router.push("/start-trial")}
              className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
            >
              Compare all plans →
            </button>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-desyn-success" />
              7-day free trial on every plan · No charge until day 7 · Cancel anytime · 90-day money-back guarantee on paid plans
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
