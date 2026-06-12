"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2, TrendingUp, Users, Clock, Mic, BarChart3, Sparkles,
  Briefcase, CheckCircle2, FileText, Brain, Target, Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FunnelStage {
  stage: string; count: number; conversion_pct: number; of_total_pct: number;
}
interface VelocityItem { stage: string; avg_days: number }
interface SourceRow { source: string; applicants: number; avg_match_score: number; hired: number }
interface JobRow {
  job_id: string; title: string; applicants: number; screened: number;
  interview: number; offer: number; hired: number;
  avg_match_score: number | null; avg_days_to_hire: number | null;
}
interface OvertimePoint { date: string; applications: number; hires: number }
interface AnalyticsData {
  range: string;
  totals: {
    active_jobs: number; total_applicants: number; total_hired: number;
    avg_time_to_hire_days: number | null; offer_acceptance_rate: number | null;
    interview_completion_rate: number; avg_interview_score: number | null;
    ai_screened_pct: number; avg_match_score: number | null; avg_ats_score: number | null;
  };
  funnel: FunnelStage[];
  velocity: VelocityItem[];
  source_quality: SourceRow[];
  per_job: JobRow[];
  over_time: OvertimePoint[];
}

// ── Constants ─────────────────────────────────────────────────────────────────
const RANGES = [
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "12 months", value: "1y" },
  { label: "All time", value: "all" },
];

const STAGE_COLORS: Record<string, string> = {
  applied: "bg-blue-500", screened: "bg-purple-500",
  interview: "bg-amber-500", offer: "bg-cyan-500", hired: "bg-green-500",
};

