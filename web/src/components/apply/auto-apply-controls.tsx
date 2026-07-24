"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, Loader2, Pause, Play, CheckCircle2 } from "lucide-react";

// Continuous Auto-Apply controls for the Search Jobs screen. Turning it on flips
// the auto_apply_enabled preference; the discover + auto-apply crons then find
// and apply to matching jobs on their own, spending credits, emailing each
// submission and a top-up reminder when credits run low. This component is the
// on/off switch + a live status card mirroring the competitor's dashboard.

interface Status {
  enabled: boolean;
  mode: string;
  applicationsSubmitted: number;
  jobMatchesFound: number;
  balance: number;
  appliesLeft: number;
  lowCredits: boolean;
}

export function AutoApplyControls() {
  const [status, setStatus] = useState<Status | null>(null);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auto-apply/toggle").then((r) => r.json()).then(setStatus).catch(() => {});
  }, []);

  async function set(enabled: boolean) {
    setBusy(true);
    const res = await fetch("/api/auto-apply/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }).catch(() => null);
    if (res?.ok) setStatus(await res.json());
    setBusy(false);
    setModal(false);
  }

  if (!status) return null;
  const on = status.enabled;

  return (
    <>
      {/* Toggle button */}
      {on ? (
        <button onClick={() => set(false)} disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/15 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />} Pause Auto Apply
        </button>
      ) : (
        <button onClick={() => setModal(true)} disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-opacity hover:opacity-90 disabled:opacity-60">
          <Zap className="h-4 w-4" /> Auto Apply
        </button>
      )}

      {/* Live status card — shown when Auto Apply is on (competitor-style) */}
      {on && (
        <div className="mt-4 w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-sm font-semibold text-emerald-500">Applying now</span>
              <span className="text-xs text-muted-foreground">We&apos;re finding and applying to matching jobs for you.</span>
            </div>
            <div className="flex items-center gap-8 tabular-nums">
              <div><p className="text-lg font-bold">{status.applicationsSubmitted.toLocaleString()}</p><p className="text-xs text-muted-foreground">Applications submitted</p></div>
              <div><p className="text-lg font-bold">{status.jobMatchesFound.toLocaleString()}</p><p className="text-xs text-muted-foreground">Job matches found</p></div>
              <div><p className="text-lg font-bold">{status.appliesLeft.toLocaleString()}</p><p className="text-xs text-muted-foreground">Applies left (credits)</p></div>
            </div>
            <Link href="/dashboard/auto-apply" className="ml-auto text-sm font-medium text-primary underline underline-offset-2">View activity →</Link>
          </div>
          {status.lowCredits && (
            <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
              You&apos;re out of credits — auto-apply is paused until you top up. We&apos;ll email you a reminder.{" "}
              <Link href="/dashboard/billing" className="underline">Top up now</Link>
            </p>
          )}
        </div>
      )}

      {/* Confirm modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setModal(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /><h3 className="text-lg font-bold">Turn on Auto Apply</h3></div>
            <p className="mt-2 text-sm text-muted-foreground">JobsAI will continuously find jobs that match your profile and apply for you automatically — no manual work.</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> Applies to matching jobs as long as you have credits.</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> Emails you a confirmation for every application.</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> Reminds you to top up when credits run low, and pauses safely.</li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">You have <strong className="text-foreground">{status.appliesLeft.toLocaleString()}</strong> applications of credit. Pause anytime.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setModal(false)} disabled={busy} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">Not now</button>
              <button onClick={() => set(true)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Start Auto Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
