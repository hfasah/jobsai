"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Gauge, Loader2, ArrowLeft, AlertCircle, Plus, Check,
  AlertTriangle, ShieldAlert, FileWarning, Sparkles, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AtsScan } from "@/types/phase3";

type JobItem = { id: string; status: string; parsed: { title: string | null; company: string | null } | null };

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const grade =
    score >= 85 ? { label: "Excellent", color: "#34d399" } :
    score >= 70 ? { label: "Good",      color: "#a3e635" } :
    score >= 55 ? { label: "Average",   color: "#f59e0b" } :
                  { label: "Weak",      color: "#f87171" };

  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="144" height="144" viewBox="0 0 144 144">
        <circle cx="72" cy="72" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/40" />
        <circle
          cx="72" cy="72" r={r} fill="none"
          stroke={grade.color} strokeWidth="10"
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
      </svg>
      <div className="relative text-center">
        <p className="text-4xl font-bold tabular-nums" style={{ color: grade.color }}>{score}</p>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{grade.label}</p>
      </div>
    </div>
  );
}

// ── Breakdown ─────────────────────────────────────────────────────────────────
const BREAKDOWN_ITEMS: { key: string; reasonKey: string; label: string; max: number }[] = [
  { key: "keyword_alignment",    reasonKey: "keyword_alignment_reason",    label: "Keyword Alignment",    max: 40 },
  { key: "experience_relevance", reasonKey: "experience_relevance_reason", label: "Experience Relevance", max: 25 },
  { key: "formatting",           reasonKey: "formatting_reason",           label: "Formatting",           max: 20 },
  { key: "readability",          reasonKey: "readability_reason",          label: "Readability",          max: 10 },
];

function barColor(v: number, max: number) {
  const pct = v / max;
  if (pct >= 0.8) return "bg-emerald-500";
  if (pct >= 0.6) return "bg-amber-500";
  return "bg-destructive";
}

// ── Severity badge ────────────────────────────────────────────────────────────
const SEV: Record<string, string> = {
  high:   "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  low:    "bg-muted text-muted-foreground border-transparent",
};

