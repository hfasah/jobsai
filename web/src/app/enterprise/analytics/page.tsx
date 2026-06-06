"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingUp, Users, Clock, Mic, BarChart3, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalyticsData {
  totals: {
    active_jobs: number; total_applicants: number; total_hired: number;
    avg_time_to_hire_days: number | null; interview_completion_rate: number;
    avg_interview_score: number | null;
  };
  funnel: Array<{ stage: string; count: number }>;
  source_quality: Array<{ source: string; applicants: number; avg_match_score: number; hired: number }>;
  applications_over_time: Array<{ date: string; count: number }>;
}

const STAGE_COLORS: Record<string, string> = {
  applied: "bg-blue-500", screened: "bg-purple-500", interview: "bg-amber-500",
  offer: "bg-cyan-500", hired: "bg-green-500",
};

export default function ExecutiveAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/enterprise/analytics/executive")
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <main className="flex flex-1 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </main>
  );

  if (!data) return null;

  const maxFunnel = Math.max(...data.funnel.map((f) => f.count), 1);

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Executive Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pipeline health, source quality, and hiring velocity.</p>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Total applicants",       value: data.totals.total_applicants,              icon: Users,     color: "text-primary" },
            { label: "Total hired",             value: data.totals.total_hired,                   icon: TrendingUp, color: "text-green-400" },
            { label: "Avg time to hire",        value: data.totals.avg_time_to_hire_days !== null ? `${data.totals.avg_time_to_hire_days}d` : "—", icon: Clock, color: "text-amber-400" },
            { label: "Interview completion",    value: `${data.totals.interview_completion_rate}%`, icon: Mic,       color: "text-blue-400" },
            { label: "Avg interview score",     value: data.totals.avg_interview_score !== null ? `${data.totals.avg_interview_score}%` : "—", icon: BarChart3, color: "text-purple-400" },
            { label: "Active jobs",             value: data.totals.active_jobs,                   icon: Sparkles,  color: "text-cyan-400" },
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
              {data.funnel.map(({ stage, count }) => (
                <div key={stage}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="capitalize font-medium">{stage}</span>
                    <span className="tabular-nums font-bold">{count}</span>
                  </div>
                  <div className="h-8 w-full overflow-hidden rounded-lg bg-muted">
                    <div
                      className={cn("h-full rounded-lg transition-all duration-500 flex items-center px-3", STAGE_COLORS[stage])}
                      style={{ width: `${Math.max(count > 0 ? 8 : 0, Math.round((count / maxFunnel) * 100))}%` }}>
                      {count > 0 && <span className="text-xs font-bold text-white">{Math.round((count / maxFunnel) * 100)}%</span>}
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
              <p className="text-sm text-muted-foreground">No source data yet. Share tracking links to see which channels perform best.</p>
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

        {/* Applications over time */}
        {data.applications_over_time.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-5 font-semibold">Applications — last 30 days</h2>
            <div className="flex items-end gap-1.5 h-24">
              {data.applications_over_time.map(({ date, count }) => {
                const maxCount = Math.max(...data.applications_over_time.map((d) => d.count), 1);
                const height = Math.max(4, Math.round((count / maxCount) * 100));
                return (
                  <div key={date} className="flex flex-1 flex-col items-center gap-1 group">
                    <div className="relative w-full">
                      <div className="hidden group-hover:block absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background whitespace-nowrap">
                        {count} on {date.slice(5)}
                      </div>
                    </div>
                    <div className="w-full rounded-t bg-primary/60 hover:bg-primary transition-colors" style={{ height: `${height}%` }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
