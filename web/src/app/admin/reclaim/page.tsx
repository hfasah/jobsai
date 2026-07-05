"use client";

import { useState } from "react";
import { Loader2, Coins, AlertTriangle, CheckCircle2, Undo2 } from "lucide-react";

type Summary = {
  dryRun: boolean;
  confirmations_scanned: number;
  reclaimed_applies: number;
  reclaimed_credits: number;
  users_affected: number;
  error?: string;
};

type ClawSummary = {
  dryRun: boolean;
  users_scanned: number;
  grandfathered: number;
  users_affected: number;
  grants_reversed: number;
  credits_clawed_back: number;
  partial_capped: number;
  per_user: { user_id: string; erroneous_grants: number; clawed_credits: number }[];
  error?: string;
};

type BackfillSummary = {
  dryRun: boolean;
  failed_unsettled_tasks: number;
  excluded_tasks: number;
  grandfathered: number;
  refunded_tasks: number;
  refunded_credits: number;
  users_affected: number;
  per_user: { user_id: string; tasks: number; credits: number }[];
  error?: string;
};

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className={`text-2xl font-bold tabular-nums ${accent ? "text-emerald-400" : "text-foreground"}`}>{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default function AdminReclaim() {
  const [preview, setPreview] = useState<Summary | null>(null);
  const [result, setResult] = useState<Summary | null>(null);
  const [loading, setLoading] = useState<"preview" | "run" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Double-grant claw-back (PR #268 leak).
  const [exclude, setExclude] = useState("tom.bianco@gmail.com");
  const [clawPreview, setClawPreview] = useState<ClawSummary | null>(null);
  const [clawResult, setClawResult] = useState<ClawSummary | null>(null);
  const [clawLoading, setClawLoading] = useState<"preview" | "run" | null>(null);
  const [clawError, setClawError] = useState<string | null>(null);

  // Failed-apply refund backfill (metering-outage remediation).
  const [bfPreview, setBfPreview] = useState<BackfillSummary | null>(null);
  const [bfResult, setBfResult] = useState<BackfillSummary | null>(null);
  const [bfLoading, setBfLoading] = useState<"preview" | "run" | null>(null);
  const [bfError, setBfError] = useState<string | null>(null);
  const [bfExclude, setBfExclude] = useState("tom.bianco@gmail.com");

  const runPreview = async () => {
    setLoading("preview"); setError(null); setResult(null);
    try {
      const res = await fetch("/api/admin/reclaim-confirmed-applies");
      const j = await res.json();
      if (!res.ok) setError(j.error ?? "Preview failed.");
      else setPreview(j);
    } catch { setError("Preview failed."); }
    setLoading(null);
  };

  const runExecute = async () => {
    if (!preview) return;
    if (!confirm(
      `This will RE-CHARGE ${preview.users_affected} user(s) a total of ${preview.reclaimed_credits.toLocaleString()} credits ` +
      `for ${preview.reclaimed_applies} confirmed application(s). This is a real billing action. Continue?`,
    )) return;
    setLoading("run"); setError(null);
    try {
      const res = await fetch("/api/admin/reclaim-confirmed-applies", { method: "POST" });
      const j = await res.json();
      if (!res.ok) setError(j.error ?? "Execution failed.");
      else setResult(j);
    } catch { setError("Execution failed."); }
    setLoading(null);
  };

  const clawUrl = () => {
    const q = exclude.trim() ? `?exclude_emails=${encodeURIComponent(exclude.trim())}` : "";
    return `/api/admin/clawback-double-grants${q}`;
  };

  const runClawPreview = async () => {
    setClawLoading("preview"); setClawError(null); setClawResult(null);
    try {
      const res = await fetch(clawUrl());
      const j = await res.json();
      if (!res.ok) setClawError(j.error ?? "Preview failed.");
      else setClawPreview(j);
    } catch { setClawError("Preview failed."); }
    setClawLoading(null);
  };

  const runClawExecute = async () => {
    if (!clawPreview) return;
    if (!confirm(
      `This will REMOVE ${clawPreview.credits_clawed_back.toLocaleString()} erroneously-granted credits from ` +
      `${clawPreview.users_affected} user(s) (${clawPreview.grants_reversed} grant(s)). ` +
      `${clawPreview.grandfathered} grandfathered user(s) are excluded. This is a real billing action. Continue?`,
    )) return;
    setClawLoading("run"); setClawError(null);
    try {
      const res = await fetch(clawUrl(), { method: "POST" });
      const j = await res.json();
      if (!res.ok) setClawError(j.error ?? "Execution failed.");
      else setClawResult(j);
    } catch { setClawError("Execution failed."); }
    setClawLoading(null);
  };

  const claw = clawResult ?? clawPreview;

  const bfUrl = () => {
    const q = bfExclude.trim() ? `?exclude_emails=${encodeURIComponent(bfExclude.trim())}` : "";
    return `/api/admin/backfill-failed-applies${q}`;
  };

  const runBfPreview = async () => {
    setBfLoading("preview"); setBfError(null); setBfResult(null);
    try {
      const res = await fetch(bfUrl());
      const j = await res.json();
      if (!res.ok) setBfError(j.error ?? "Preview failed.");
      else setBfPreview(j);
    } catch { setBfError("Preview failed."); }
    setBfLoading(null);
  };

  const runBfExecute = async () => {
    if (!bfPreview) return;
    if (!confirm(
      `This will REFUND ${bfPreview.refunded_credits.toLocaleString()} credits to ${bfPreview.users_affected} user(s) ` +
      `for ${bfPreview.failed_unsettled_tasks} failed auto-applies that were charged during the metering outage. ` +
      `${bfPreview.grandfathered} user(s) are excluded (incl. Thomas). This is a real billing action. Continue?`,
    )) return;
    setBfLoading("run"); setBfError(null);
    try {
      const res = await fetch(bfUrl(), { method: "POST" });
      const j = await res.json();
      if (!res.ok) setBfError(j.error ?? "Execution failed.");
      else setBfResult(j);
    } catch { setBfError("Execution failed."); }
    setBfLoading(null);
  };

  const bf = bfResult ?? bfPreview;

  return (
    <div className="space-y-10">
      {/* ── Confirmed-apply reclaim ─────────────────────────────────────────── */}
      <section className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Coins className="h-5 w-5 text-primary" /> Revenue Reclaim</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Recover refunds for auto-applies that were marked &ldquo;failed&rdquo; but the employer actually confirmed (revenue leak).
            <strong> Preview first</strong> — it charges nobody. Execute re-charges affected users. Both are idempotent &amp; safe to re-run.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={runPreview} disabled={loading !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">
            {loading === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />} Preview (dry-run)
          </button>
          <button onClick={runExecute} disabled={loading !== null || !preview || preview.reclaimed_applies === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40">
            {loading === "run" ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />} Execute reclaim
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

        {preview && !result && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Dry-run preview · no charges applied</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Confirmations scanned" value={preview.confirmations_scanned} />
              <Stat label="Reclaimable applies" value={preview.reclaimed_applies} accent />
              <Stat label="Reclaimable credits" value={preview.reclaimed_credits} accent />
              <Stat label="Users affected" value={preview.users_affected} />
            </div>
            {preview.reclaimed_applies > 0
              ? <p className="mt-3 text-sm text-amber-400">Executing will re-charge these {preview.users_affected} user(s) {preview.reclaimed_credits.toLocaleString()} credits total.</p>
              : <p className="mt-3 text-sm text-muted-foreground">Nothing to reclaim — no confirmed applies were refunded in error. 🎉</p>}
          </div>
        )}

        {result && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Reclaim executed</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Confirmations scanned" value={result.confirmations_scanned} />
              <Stat label="Applies reclaimed" value={result.reclaimed_applies} accent />
              <Stat label="Credits reclaimed" value={result.reclaimed_credits} accent />
              <Stat label="Users affected" value={result.users_affected} />
            </div>
          </div>
        )}
      </section>

      {/* ── Double-grant claw-back ──────────────────────────────────────────── */}
      <section className="space-y-6 border-t border-border pt-8">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold"><Undo2 className="h-5 w-5 text-primary" /> Double-grant claw-back</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Reverse monthly credit grants that <strong>duplicated the same-plan allowance</strong> before a full month elapsed —
            the calendar-month leak fixed in PR #268 (e.g. sign up on the 28th, get a second full allowance on the 1st).
            Plan <strong>upgrade</strong> grants (a different, higher amount) are legit and never touched. Claw-back never
            pushes a balance below zero and is idempotent. Grandfathered emails below are always excluded.
          </p>
        </div>

        <div className="max-w-lg">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Grandfather (exclude) — comma-separated emails</label>
          <input value={exclude} onChange={(e) => setExclude(e.target.value)} disabled={clawLoading !== null}
            placeholder="tom.bianco@gmail.com"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50" />
          <p className="mt-1 text-xs text-muted-foreground">Thomas Bianco is grandfathered server-side regardless (he surfaced the leak).</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={runClawPreview} disabled={clawLoading !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">
            {clawLoading === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Preview (dry-run)
          </button>
          <button onClick={runClawExecute} disabled={clawLoading !== null || !clawPreview || clawPreview.grants_reversed === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40">
            {clawLoading === "run" ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />} Execute claw-back
          </button>
        </div>

        {clawError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{clawError}</div>}

        {claw && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {clawResult
                ? <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Claw-back executed</span>
                : "Dry-run preview · no credits removed"}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Stat label="Users scanned" value={claw.users_scanned} />
              <Stat label="Grandfathered" value={claw.grandfathered} />
              <Stat label="Grants reversed" value={claw.grants_reversed} accent />
              <Stat label="Credits clawed back" value={claw.credits_clawed_back} accent />
              <Stat label="Users affected" value={claw.users_affected} />
            </div>
            {claw.partial_capped > 0 && (
              <p className="mt-3 text-sm text-amber-400">{claw.partial_capped} grant(s) already partly spent — clawed back only the remaining balance (no negative balances).</p>
            )}
            {!clawResult && claw.grants_reversed === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">Nothing to claw back — no early double-grants outstanding. 🎉</p>
            )}
            {claw.per_user.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-4 py-2 font-medium">User ID</th><th className="px-4 py-2 font-medium">Grants</th><th className="px-4 py-2 font-medium">Credits</th></tr>
                  </thead>
                  <tbody>
                    {claw.per_user.map((u) => (
                      <tr key={u.user_id} className="border-t border-border">
                        <td className="px-4 py-2 font-mono text-xs">{u.user_id}</td>
                        <td className="px-4 py-2 tabular-nums">{u.erroneous_grants}</td>
                        <td className="px-4 py-2 tabular-nums">{u.clawed_credits.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Failed-apply refund backfill (metering outage) ──────────────────── */}
      <section className="space-y-6 border-t border-border pt-8">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold"><Coins className="h-5 w-5 text-primary" /> Failed-apply refund backfill</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            While migration 128 was unapplied, the meter/refund path silently no-op&rsquo;d, so <strong>failed</strong> auto-applies
            (nothing submitted) kept their full upfront charge. This refunds every unsettled failed apply that was actually charged.
            Submitted applies are left billed at the flat quote. Idempotent (stamps <code>metered_credits=0</code>) &amp; safe to re-run.
          </p>
        </div>

        <div className="max-w-lg">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Exclude (don&rsquo;t refund) — comma-separated emails</label>
          <input value={bfExclude} onChange={(e) => setBfExclude(e.target.value)} disabled={bfLoading !== null}
            placeholder="tom.bianco@gmail.com"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50" />
          <p className="mt-1 text-xs text-muted-foreground">Thomas Bianco is excluded server-side regardless — his balance is held at 18,030 (no refund).</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={runBfPreview} disabled={bfLoading !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">
            {bfLoading === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />} Preview (dry-run)
          </button>
          <button onClick={runBfExecute} disabled={bfLoading !== null || !bfPreview || bfPreview.failed_unsettled_tasks === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40">
            {bfLoading === "run" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Execute refunds
          </button>
        </div>

        {bfError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{bfError}</div>}

        {bf && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {bfResult
                ? <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Refunds issued</span>
                : "Dry-run preview · no credits refunded"}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Stat label={bfResult ? "Tasks refunded" : "Tasks to refund"} value={bfResult ? bf.refunded_tasks : bf.failed_unsettled_tasks} accent />
              <Stat label="Credits to refund" value={bf.refunded_credits} accent />
              <Stat label="Users affected" value={bf.users_affected} />
              <Stat label="Excluded (held)" value={bf.grandfathered} />
              <Stat label="Excluded tasks" value={bf.excluded_tasks} />
            </div>
            {!bfResult && bf.failed_unsettled_tasks === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">Nothing to refund — every failed apply is already settled. 🎉</p>
            )}
            {!bfResult && bf.failed_unsettled_tasks > 0 && (
              <p className="mt-3 text-sm text-amber-400">Executing will refund {bf.refunded_credits.toLocaleString()} credits to {bf.users_affected} user(s).</p>
            )}
            {bf.per_user.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-4 py-2 font-medium">User ID</th><th className="px-4 py-2 font-medium">Failed applies</th><th className="px-4 py-2 font-medium">Refund</th></tr>
                  </thead>
                  <tbody>
                    {bf.per_user.map((u) => (
                      <tr key={u.user_id} className="border-t border-border">
                        <td className="px-4 py-2 font-mono text-xs">{u.user_id}</td>
                        <td className="px-4 py-2 tabular-nums">{u.tasks}</td>
                        <td className="px-4 py-2 tabular-nums text-emerald-400">+{u.credits.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
