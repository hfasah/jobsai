"use client";

import { useEffect, useState } from "react";

// Convert-on-exhaustion prompt. Shows for a TRIALING user whose credits are
// running low, offering to start their paid plan now (ends the trial early,
// charges the card, unlocks the full allowance). Explicit confirm before the
// charge — no surprise billing. Renders nothing for non-trial users.

interface Preview {
  eligible: boolean;
  plan?: string;
  amount?: number;
  currency?: string;
  interval?: string;
}

const PLAN_LABEL: Record<string, string> = {
  pro: "Pro", premium: "Premium", accelerator: "Career Accelerator",
};

export function TrialConvertBanner({ status, balance }: { status: string; balance: number }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Only fetch the charge preview for a trialing user who is low on credits.
  const lowOnCredits = status === "trialing" && balance < 100;

  useEffect(() => {
    if (!lowOnCredits) return;
    let cancelled = false;
    fetch("/api/billing/convert-trial")
      .then((r) => r.json())
      .then((d: Preview) => { if (!cancelled) setPreview(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [lowOnCredits]);

  if (!lowOnCredits || dismissed || !preview?.eligible) return null;

  const label = PLAN_LABEL[preview.plan ?? ""] ?? "your plan";
  const priceText = preview.amount != null
    ? `${preview.currency === "USD" ? "$" : ""}${preview.amount}${preview.currency && preview.currency !== "USD" ? " " + preview.currency : ""}/${preview.interval === "year" ? "yr" : "mo"}`
    : "";

  async function convert() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/billing/convert-trial", { method: "POST" }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) {
      window.location.reload(); // pick up the new balance + active status
    } else {
      setError(json.error ?? "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <p className="text-sm text-foreground">
          <span className="font-semibold">You've nearly used your trial credits.</span>{" "}
          Start {label} now to keep going with your full monthly allowance.
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => setOpen(true)}
            className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-black transition-opacity hover:opacity-90">
            Start {label} now
          </button>
          <button onClick={() => setDismissed(true)} aria-label="Dismiss"
            className="rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Start {label} now?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Your 7-day trial will end today and your card will be charged{priceText ? ` ${priceText}` : ""}.
              Your full {label} monthly credits unlock immediately, and you keep everything you've done so far.
            </p>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={busy}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
                Not yet
              </button>
              <button onClick={convert} disabled={busy}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60">
                {busy ? "Starting…" : `Confirm & start${priceText ? ` (${priceText})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
