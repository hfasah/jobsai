"use client";

import { useState } from "react";
import { Loader2, Coins, AlertTriangle, CheckCircle2 } from "lucide-react";

type Summary = {
  dryRun: boolean;
  confirmations_scanned: number;
  reclaimed_applies: number;
  reclaimed_credits: number;
  users_affected: number;
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

  return (
    <div className="space-y-6">
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
    </div>
  );
}