function SevBadge({ sev }: { sev: string }) {
  return (
    <span className={cn("inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase", SEV[sev] ?? SEV.low)}>
      {sev}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ResumeScorePage() {
  const [jobs, setJobs] = useState<JobItem[] | null>(null);
  const [jobId, setJobId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<AtsScan | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/jobs").then((r) => r.json())
      .then((j) => { if (active) setJobs((j.data ?? []).filter((x: JobItem) => x.status === "ready")); })
      .catch(() => { if (active) setJobs([]); });
    return () => { active = false; };
  }, []);

  async function runScan() {
    if (!jobId) { setError("Pick a job first."); return; }
    setLoading(true); setError(null); setScan(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/ats-scan`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed");
      setScan(json.data as AtsScan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  const sortedFixes = [...(scan?.fixes ?? [])].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/dashboard/resumes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Resume tools
      </Link>

      <div className="mt-6 flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow">
          <Gauge className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ATS Resume Score</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Score your resume against a job&apos;s ATS with a full breakdown — keywords, structure, weaknesses, and the exact fixes that move the needle.
          </p>
        </div>
      </div>

      {/* Job selector + scan trigger */}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {jobs === null ? (
          <div className="flex h-11 items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your jobs…
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            No ready jobs yet.
            <Link href="/dashboard/jobs/import" className="inline-flex items-center gap-1 text-primary hover:underline">
              <Plus className="h-4 w-4" /> Add a job
            </Link>
          </div>
        ) : (
          <>
            <select value={jobId} onChange={(e) => setJobId(e.target.value)}
              className="h-11 flex-1 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary">
              <option value="">Select a job to score against…</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.parsed?.title ?? "Untitled role"}{j.parsed?.company ? ` — ${j.parsed.company}` : ""}
                </option>
              ))}
            </select>
            <button onClick={runScan} disabled={loading || !jobId}
              className="btn-cta inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm disabled:opacity-70">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analysing…</> : <><Gauge className="h-4 w-4" /> Run Score</>}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading && (
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Running ATS analysis — usually 10–20 seconds…</p>
        </div>
      )}

      {scan && !loading && (
        <div className="mt-8 space-y-5">

          {/* ── Header: ring + breakdown ── */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <div className="shrink-0">
                <ScoreRing score={scan.score} />
                <p className="mt-2 text-center text-[11px] text-muted-foreground">/ 100 ATS score</p>
              </div>
              <div className="w-full flex-1 space-y-3">
                {BREAKDOWN_ITEMS.map((b) => {
                  const bd = scan.breakdown as Record<string, unknown>;
                  const v = typeof bd[b.key] === "number" ? (bd[b.key] as number) : 0;
                  const reason = typeof bd[b.reasonKey] === "string" ? (bd[b.reasonKey] as string) : null;
                  const pct = Math.min(100, (v / b.max) * 100);
                  return (
                    <div key={b.key}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{b.label}</span>
                        <span className="tabular-nums text-muted-foreground">{v}/{b.max}</span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full transition-all duration-700", barColor(v, b.max))} style={{ width: `${pct}%` }} />
                      </div>
                      {reason && <p className="mt-0.5 text-[11px] text-muted-foreground">{reason}</p>}
                    </div>
                  );
                })}
                {typeof scan.breakdown?.buzzwords_penalty === "number" && scan.breakdown.buzzwords_penalty < 0 && (
                  <p className="text-xs text-destructive">
                    Buzzword penalty: {scan.breakdown.buzzwords_penalty} pts
                    {scan.breakdown.buzzwords_penalty_reason && ` — ${scan.breakdown.buzzwords_penalty_reason}`}
                  </p>
                )}
              </div>
            </div>

            {/* AI summary */}
            {scan.summary && (
              <div className="mt-5 flex items-start gap-2 rounded-xl bg-primary/5 p-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm text-foreground">{scan.summary}</p>
              </div>
            )}
          </div>

          {/* ── Keywords ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-amber-500">
                Missing keywords ({scan.keyword_coverage?.missing?.length ?? 0})
              </h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {scan.keyword_coverage?.missing?.length
                  ? scan.keyword_coverage.missing.map((k) => (
                      <span key={k} className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-500">{k}</span>
                    ))
                  : <span className="text-xs text-muted-foreground">None — great coverage!</span>}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-emerald-400">
                Matched keywords ({scan.keyword_coverage?.matched?.length ?? 0})
              </h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {scan.keyword_coverage?.matched?.length
                  ? scan.keyword_coverage.matched.map((k) => (
                      <span key={k} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400">
                        <Check className="h-3 w-3" /> {k}
                      </span>
                    ))
                  : <span className="text-xs text-muted-foreground">—</span>}
              </div>
            </div>
          </div>

          {/* ── Priority Fixes ── */}
          {sortedFixes.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Priority Fixes
              </h3>
              <ul className="mt-3 divide-y divide-border">
                {sortedFixes.map((f, i) => (
                  <li key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="mt-0.5 shrink-0"><SevBadge sev={f.severity} /></div>
                    <div className="min-w-0 flex-1">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">{f.section}</span>
                      <p className="mt-1 text-sm text-muted-foreground">{f.suggestion}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Weaknesses ── */}
          {scan.weaknesses?.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <FileWarning className="h-4 w-4 text-muted-foreground" /> Section Weaknesses
              </h3>
              <ul className="mt-3 divide-y divide-border">
                {scan.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="mt-0.5 shrink-0"><SevBadge sev={w.severity} /></div>
                    <div>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] capitalize text-muted-foreground">{w.section}</span>
                      <p className="mt-1 text-sm text-muted-foreground">{w.issue}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── ATS Risks + Formatting Issues side by side ── */}
          {((scan.ats_risks?.length ?? 0) > 0 || (scan.formatting_issues?.length ?? 0) > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {scan.ats_risks?.length > 0 && (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <ShieldAlert className="h-4 w-4" /> ATS Risks
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {scan.ats_risks.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" /> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {scan.formatting_issues?.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground">Formatting Issues</h3>
                  <ul className="mt-3 space-y-2">
                    {scan.formatting_issues.map((f, i) => (
                      <li key={i} className="text-sm">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] capitalize text-muted-foreground">{f.type}</span>
                        <p className="mt-0.5 text-muted-foreground">{f.detail}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ── Buzzwords ── */}
          {scan.buzzwords?.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">Buzzwords to Replace</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">These phrases are too vague — ATS systems and recruiters discount them.</p>
              <ul className="mt-3 space-y-2">
                {scan.buzzwords.map((b, i) => (
                  <li key={i} className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-center sm:gap-3">
                    <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive line-through">{b.phrase}</span>
                    <ChevronRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
                    <span className="text-muted-foreground">{b.suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA */}
          {jobId && (
            <Link href={`/dashboard/jobs/${jobId}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              Optimise this resume & apply →
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
