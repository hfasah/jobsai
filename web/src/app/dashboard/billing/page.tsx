"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Loader2, CheckCircle2, Zap, Crown, Rocket, Mic,
  ArrowRight, ExternalLink, Copy, Check, RefreshCw, Puzzle, Coins, X, Building2, UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
    "500 credits / month",
    "Spend credits on any tool — tailoring, ATS scans, cover letters, interview prep",
    "Top up anytime to auto-apply or do more",
    "Job discovery & match scores",
  ],
  pro: [
    "9,000 credits / month (~15 auto-applies)",
    "Auto Apply — uses credits (~600 per job)",
    "Unused credits roll over up to 2 months",
    "Unlimited AI Written Coach",
    "Voice interviews (uses credits)",
    "Daily fair-use cap: 20 applies",
  ],
  premium: [
    "18,000 credits / month (~30 auto-applies)",
    "Everything in Pro",
    "Auto Apply — uses credits",
    "AI Voice Interviewer + analysis",
    "AI Avatar Room access",
    "Daily fair-use cap: 80 applies",
  ],
  accelerator: [
    "45,000 credits / month (~75 auto-applies)",
    "Everything in Premium",
    "Auto Apply — uses credits",
    "1 free 45-min coaching session/mo",
    "Avatar webcam + body-language",
    "Interview recordings & replay",
    "Daily fair-use cap: 240 applies",
  ],
};

const UPGRADE_TIERS: { plan: PaidPlan; icon: React.ElementType; tagline: string; popular?: boolean }[] = [
  { plan: "pro",         icon: Crown,  tagline: "For active job seekers" },
  { plan: "premium",     icon: Mic,    tagline: "Most chosen by interviewees", popular: true },
  { plan: "accelerator", icon: Rocket, tagline: "Maximum realism + coaching" },
];