function pctColor(n: number | null) {
  if (n === null) return "text-muted-foreground";
  if (n >= 70) return "text-green-400";
  if (n >= 40) return "text-amber-400";
  return "text-rose-400";
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ExecutiveAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30d");

  const load = useCallback((r: string) => {
    setLoading(true);
    fetch(`/api/enterprise/analytics/executive?range=${r}`)
      .then((res) => res.json())
      .then((j) => setData(j.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* Header + range selector */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Executive Analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground">Pipeline health, source quality, and hiring velocity.</p>
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  range === r.value
                    ? "bg-gradient-brand text-white shadow-glow"
                    : "text-muted-foreground hover:text-foreground",
                )}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && data && (
          <>
            {/* KPI row 1 — hiring */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Total applicants",    value: data.totals.total_applicants,   icon: Users,       color: "text-primary" },
                { label: "Total hired",          value: data.totals.total_hired,        icon: TrendingUp,  color: "text-green-400" },
                { label: "Avg time to hire",     value: data.totals.avg_time_to_hire_days !== null ? `${data.totals.avg_time_to_hire_days}d` : "—", icon: Clock, color: "text-amber-400" },
                { label: "Offer acceptance",     value: data.totals.offer_acceptance_rate !== null ? `${data.totals.offer_acceptance_rate}%` : "—", icon: FileText, color: "text-cyan-400" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={cn("h-4 w-4", color)} />
                    <p className="text-sm text-muted-foreground">{label}</p>
                  </div>
                  <p className="text-3xl font-bold tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            {/* KPI row 2 — AI + interviews */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "AI screened",         value: `${data.totals.ai_screened_pct}%`,   icon: Brain,       color: "text-purple-400" },
                { label: "Avg match score",      value: data.totals.avg_match_score !== null ? `${data.totals.avg_match_score}%` : "—",   icon: Target,      color: "text-blue-400" },
                { label: "Interview completion", value: `${data.totals.interview_completion_rate}%`, icon: Mic, color: "text-indigo-400" },
                { label: "Active jobs",          value: data.totals.active_jobs,             icon: Briefcase,   color: "text-rose-400" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={cn("h-4 w-4", color)} />
                    <p className="text-sm text-muted-foreground">{label}</p>
                  </div>
                  <p className="text-3xl font-bold tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Pipeline funnel */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-5 font-semibold">Pipeline funnel</h2>
                <div className="space-y-3">
                  {data.funnel.map(({ stage, count, conversion_pct, of_total_pct }, i) => (
                    <div key={stage}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="capitalize font-medium">{stage}</span>
                          {i > 0 && (
                            <span className={cn("text-xs tabular-nums", pctColor(conversion_pct))}>
                              {conversion_pct}% from prev
                            </span>
                          )}
                        </div>
                        <span className="tabular-nums font-bold">{count}</span>
                      </div>
                      <div className="h-7 w-full overflow-hidden rounded-lg bg-muted">
                        <div
                          className={cn("h-full rounded-lg transition-all duration-500 flex items-center px-3", STAGE_COLORS[stage])}
                          style={{ width: `${Math.max(count > 0 ? 6 : 0, of_total_pct)}%` }}>
                          {count > 0 && <span className="text-[11px] font-bold text-white">{of_total_pct}%</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Source quality */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-4 font-semibold">Source quality</h2>
                {data.source_quality.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No source data yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-border">
                      <tr>
                        {["Source","Applicants","Avg score","Hired"].map((h) => (
                          <th key={h} className="pb-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.source_quality.map((s) => (
                        <tr key={s.source}>
                          <td className="py-2.5 capitalize font-medium">{s.source}</td>
                          <td className="py-2.5 tabular-nums">{s.applicants}</td>
                          <td className="py-2.5">
                            <span className={cn("font-bold tabular-nums", s.avg_match_score >= 70 ? "text-green-400" : s.avg_match_score >= 50 ? "text-amber-400" : "text-muted-foreground")}>
                              {s.avg_match_score}%
                            </span>
                          </td>
                          <td className="py-2.5 tabular-nums">{s.hired}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Per-job breakdown */}
            {data.per_job.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-5 font-semibold flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  Per-job pipeline
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border">
                      <tr>
                        {["Job", "Applied", "Screened", "Interview", "Offer", "Hired", "Avg score", "Avg days"].map((h) => (
                          <th key={h} className="pb-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.per_job.map((job) => (
                        <tr key={job.job_id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 pr-4 font-medium max-w-[180px] truncate">{job.title}</td>
                          <td className="py-3 pr-4 tabular-nums">{job.applicants}</td>
                          <td className="py-3 pr-4">
                            <span className="tabular-nums">{job.screened}</span>
                            {job.applicants > 0 && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({Math.round((job.screened / job.applicants) * 100)}%)
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4 tabular-nums">{job.interview}</td>
                          <td className="py-3 pr-4 tabular-nums">{job.offer}</td>
                          <td className="py-3 pr-4">
                            {job.hired > 0
                              ? <span className="inline-flex items-center gap-1 text-green-400 font-semibold"><CheckCircle2 className="h-3 w-3" />{job.hired}</span>
                              : <span className="text-muted-foreground">0</span>}
                          </td>
                          <td className="py-3 pr-4">
                            {job.avg_match_score !== null
                              ? <span className={cn("font-bold tabular-nums", pctColor(job.avg_match_score))}>{job.avg_match_score}%</span>
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground tabular-nums">
                            {job.avg_days_to_hire !== null ? `${job.avg_days_to_hire}d` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Stage velocity + over-time chart */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Velocity */}
              {data.velocity.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-6">
                  <h2 className="mb-5 font-semibold flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    Pipeline velocity
                  </h2>
                  <div className="space-y-4">
                    {data.velocity.map((v) => (
                      <div key={v.stage}>
                        <p className="text-xs text-muted-foreground mb-1">{v.stage}</p>
                        <p className="text-2xl font-bold tabular-nums">
                          {v.avg_days}
                          <span className="ml-1 text-sm font-normal text-muted-foreground">days avg</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Over-time chart */}
              {data.over_time.length > 0 && (
                <div className={cn(
                  "rounded-2xl border border-border bg-card p-6",
                  data.velocity.length > 0 ? "lg:col-span-2" : "lg:col-span-3"
                )}>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-semibold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      Applications & hires over time
                    </h2>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-primary/60" />Applications</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />Hires</span>
                    </div>
                  </div>
                  {(() => {
                    const maxVal = Math.max(...data.over_time.map((d) => d.applications), 1);
                    return (
                      <div className="flex items-end gap-1 h-28">
                        {data.over_time.map(({ date, applications, hires }) => {
                          const appH = Math.max(applications > 0 ? 8 : 0, Math.round((applications / maxVal) * 100));
                          const hireH = Math.max(hires > 0 ? 4 : 0, Math.round((hires / maxVal) * 100));
                          const label = date.length === 7 ? date.slice(5) : date.slice(5);
                          return (
                            <div key={date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                              <div className="hidden group-hover:block absolute -top-9 left-1/2 -translate-x-1/2 z-10 rounded bg-foreground px-2 py-1 text-[10px] text-background whitespace-nowrap">
                                {label}: {applications} apps, {hires} hired
                              </div>
                              <div className="w-full flex items-end gap-0.5 h-24">
                                <div className="flex-1 rounded-t bg-primary/60 hover:bg-primary transition-colors" style={{ height: `${appH}%` }} />
                                <div className="flex-1 rounded-t bg-green-500/70 hover:bg-green-500 transition-colors" style={{ height: `${hireH}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* AI adoption spotlight */}
            {(data.totals.avg_ats_score !== null || data.totals.avg_interview_score !== null) && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-5 font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  AI adoption breakdown
                </h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Candidates AI-screened", value: `${data.totals.ai_screened_pct}%`, sub: "of all applicants" },
                    { label: "Avg AI match score",     value: data.totals.avg_match_score !== null ? `${data.totals.avg_match_score}%` : "—", sub: "overall fit" },
                    { label: "Avg ATS score",          value: data.totals.avg_ats_score !== null ? `${data.totals.avg_ats_score}%` : "—", sub: "keyword coverage" },
                    { label: "Avg interview score",    value: data.totals.avg_interview_score !== null ? `${data.totals.avg_interview_score}%` : "—", sub: "AI interview" },
                  ].map(({ label, value, sub }) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
                      <p className="text-[11px] text-muted-foreground">{sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </main>
  );
}
