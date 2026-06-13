"use client";

import { useState } from "react";
import { X, Loader2, Tag, PauseCircle, Clock, CalendarCheck, ShieldCheck } from "lucide-react";

type Reason =
  | "too_expensive"
  | "missing_features"
  | "not_hiring"
  | "switching"
  | "poor_experience"
  | "just_testing"
  | "other";

const REASONS: { value: Reason; label: string }[] = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "missing_features", label: "Missing features" },
  { value: "not_hiring", label: "Not hiring right now" },
  { value: "switching", label: "Switching to another solution" },
  { value: "poor_experience", label: "Poor experience" },
  { value: "just_testing", label: "Just testing" },
  { value: "other", label: "Other" },
];

// Plan price → half price for the retention discount (matches public pricing).
const PRICE: Record<string, [number, number]> = {
  professional: [299, 149],
  agency: [799, 399],
  business: [1499, 749],
};

type Offer = "discount_50_6mo" | "pause_90d" | "extend_trial_14d" | "book_demo" | null;

function offerFor(reason: Reason, trialing: boolean, trialExtended: boolean): Offer {
  switch (reason) {
    case "too_expensive":
      return "discount_50_6mo";
    case "not_hiring":
      return "pause_90d";
    case "just_testing":
      return trialing && !trialExtended ? "extend_trial_14d" : null;
    case "missing_features":
      return "book_demo";
    default:
      return null;
  }
}

export function CancelFlow({
  planName,
  trialing,
  trialExtended,
}: {
  planName: string | null;
  trialing: boolean;
  trialExtended: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"reason" | "offer" | "confirm">("reason");
  const [reason, setReason] = useState<Reason | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = (planName ?? "").toLowerCase();
  const prices = PRICE[slug];
  const offer = reason ? offerFor(reason, trialing, trialExtended) : null;

  const reset = () => {
    setOpen(false);
    setStep("reason");
    setReason(null);
    setComment("");
    setError(null);
    setBusy(false);
  };

  const goFromReason = () => {
    if (!reason) return;
    setStep(offerFor(reason, trialing, trialExtended) ? "offer" : "confirm");
  };

  const acceptOffer = async () => {
    if (!offer) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/enterprise/billing/retain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer, reason }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not apply the offer.");
      if (offer === "book_demo") {
        window.location.href = "/enterprise/demo";
        return;
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  };

  const confirmCancel = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/enterprise/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, comment }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not cancel.");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Cancel subscription
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-lg font-bold">
                {step === "reason" && "Before you go"}
                {step === "offer" && "Wait — we can help"}
                {step === "confirm" && "Confirm cancellation"}
              </h3>
              <button onClick={reset} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {step === "reason" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">What&apos;s the main reason you&apos;re cancelling?</p>
                <div className="space-y-1.5">
                  {REASONS.map((r) => (
                    <label
                      key={r.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                        reason === r.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name="reason"
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="accent-primary"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Anything you'd like to add? (optional)"
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  onClick={goFromReason}
                  disabled={!reason}
                  className="w-full rounded-lg bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            )}

            {step === "offer" && offer === "discount_50_6mo" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <Tag className="h-5 w-5" />
                  <span className="font-semibold">Special retention offer</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Stay with JobsAI Enterprise and save <strong>50% for the next 6 months</strong>.
                </p>
                {prices && (
                  <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
                    <div className="text-sm text-muted-foreground">{planName}</div>
                    <div className="text-2xl font-bold">
                      <span className="text-muted-foreground line-through">${prices[0]}</span>{" "}
                      <span className="text-primary">${prices[1]}</span>
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </div>
                  </div>
                )}
                <OfferButtons busy={busy} onAccept={acceptOffer} onDecline={() => setStep("confirm")} acceptLabel="Keep subscription" />
              </div>
            )}

            {step === "offer" && offer === "pause_90d" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <PauseCircle className="h-5 w-5" />
                  <span className="font-semibold">Pause instead of cancel</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Pause your account for up to <strong>90 days</strong> — no charges while paused, and we keep everything:
                </p>
                <ul className="space-y-1 text-sm">
                  {["Candidate database", "Jobs", "Reports", "Settings"].map((x) => (
                    <li key={x} className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-500" />{x}</li>
                  ))}
                </ul>
                <OfferButtons busy={busy} onAccept={acceptOffer} onDecline={() => setStep("confirm")} acceptLabel="Pause my account" />
              </div>
            )}

            {step === "offer" && offer === "extend_trial_14d" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <Clock className="h-5 w-5" />
                  <span className="font-semibold">Need more time?</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  We&apos;ll extend your trial by <strong>14 more days</strong>, free. One-time only.
                </p>
                <OfferButtons busy={busy} onAccept={acceptOffer} onDecline={() => setStep("confirm")} acceptLabel="Extend my trial" />
              </div>
            )}

            {step === "offer" && offer === "book_demo" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <CalendarCheck className="h-5 w-5" />
                  <span className="font-semibold">Tell us what&apos;s missing</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  The feature you need may already be on the roadmap — or live. Book a quick product review and we&apos;ll walk through it.
                </p>
                <OfferButtons busy={busy} onAccept={acceptOffer} onDecline={() => setStep("confirm")} acceptLabel="Book a product review" />
              </div>
            )}

            {step === "confirm" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your subscription stays active until the end of your current period. After that:
                </p>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground" />Jobs are archived</li>
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground" />Candidates stored for 90 days</li>
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground" />Workspace access is removed</li>
                </ul>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={reset}
                    className="w-full rounded-lg bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Keep subscription
                  </button>
                  <button
                    onClick={confirmCancel}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Cancel subscription
                  </button>
                </div>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}

export function ResumeButton({ label = "Resume subscription" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const resume = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/enterprise/billing/resume", { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).error || "Could not resume.");
      window.location.reload();
    } catch {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={resume}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </button>
  );
}

function OfferButtons({
  busy,
  onAccept,
  onDecline,
  acceptLabel,
}: {
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  acceptLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onAccept}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {acceptLabel}
      </button>
      <button
        onClick={onDecline}
        disabled={busy}
        className="w-full rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        Continue cancellation
      </button>
    </div>
  );
}
