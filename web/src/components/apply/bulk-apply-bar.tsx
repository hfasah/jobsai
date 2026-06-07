"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Zap, X, ChevronDown, Loader2, CheckCircle2, AlertTriangle, Puzzle, Sparkles, Coins,
} from "lucide-react";
import { boardForUrl } from "@/lib/job-boards";
import { runExtensionApply } from "@/lib/extension-bridge";

export interface BulkJob {
  id: string;
  title: string;
  company: string | null;
  url: string | null;
}

type JobStatus = "queued" | "optimizing" | "applying" | "applied" | "review" | "failed";
type Phase = "idle" | "optimizing" | "applying" | "done";

interface ResumeDoc { id: string; label: string; is_primary?: boolean; active_version_id?: string | null }

// Per-job token cost of the optimize pass (tailor + cover + ATS / cover + ATS).
const COST_TAILOR = 30, COST_COVER = 30, COST_ATS = 20;

async function postJSON(url: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: {} as Record<string, unknown> };
  }
}

export function BulkApplyBar({ jobs, onClear }: { jobs: BulkJob[]; onClear: () => void }) {
  const [resumes, setResumes] = useState<ResumeDoc[]>([]);
  const [resumeId, setResumeId] = useState<string>("");
  const [tailorEach, setTailorEach] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<Record<string, JobStatus>>({});
  const [notInstalled, setNotInstalled] = useState(false);
  const [outOfTokens, setOutOfTokens] = useState(false);
  const [tokens, setTokens] = useState<{ balance: number; plan: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/resumes")
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        const docs: ResumeDoc[] = (j.data ?? []).map((d: { id: string; label: string; is_primary?: boolean; active_version?: { id?: string } }) => ({
          id: d.id, label: d.label, is_primary: d.is_primary, active_version_id: d.active_version?.id ?? null,
        }));
        setResumes(docs);
        const primary = docs.find((d) => d.is_primary) ?? docs[0];
        if (primary) setResumeId(primary.id);
      })
      .catch(() => {});
    fetch("/api/tokens")
      .then((r) => r.json())
      .then((j) => { if (active && j.data) setTokens({ balance: j.data.balance, plan: j.data.plan }); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const versionId = resumes.find((r) => r.id === resumeId)?.active_version_id ?? null;
  const resumeLabel = resumes.find((r) => r.id === resumeId)?.label ?? null;
  const running = phase === "optimizing" || phase === "applying";

  const tokenEstimate = jobs.length * ((tailorEach ? COST_TAILOR : 0) + COST_COVER + COST_ATS);
  const directCount = useMemo(() => jobs.filter((j) => boardForUrl(j.url).applyMode === "direct").length, [jobs]);

  // Low on tokens for this run? (Free plan isn't metered, so only nudge paid/known balances.)
  const lowOnTokens = tokens != null && tokens.plan !== "free" && tokens.balance < tokenEstimate;
  const showUpsell = outOfTokens || (lowOnTokens && phase === "idle");

  const counts = useMemo(() => {
    const v = Object.values(progress);
    return {
      applied: v.filter((s) => s === "applied").length,
      review: v.filter((s) => s === "review").length,
      failed: v.filter((s) => s === "failed").length,
      done: v.filter((s) => s === "applied" || s === "review" || s === "failed").length,
    };
  }, [progress]);

  function setJob(id: string, status: JobStatus) {
    setProgress((p) => ({ ...p, [id]: status }));
  }
  function recordApplication(jobId: string, stage: "applied" | "saved") {
    postJSON("/api/applications", { job_id: jobId, stage });
  }

  async function runAutoApply() {
    const initial: Record<string, JobStatus> = {};
    jobs.forEach((j) => { initial[j.id] = "queued"; });
    setProgress(initial);
    setNotInstalled(false);
    setOutOfTokens(false);

    // ── Phase 1: optimize each job (résumé tailor + cover letter + ATS score) ──
    setPhase("optimizing");
    for (const job of jobs) {
      setJob(job.id, "optimizing");
      const payload = versionId ? { resume_version_id: versionId } : {};
      await postJSON(`/api/jobs/${job.id}/match`, payload);
      if (tailorEach) {
        const t = await postJSON(`/api/jobs/${job.id}/tailor`, payload);
        if (t.status === 402) setOutOfTokens(true);
      }
      const c = await postJSON(`/api/jobs/${job.id}/cover-letter`, payload);
      if (c.status === 402) setOutOfTokens(true);
      const a = await postJSON(`/api/jobs/${job.id}/ats-scan`, payload);
      if (a.status === 402) setOutOfTokens(true);
    }

    // ── Phase 2: apply ──
    setPhase("applying");
    const adapterJobs = jobs.filter((j) => j.url && boardForUrl(j.url).adapter);
    const serverJobs = jobs.filter((j) => !(j.url && boardForUrl(j.url).adapter));

    // Server / ATS path (Lever, Ashby, …) + manual fallbacks.
    for (const job of serverJobs) {
      setJob(job.id, "applying");
      if (!job.url) { setJob(job.id, "review"); recordApplication(job.id, "saved"); continue; }
      const r = await postJSON(`/api/jobs/${job.id}/apply`, {});
      if (r.status === 402) setOutOfTokens(true);
      const st = (r.json as { data?: { status?: string } }).data?.status;
      const mapped: JobStatus = st === "submitted" ? "applied" : st === "manual_required" ? "review" : "failed";
      setJob(job.id, mapped);
      recordApplication(job.id, mapped === "applied" ? "applied" : "saved");
    }

    // Extension path (LinkedIn/Indeed/…) — one batch, streamed progress.
    if (adapterJobs.length === 0) { setPhase("done"); return; }

    runExtensionApply(adapterJobs, { resumeLabel }, (e) => {
      if (e.type === "unavailable") {
        setNotInstalled(true);
        adapterJobs.forEach((j) => setJob(j.id, "review"));
        setPhase("done");
      } else if (e.type === "progress") {
        const mapped: JobStatus = e.status === "applied" ? "applied" : e.status === "failed" ? "failed" : e.status === "review" ? "review" : "applying";
        setJob(e.jobId, mapped);
        if (mapped === "applied" || mapped === "review" || mapped === "failed") {
          recordApplication(e.jobId, mapped === "applied" ? "applied" : "saved");
        }
      } else if (e.type === "done") {
        setPhase("done");
      }
    });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:left-60">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 py-3 sm:px-6">
        {/* Extension nudge (optional) */}
        {notInstalled && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <Puzzle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="font-medium text-foreground">Connect the JobsAI extension to auto-apply on LinkedIn/Indeed</p>
              <p className="text-xs text-muted-foreground">Your optimized resume & cover letter are saved — review each job and apply from its page.</p>
            </div>
            <Link href="/dashboard/extension" className="btn-cta inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-xs">Set up</Link>
            <button onClick={() => setNotInstalled(false)} className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Progress / phase line */}
        {phase !== "idle" && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {phase === "optimizing" && <span className="flex items-center gap-1.5 text-primary"><Sparkles className="h-3.5 w-3.5" /> Optimizing résumé & cover letter…</span>}
            {phase === "applying" && <span className="flex items-center gap-1.5 text-primary"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Applying…</span>}
            {phase === "done" && <span className="flex items-center gap-1.5 text-desyn-success"><CheckCircle2 className="h-3.5 w-3.5" /> Done</span>}
            <span className="flex items-center gap-1.5 text-desyn-success"><CheckCircle2 className="h-3.5 w-3.5" /> {counts.applied} applied</span>
            {counts.review > 0 && <span className="flex items-center gap-1.5 text-amber-500"><AlertTriangle className="h-3.5 w-3.5" /> {counts.review} to review</span>}
            {counts.failed > 0 && <span className="flex items-center gap-1.5 text-destructive"><X className="h-3.5 w-3.5" /> {counts.failed} failed</span>}
            <span className="text-muted-foreground">{counts.done}/{jobs.length}</span>
            {phase === "done" && <Link href="/dashboard/applications" className="ml-auto font-medium text-primary hover:underline">View results →</Link>}
          </div>
        )}
        {/* Low-on-tokens nudge — encourage upgrading (better value) or topping up. */}
        {showUpsell && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">
                {outOfTokens ? "You ran low on tokens mid-run." : "This run may use more tokens than you have."}
                {" "}This could be the one — don&apos;t let that stop you.
              </p>
              <p className="text-xs text-muted-foreground">
                {tokens != null && <>You have {tokens.balance.toLocaleString()} tokens; this run needs ~{tokenEstimate.toLocaleString()}. </>}
                Upgrading your plan gives you far more tokens per dollar than buying top-ups — the cheaper way to keep applying.
              </p>
            </div>
            <Link href="/dashboard/billing" className="btn-cta inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-xs">Upgrade &amp; save</Link>
            <Link href="/dashboard/billing" className="inline-flex h-8 shrink-0 items-center rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground">Add tokens</Link>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={onClear} disabled={running} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50">
            <span className="tabular-nums">{jobs.length}</span> selected <X className="h-3.5 w-3.5" />
          </button>

          {/* Profile (resume) */}
          <div className="relative">
            <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} disabled={running}
              className="h-9 appearance-none rounded-lg border border-border bg-background py-1.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
              title="Apply as this resume profile">
              {resumes.length === 0 ? <option value="">No résumé</option> : resumes.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* Tailor toggle */}
          <button onClick={() => !running && setTailorEach((v) => !v)} disabled={running}
            className={"inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 " + (tailorEach ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground")}
            title="Tailor the résumé to each job (uses tokens)">
            <Sparkles className="h-3.5 w-3.5" /> Tailor each
          </button>

          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
            <Coins className={"h-3.5 w-3.5 " + (lowOnTokens ? "text-amber-500" : "")} />
            ~{tokenEstimate.toLocaleString()} tokens
            {tokens != null && tokens.plan !== "free" && (
              <span className={lowOnTokens ? "text-amber-500" : ""}> · {tokens.balance.toLocaleString()} left</span>
            )}
            <span> · {directCount}/{jobs.length} 1-click</span>
          </span>

          <button onClick={runAutoApply} disabled={running || jobs.length === 0}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#f5c518] px-4 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60">
            {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Working…</> : <><Zap className="h-4 w-4" /> Optimize & Apply to All</>}
          </button>
        </div>
      </div>
    </div>
  );
}