const PRICES: Record<PaidPlan, { monthly: number; yearly: number }> = {
  pro:         { monthly: 39,  yearly: 31 },
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
        <span className={cn("text-xs", nearLimit ? "text-desyn-warning font-medium" : "text-muted-foreground")}>
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

// ─── Cancel modal ─────────────────────────────────────────────────────────────

type CancelReason = "too_expensive" | "found_alternative" | "got_job" | "not_using" | "missing_features" | "technical" | "other";
type CancelStep = "survey" | "offer" | "done";
type DoneVariant = "discount" | "pause" | "feedback";

const CANCEL_REASONS_LIST: { id: CancelReason; label: string; subtext: string }[] = [
  { id: "too_expensive",     label: "It's too expensive",             subtext: "The price doesn't fit my budget right now" },
  { id: "got_job",           label: "I already landed a job 🎉",      subtext: "JobsAI helped me — I don't need it anymore" },
  { id: "not_using",         label: "I'm not using it enough",        subtext: "I haven't had time to get value from it" },
  { id: "found_alternative", label: "I found a cheaper alternative",  subtext: "Another tool works better for my needs" },
  { id: "missing_features",  label: "Missing features I need",        subtext: "There's something important I can't do here" },
  { id: "technical",         label: "Technical issues",               subtext: "Bugs or reliability problems pushed me away" },
  { id: "other",             label: "Other reason",                   subtext: "Something else entirely" },
];

const OFFER_PLANS: { plan: PaidPlan; label: string; monthly: number }[] = [
  { plan: "pro",         label: "Pro",               monthly: 39  },
  { plan: "premium",     label: "Premium",           monthly: 79  },
  { plan: "accelerator", label: "Career Accelerator", monthly: 199 },
];

function CancelModal({ currentPlan, onGoToPortal, onClose }: {
  currentPlan: Plan; onGoToPortal: () => void; onClose: () => void;
}) {
  const [step, setStep]           = useState<CancelStep>("survey");
  const [reason, setReason]       = useState<CancelReason | null>(null);
  const [comment, setComment]     = useState("");
  const [doneVariant, setDoneVariant] = useState<DoneVariant>("discount");
  const [submitting, setSubmitting] = useState(false);

  const offerType: "discount" | "pause" | "feedback" | "support" = (() => {
    if (!reason || reason === "too_expensive" || reason === "found_alternative" || reason === "other") return "discount";
    if (reason === "got_job" || reason === "not_using") return "pause";
    if (reason === "missing_features") return "feedback";
    return "support";
  })();

  const submitSurvey = async () => {
    if (!reason) return;
    fetch("/api/billing/cancel-feedback", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reasons: [reason], comment, wait: false }),
    }).catch(() => {});
    setStep("offer");
  };

  const claimDiscount = async () => {
    setSubmitting(true);
    try { await fetch("/api/billing/retention-offer", { method: "POST" }); } catch { /* */ }
    setSubmitting(false);
    setDoneVariant("discount");
    setStep("done");
  };

  const pauseSubscription = async () => {
    setSubmitting(true);
    try { await fetch("/api/billing/pause-subscription", { method: "POST" }); } catch { /* */ }
    setSubmitting(false);
    setDoneVariant("pause");
    setStep("done");
  };

  const sendFeatureFeedback = async () => {
    setSubmitting(true);
    try {
      await fetch("/api/billing/cancel-feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasons: [reason], comment, wait: true }),
      });
    } catch { /* */ }
    setSubmitting(false);
    setDoneVariant("feedback");
    setStep("done");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card shadow-xl max-h-[90vh]">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-5 w-5" />
        </button>

        {/* ── Step 1: Survey ── */}
        {step === "survey" && (
          <div className="p-6">
            <h2 className="text-lg font-bold">Before you go…</h2>
            <p className="mt-1 text-sm text-muted-foreground">What&apos;s the main reason you&apos;re thinking of cancelling?</p>
            <div className="mt-5 space-y-2">
              {CANCEL_REASONS_LIST.map(({ id, label, subtext }) => (
                <label key={id} className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-all",
                  reason === id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"
                )}>
                  <input type="radio" name="cancel-reason" value={id} checked={reason === id}
                    onChange={() => setReason(id)} className="h-4 w-4 shrink-0 accent-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{subtext}</p>
                  </div>
                </label>
              ))}
            </div>
            {(reason === "missing_features" || reason === "technical") && (
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
                placeholder={reason === "technical" ? "Describe the issue…" : "What feature are you missing?"}
                className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            )}
            <div className="mt-5 flex gap-2">
              <button onClick={onClose}
                className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">
                Keep my plan
              </button>
              <button onClick={submitSurvey} disabled={!reason}
                className="btn-cta flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-40">
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Offer — discount ── */}
        {step === "offer" && offerType === "discount" && (
          <div className="p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cta/10 text-2xl">💡</div>
            <h2 className="text-lg font-bold">Let&apos;s make it work for you</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Stay with JobsAI and get <span className="font-semibold text-cta">30% off for the next 3 months</span> — keep your tokens, resume, and progress.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {OFFER_PLANS.map(({ plan, label, monthly }) => {
                const discounted = Math.round(monthly * 0.7);
                const isCurrent = plan === currentPlan;
                return (
                  <div key={plan} className={cn(
                    "rounded-xl border p-3 text-center",
                    isCurrent ? "border-cta bg-cta/10" : "border-border bg-muted/30"
                  )}>
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="mt-1 text-xl font-bold">${discounted}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                    <p className="text-xs line-through text-muted-foreground">${monthly}/mo</p>
                    {isCurrent && <p className="mt-1 text-[10px] font-semibold text-cta">Your plan</p>}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">Applies for 3 months, then regular pricing resumes.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={onGoToPortal}
                className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                Still cancel
              </button>
              <button onClick={claimDiscount} disabled={submitting}
                className="btn-cta flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Claim 30% Off →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Offer — pause ── */}
        {step === "offer" && offerType === "pause" && (
          <div className="p-6">
            <div className="mb-4 text-4xl">{reason === "got_job" ? "🎉" : "⏸️"}</div>
            <h2 className="text-lg font-bold">
              {reason === "got_job" ? "Congrats on landing the job!" : "Life gets busy — we get it."}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {reason === "got_job"
                ? "Pause your subscription for 30 days instead of cancelling. Your tokens, resume, and history stay exactly as they are — no charge during the pause."
                : "Pause for 30 days instead of cancelling. Your tokens, applied jobs, and profile will be here when you're ready."}
            </p>
            <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
              <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-desyn-success" /> Tokens preserved</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-desyn-success" /> Resume &amp; profile saved</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-desyn-success" /> No charge for 30 days</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-desyn-success" /> Auto-resumes after 30 days</div>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={onGoToPortal}
                className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                Still cancel
              </button>
              <button onClick={pauseSubscription} disabled={submitting}
                className="btn-cta flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Pause for 30 Days →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Offer — missing features ── */}
        {step === "offer" && offerType === "feedback" && (
          <div className="p-6">
            <div className="mb-4 text-4xl">🧩</div>
            <h2 className="text-lg font-bold">Tell us what&apos;s missing</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your feedback goes directly to our product team. Stay for 30 more days — if we ship it, you&apos;ll get early access.
            </p>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
              placeholder="What would make JobsAI perfect for you?"
              className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            <div className="mt-5 flex gap-2">
              <button onClick={onGoToPortal}
                className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                Still cancel
              </button>
              <button onClick={sendFeatureFeedback} disabled={submitting || !comment.trim()}
                className="btn-cta flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Send &amp; Stay →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Offer — technical issues ── */}
        {step === "offer" && offerType === "support" && (
          <div className="p-6">
            <div className="mb-4 text-4xl">🛠️</div>
            <h2 className="text-lg font-bold">Let us fix it</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Don&apos;t cancel over a bug. Our team responds within 24 hours and will get it sorted — no charge while we investigate.
            </p>
            {comment && (
              <div className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Your note: </span>{comment}
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <button onClick={onGoToPortal}
                className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                Still cancel
              </button>
              <a href="mailto:support@jobsai.work?subject=Technical Issue"
                className="btn-cta flex-1 inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold">
                Email Support →
              </a>
            </div>
          </div>
        )}

        {/* ── Step 3: Done — discount ── */}
        {step === "done" && doneVariant === "discount" && (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cta/15 text-2xl">🎉</div>
            <div>
              <p className="text-lg font-bold">30% Off Applied!</p>
              <p className="mt-1 text-sm text-muted-foreground">Your discount is active for the next 3 months. Keep applying — your next interview is one step closer.</p>
            </div>
            <button onClick={onClose} className="btn-cta mt-2 inline-flex items-center justify-center rounded-xl px-6 py-2.5 text-sm font-semibold">
              Back to billing
            </button>
          </div>
        )}

        {/* ── Step 3: Done — pause ── */}
        {step === "done" && doneVariant === "pause" && (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-2xl">⏸️</div>
            <div>
              <p className="text-lg font-bold">Subscription Paused</p>
              <p className="mt-1 text-sm text-muted-foreground">You&apos;re paused for 30 days. Your data and tokens are safe. Billing auto-resumes when the pause ends.</p>
            </div>
            <button onClick={onClose} className="btn-cta mt-2 inline-flex items-center justify-center rounded-xl px-6 py-2.5 text-sm font-semibold">
              Got it
            </button>
          </div>
        )}

        {/* ── Step 3: Done — feedback ── */}
        {step === "done" && doneVariant === "feedback" && (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-desyn-success/15">
              <CheckCircle2 className="h-7 w-7 text-desyn-success" />
            </div>
            <div>
              <p className="text-lg font-bold">Feedback sent!</p>
              <p className="mt-1 text-sm text-muted-foreground">The team has your request. Your subscription stays active — we&apos;ll reach out when we ship it.</p>
            </div>
            <button onClick={onClose} className="btn-cta mt-2 inline-flex items-center justify-center rounded-xl px-6 py-2.5 text-sm font-semibold">
              Back to billing
            </button>
          </div>
        )}
      </div>
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
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [isEnterprise, setIsEnterprise] = useState(false);

  const justUpgraded = searchParams.get("success") === "true";
  const toppedUp = searchParams.get("topup") === "true";
  const canceled = searchParams.get("canceled") === "true";

  useEffect(() => {
    Promise.all([
      fetch("/api/billing").then((r) => r.json()),
      fetch("/api/tokens").then((r) => r.json()),
      fetch("/api/user/api-key").then((r) => r.json()),
      fetch("/api/enterprise/org").then((r) => r.json()),
    ]).then(([b, t, k, e]) => {
      setBilling(b.data);
      setTokens(t.data);
      setApiKey(k.api_key ?? null);
      setIsEnterprise(!!e.data);
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

  const openPortal = async () => {
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
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading billing…
          </div>
        </main>
      </>
    );
  }
  if (!billing) return null;

  // Enterprise users are billed via contract — hide all Stripe flows
  if (isEnterprise) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">Account</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Billing &amp; Plan</h1>
        <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand shadow-glow">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold">Enterprise Plan</p>
              <p className="text-sm text-muted-foreground">Your account is on a custom enterprise contract.</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Billing, seat management, and plan changes are handled directly with your account manager.
            For billing enquiries contact <a href="mailto:enterprise@jobsai.work" className="text-primary hover:underline">enterprise@jobsai.work</a>.
          </p>
          <a href="/enterprise/dashboard"
            className="btn-cta mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold">
            Go to Enterprise Dashboard →
          </a>
        </div>
      </main>
    );
  }

  const { plan, usage } = billing;
  const meta = PLAN_META[plan];
  const Icon = meta.icon;
  const isPaid = plan !== "free";

  return (
    <>
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
                  <Button variant="outline" size="sm" onClick={openPortal} disabled={portaling}>
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
              {isPaid && (
                <button onClick={() => setShowCancelModal(true)} className="mt-4 text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2">
                  Cancel subscription
                </button>
              )}
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">{isPaid ? "Change plan" : "Upgrade your plan"}</h2>
              <div className="flex items-center gap-2">
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
                    {(() => {
                      const savedPct = Math.round((1 - PRICES[tier].yearly / PRICES[tier].monthly) * 100);
                      return interval === "yearly" ? (
                        <p className="text-[11px] font-medium text-desyn-success">${PRICES[tier].yearly * 12}/yr billed annually · save {savedPct}%</p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">${PRICES[tier].monthly * 12}/yr · or go yearly &amp; save {savedPct}%</p>
                      );
                    })()}
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
                      onClick={() => (isPaid ? openPortal() : upgrade(tier))}
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

          {/* Career coaching */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-brand text-white">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Book a Career Success Coach</h2>
                  <p className="text-sm text-muted-foreground">
                    A 45-min 1:1 video session — {plan === "accelerator" ? "1 free per month, included with Career Accelerator." : "pay with tokens (20K)."}
                  </p>
                </div>
              </div>
              <Link href="/dashboard/coaching" className="btn-cta inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-5 text-sm font-semibold">
                Book a session <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

          <p className="text-center text-xs text-muted-foreground">
            Questions about billing, credits, or refunds? See our{" "}
            <Link href="/refund-policy" className="text-primary hover:underline">Refund &amp; Credit Policy</Link>{" "}
            or email support@jobsai.work.
          </p>
        </div>
      </main>

      {showCancelModal && (
        <CancelModal
          currentPlan={plan}
          onGoToPortal={() => { setShowCancelModal(false); openPortal(); }}
          onClose={() => setShowCancelModal(false)}
        />
      )}
    </>
  );
}
