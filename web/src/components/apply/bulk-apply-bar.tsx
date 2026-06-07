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
  /** Fallback listing text for import-first mode (search results not yet imported). */
  text?: string;
}

type JobStatus = "queued" | "importing" | "optimizing" | "applying" | "applied" | "review" | "failed";
type Phase = "idle" | "importing" | "optimizing" | "applying" | "done";

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

export function BulkApplyBar({ jobs, onClear, importFirst = false }: { jobs: BulkJob[]; onClear: () => void; importFirst?: boolean }) {
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
  const running = phase === "importing" || phase === "optimizing" || phase === "applying";

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

  const isFree = tokens?.plan === "free";

  async function runAutoApply() {
    // Applying is a paid feature — block free up front (also saves optimize cost).
    if (isFree) { setOutOfTokens(true); return; }

    const initial: Record<string, JobStatus> = {};
    jobs.forEach((j) => { initial[j.id] = "queued"; });
    setProgress(initial);
    setNotInstalled(false);
    setOutOfTokens(false);

    // Progress is keyed by the incoming BulkJob.id (stable). For search results we
    // must first import each to get a JobsAI job id; `jobId` is what the per-job
    // endpoints and the extension operate on.
    type Prepared = { key: string; jobId: string; url: string | null; title: string; company: string | null };
    let prepared: Prepared[] = [];

    // ── Phase 0: import (search results only) ──
    if (importFirst) {
      setPhase("importing");
      for (const job of jobs) {
        setJob(job.id, "importing");
        const res = await postJSON("/api/jobs/import", { url: job.url, text: job.text ?? "" });
        const jobId = (res.json as { job_id?: string }).job_id;
        if (res.ok && jobId) prepared.push({ key: job.id, jobId, url: job.url, title: job.title, company: job.company });
        else setJob(job.id, "failed");
      }
    } else {
      prepared = jobs.map((j) => ({ key: j.id, jobId: j.id, url: j.url, title: j.title, company: j.company }));
    }

    // ── Phase 1: optimize each job (résumé tailor + cover letter + ATS score) ──
    setPhase("optimizing");
    for (const p of prepared) {
      setJob(p.key, "optimizing");
      const payload = versionId ? { resume_version_id: versionId } : {};
      const noteSpend = (r: { status: number; json: Record<string, unknown> }) => {
        if (r.status === 402) setOutOfTokens(true);
        if (typeof r.json.balance === "number") setTokens((prev) => (prev ? { ...prev, balance: r.json.balance as number } : prev));
      };
      await postJSON(`/api/jobs/${p.jobId}/match`, payload);
      if (tailorEach) noteSpend(await postJSON(`/api/jobs/${p.jobId}/tailor`, payload));
      noteSpend(await postJSON(`/api/jobs/${p.jobId}/cover-letter`, payload));
      noteSpend(await postJSON(`/api/jobs/${p.jobId}/ats-scan`, payload));
    }

    // ── Phase 2: apply ──
    setPhase("applying");
    const adapterJobs = prepared.filter((p) => p.url && boardForUrl(p.url).adapter);
    const serverJobs = prepared.filter((p) => !(p.url && boardForUrl(p.url).adapter));

    // Server / ATS path (Lever, Ashby, …) + manual fallbacks.
    for (const p of serverJobs) {
      setJob(p.key, "applying");
      if (!p.url) { setJob(p.key, "review"); recordApplication(p.jobId, "saved"); continue; }
      const r = await postJSON(`/api/jobs/${p.jobId}/apply`, {});
      if (r.status === 402) setOutOfTokens(true);
      const st = (r.json as { data?: { status?: string } }).data?.status;
      const mapped: JobStatus = st === "submitted" ? "applied" : st === "manual_required" ? "review" : "failed";
      setJob(p.key, mapped);
      recordApplication(p.jobId, mapped === "applied" ? "applied" : "saved");
    }

    // Extension path (LinkedIn/Indeed/…) — one batch, streamed progress.
    if (adapterJobs.length === 0) { setPhase("done"); return; }

    const keyByJobId = new Map(adapterJobs.map((p) => [p.jobId, p.key]));
    runExtensionApply(
      adapterJobs.map((p) => ({ id: p.jobId, url: p.url, title: p.title, company: p.company })),
      { resumeLabel },
      (e) => {
        if (e.type === "unavailable") {
          setNotInstalled(true);
          adapterJobs.forEach((p) => setJob(p.key, "review"));
          setPhase("done");
        } else if (e.type === "progress") {
          const key = keyByJobId.get(e.jobId) ?? e.jobId;
          const mapped: JobStatus = e.status === "applied" ? "applied" : e.status === "failed" ? "failed" : e.status === "review" ? "review" : "applying";
          setJob(key, mapped);
          if (mapped === "applied" || mapped === "review" || mapped === "failed") {
            recordApplication(e.jobId, mapped === "applied" ? "applied" : "saved");
          }
        } else if (e.type === "done") {
          setPhase("done");
        }
      }
    );
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
            {phase === "importing" && <span className="flex items-center gap-1.5 text-primary"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing jobs…</span>}
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
        {/* Free → applying is paid. Paid + low balance → upgrade (better value) or top up. */}
        {showUpsell && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              {isFree ? (
                <>
                  <p className="font-medium text-foreground">Applying to jobs is a paid feature — this could be the one, don&apos;t miss it.</p>
                  <p className="text-xs text-muted-foreground">Upgrade to Pro to auto-apply, tailor your résumé, and generate cover letters across every job you pick.</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">
                    {outOfTokens ? "You ran low on tokens mid-run." : "This run may use more tokens than you have."}
                    {" "}This could be the one — don&apos;t let that stop you.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tokens != null && <>You have {tokens.balance.toLocaleString()} tokens; this run needs ~{tokenEstimate.toLocaleString()}. </>}
                    Upgrading your plan gives you far more tokens per dollar than buying top-ups — the cheaper way to keep applying.
                  </p>
                </>
              )}
            </div>
            <Link href="/dashboard/billing" className="btn-cta inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-xs">{isFree ? "Upgrade to apply" : "Upgrade & save"}</Link>
            {!isFree && <Link href="/dashboard/billing" className="inline-flex h-8 shrink-0 items-center rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground">Add tokens</Link>}
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
