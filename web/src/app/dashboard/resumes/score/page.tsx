"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gauge, Loader2, ArrowLeft, AlertCircle, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AtsScan } from "@/types/phase3";

type JobItem = { id: string; status: string; parsed: { title: string | null; company: string | null } | null };

const BREAKDOWN: { key: keyof NonNullable<AtsScan["breakdown"]>; label: string; max: number }[] = [
  { key: "keyword_alignment", label: "Keyword alignment", max: 40 },
  { key: "experience_relevance", label: "Experience relevance", max: 25 },
  { key: "formatting", label: "Formatting", max: 20 },
  { key: "readability", label: "Readability", max: 10 },
];

function scoreTone(s: number) {
  if (s >= 80) return "text-emerald-400";
  if (s >= 60) return "text-[var(--cta)]";
  return "text-destructive";
}
const sevTone: Record<string, string> = {
  high: "text-destructive", medium: "text-[var(--cta)]", low: "text-muted-foreground",
};

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

  async function score() {
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
          <h1 className="text-2xl font-bold tracking-tight">Resume Score</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Score your resume against a job&apos;s ATS — with the exact keywords you&apos;re missing and the fixes that move the needle.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {jobs === null ? (
          <div className="flex h-11 items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your jobs…</div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            No ready jobs yet.
            <Link href="/dashboard/jobs/import" className="inline-flex items-center gap-1 text-primary hover:underline"><Plus className="h-4 w-4" /> Add a job</Link>
          </div>
        ) : (
          <>
            <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="h-11 flex-1 rounded-xl border border-border bg-card px-3 text-sm outline-none">
              <option value="">Select a job to score against…</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.parsed?.title ?? "Untitled role"}{j.parsed?.company ? ` — ${j.parsed.company}` : ""}</option>
              ))}
            </select>
            <button onClick={score} disabled={loading || !jobId} className="btn-cta inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm disabled:opacity-70">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Scanning…</> : <><Gauge className="h-4 w-4" /> Score</>}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {scan && (
        <div className="mt-8 space-y-6">
          {/* Score + breakdown */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-5">
              <div className="text-center">
                <p className={cn("text-5xl font-bold tabular-nums", scoreTone(scan.score))}>{scan.score}</p>
                <p className="text-xs text-muted-foreground">/ 100 ATS score</p>
              </div>
              <div className="flex-1 space-y-2.5">
                {BREAKDOWN.map((b) => {
                  const v = scan.breakdown?.[b.key] ?? 0;
                  return (
                    <div key={b.key}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{b.label}</span>
                        <span className="tabular-nums text-foreground">{v}/{b.max}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.min(100, (v / b.max) * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Keywords */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-[var(--cta)]">Missing keywords</h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {scan.keyword_coverage?.missing?.length
                  ? scan.keyword_coverage.missing.map((k) => <span key={k} className="rounded-full bg-[var(--cta)]/10 px-2.5 py-1 text-xs text-[var(--cta)]">{k}</span>)
                  : <span className="text-xs text-muted-foreground">None — great coverage.</span>}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-emerald-400">Matched keywords</h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {scan.keyword_coverage?.matched?.length
                  ? scan.keyword_coverage.matched.map((k) => <span key={k} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400"><Check className="h-3 w-3" /> {k}</span>)
                  : <span className="text-xs text-muted-foreground">—</span>}
              </div>
            </div>
          </div>

          {/* Fixes */}
          {scan.fixes?.length ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">Top fixes</h3>
              <ul className="mt-3 space-y-3">
                {scan.fixes.map((f, i) => (
                  <li key={i} className="text-sm">
                    <span className={cn("text-[11px] font-semibold uppercase", sevTone[f.severity] ?? "text-muted-foreground")}>{f.severity}</span>
                    <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">{f.section}</span>
                    <p className="mt-1 text-muted-foreground">{f.suggestion}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {jobId && (
            <Link href={`/dashboard/jobs/${jobId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              Optimize this resume & apply →
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
