"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertTriangle, X, Bot, Zap, Settings2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface JobLog {
  job_id: string;
  title: string;
  company: string;
  match_score: number | null;
  status: "submitted" | "manual_required" | "failed" | "blocked" | "skipped" | "below_threshold";
  resume_used: string | null;
  cover_letter_used: boolean;
}

interface Run {
  id: string;
  created_at: string;
  completed_at: string | null;
  jobs_found: number;
  jobs_applied: number;
  jobs_manual: number;
  jobs_failed: number;
  threshold_used: number;
  job_logs: JobLog[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  submitted:        { label: "Applied",           color: "text-desyn-success", icon: CheckCircle2 },
  manual_required:  { label: "Needs review",       color: "text-amber-500",     icon: AlertTriangle },
  failed:           { label: "Failed",             color: "text-destructive",   icon: X },
  blocked:          { label: "Blocked",            color: "text-muted-foreground", icon: X },
  skipped:          { label: "Skipped",            color: "text-muted-foreground", icon: X },
  below_threshold:  { label: "Below threshold",    color: "text-muted-foreground", icon: X },
};

function RunCard({ run }: { run: Run }) {
  const [open, setOpen] = useState(false);
  const date = new Date(run.created_at).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const time = new Date(run.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const hasActivity = run.jobs_applied > 0 || run.jobs_manual > 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          hasActivity ? "bg-desyn-success/10" : "bg-muted"
        )}>
          <Bot className={cn("h-4 w-4", hasActivity ? "text-desyn-success" : "text-muted-foreground")} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{date} <span className="font-normal text-muted-foreground">at {time}</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {run.jobs_found} job{run.jobs_found !== 1 ? "s" : ""} reviewed ·{" "}
            <span className="text-desyn-success font-medium">{run.jobs_applied} applied</span>
            {run.jobs_manual > 0 && <span className="text-amber-500"> · {run.jobs_manual} needs review</span>}
            {run.jobs_failed > 0 && <span className="text-destructive"> · {run.jobs_failed} failed</span>}
            <span className="text-muted-foreground"> · {run.threshold_used}% threshold</span>
          </p>
        </div>

        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && run.job_logs?.length > 0 && (
        <div className="border-t border-border divide-y divide-border">
          {run.job_logs.map((log) => {
            const cfg = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.skipped;
            const Icon = cfg.icon;
            return (
              <div key={log.job_id} className="flex items-center gap-3 px-5 py-3">
                <Icon className={cn("h-4 w-4 shrink-0", cfg.color)} />
                <div className="flex-1 min-w-0">
                  <Link href={`/dashboard/jobs/${log.job_id}`} className="text-sm font-medium hover:text-primary truncate block">
                    {log.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {log.company}
                    {log.match_score != null && <> · <span className="font-medium">{log.match_score}% match</span></>}
                    {log.cover_letter_used && <> · cover letter</>}
                    {log.resume_used && <> · résumé tailored</>}
                  </p>
                </div>
                <span className={cn("shrink-0 text-xs font-medium", cfg.color)}>{cfg.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {open && (!run.job_logs || run.job_logs.length === 0) && (
        <p className="px-5 py-4 text-sm text-muted-foreground border-t border-border">No jobs processed in this run.</p>
      )}
    </div>
  );
}

export default function AutoApplyPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auto-apply/logs")
      .then((r) => r.json())
      .then((j) => { if (j.data) setRuns(j.data); })
      .finally(() => setLoading(false));
  }, []);

  const totalApplied = runs.reduce((s, r) => s + (r.jobs_applied ?? 0), 0);
  const totalReview  = runs.reduce((s, r) => s + (r.jobs_manual  ?? 0), 0);
  const totalRuns    = runs.length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auto Apply Activity</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            JobsAI applies on your behalf every night — here&apos;s what ran while you were away.
          </p>
        </div>
        <Link href="/dashboard/preferences#auto-apply"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Settings2 className="h-3.5 w-3.5" /> Settings
        </Link>
      </div>

      {/* Stats */}
      {!loading && runs.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total runs", value: totalRuns, icon: Bot, color: "text-primary", bg: "bg-primary/10" },
            { label: "Auto-applied", value: totalApplied, icon: Zap, color: "text-desyn-success", bg: "bg-desyn-success/10" },
            { label: "Needs review", value: totalReview, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", bg)}>
                  <Icon className={cn("h-3.5 w-3.5", color)} />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Runs list */}
      {loading && (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading activity…
        </div>
      )}

      {!loading && runs.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Bot className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 font-semibold">No auto-apply runs yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Enable auto-apply in your{" "}
            <Link href="/dashboard/preferences" className="text-primary hover:underline">Preferences</Link>{" "}
            and JobsAI will search and apply for jobs every night while you sleep.
          </p>
        </div>
      )}

      {!loading && runs.length > 0 && (
        <div className="space-y-3">
          {runs.map((run) => <RunCard key={run.id} run={run} />)}
        </div>
      )}

      {/* Info box */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1.5">
        <p className="font-semibold text-foreground">How auto-apply works</p>
        <p>Every morning, JobsAI searches for new jobs matching your preferences, scores them against your résumé, and applies to any match above your threshold — automatically tailoring your résumé and writing a cover letter for each.</p>
        <p><span className="font-medium text-amber-500">Needs review</span> means the job board requires manual submission (e.g. LinkedIn/Indeed) — your tailored résumé and cover letter are ready, just click Apply in your jobs list.</p>
        <p>Thank-you replies and recruiter responses go to your email address on file.</p>
      </div>
    </div>
  );
}
