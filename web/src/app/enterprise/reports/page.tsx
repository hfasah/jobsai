"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2, Download, Filter, Briefcase, Users, TrendingUp, Clock,
  Target, CheckCircle2, ShieldCheck, BarChart3, Calendar, FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportData {
  summary: {
    total_jobs: number; active_jobs: number; total_applicants: number; total_hired: number;
    offer_acceptance_rate: number | null; avg_time_to_hire_days: number | null;
    avg_time_to_screen_days: number | null; avg_ats_score: number | null;
    avg_match_score: number | null; avg_interview_score: number | null; screened_pct: number;
  };
  funnel: { stage: string; count: number; conversion: number }[];
  by_job: { title: string; department: string; status: string; applicants: number; hired: number; avg_ats: number | null; days_open: number | null }[];
  by_source: { source: string; applicants: number; hired: number; avg_score: number | null; conversion: number }[];
  by_department: { department: string; jobs: number; applicants: number; hired: number }[];
  recommendations: { strong_yes: number; yes: number; maybe: number; no: number };
  preboarding: { references_total: number; references_completed: number; checks_total: number; checks_clear: number; checks_flagged: number; cleared_to_start: number };
  interviews: { sent: number; completed: number; completion_rate: number; avg_score: number | null };
  applications_over_time: { date: string; count: number }[];
  all_jobs: { id: string; title: string }[];
  all_departments: string[];
}

const STAGE_COLOR: Record<string, string> = {
  applied: "bg-blue-500", screened: "bg-purple-500", interview: "bg-amber-500", offer: "bg-cyan-500", hired: "bg-green-500",
};

function downloadCSV(filename: string, rows: (string | number | null)[][]) {
  const csv = rows.map((r) => r.map((c) => {
    const v = c === null || c === undefined ? "" : String(c);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function Kpi({ label, value, icon: Icon, hint }: { label: string; value: string | number; icon: React.ElementType; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, onExport, children }: { title: string; onExport?: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h2 className="font-semibold">{title}</h2>
        {onExport && (
          <button onClick={onExport} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [job, setJob] = useState("");
  const [dept, setDept] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (job) qs.set("job", job);
    if (dept) qs.set("department", dept);
    const res = await fetch(`/api/enterprise/reports?${qs}`);
    const json = await res.json();
    setData(json.data);
    setLoading(false);
  }, [from, to, job, dept]);

  useEffect(() => { load(); }, [load]);

  const exportFull = () => {
    if (!data) return;
    const rows: (string | number | null)[][] = [
      ["JobsAI Enterprise — HR Report", new Date().toLocaleString()],
      [],
      ["SUMMARY"],
      ["Total jobs", data.summary.total_jobs], ["Active jobs", data.summary.active_jobs],
      ["Total applicants", data.summary.total_applicants], ["Total hired", data.summary.total_hired],
      ["Offer acceptance %", data.summary.offer_acceptance_rate ?? "—"],
      ["Avg time to hire (days)", data.summary.avg_time_to_hire_days ?? "—"],
      ["Avg ATS score", data.summary.avg_ats_score ?? "—"],
      ["Avg interview score", data.summary.avg_interview_score ?? "—"],
      [],
      ["FUNNEL", "Count", "Conversion %"],
      ...data.funnel.map((f) => [f.stage, f.count, f.conversion]),
      [],
      ["BY JOB", "Department", "Status", "Applicants", "Hired", "Avg ATS", "Days open"],
      ...data.by_job.map((j) => [j.title, j.department, j.status, j.applicants, j.hired, j.avg_ats, j.days_open]),
      [],
      ["BY SOURCE", "Applicants", "Hired", "Avg score", "Conversion %"],
      ...data.by_source.map((s) => [s.source, s.applicants, s.hired, s.avg_score, s.conversion]),
    ];
    downloadCSV(`hr-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  if (loading && !data) return (
    <main className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></main>
  );
  if (!data) return null;

  const s = data.summary;
  const maxFunnel = Math.max(...data.funnel.map((f) => f.count), 1);
  const recTotal = Object.values(data.recommendations).reduce((a, b) => a + b, 0) || 1;

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><BarChart3 className="h-6 w-6 text-primary" /> Reports</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Pull hiring statistics and export them.</p>
          </div>
          <button onClick={exportFull} className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
            <FileSpreadsheet className="h-4 w-4" /> Export full report
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Filter className="h-3.5 w-3.5" /> Filters</span>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
            <span className="text-xs text-muted-foreground">to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <select value={dept} onChange={(e) => { setDept(e.target.value); setJob(""); }} className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All departments</option>
            {data.all_departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={job} onChange={(e) => setJob(e.target.value)} className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All jobs</option>
            {data.all_jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          {(from || to || job || dept) && (
            <button onClick={() => { setFrom(""); setTo(""); setJob(""); setDept(""); }} className="text-xs text-primary hover:underline">Clear</button>
          )}
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {/* KPI grid */}
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Kpi label="Total applicants" value={s.total_applicants} icon={Users} />
          <Kpi label="Hired" value={s.total_hired} icon={CheckCircle2} />
          <Kpi label="Active jobs" value={s.active_jobs} icon={Briefcase} hint={`${s.total_jobs} total`} />
          <Kpi label="Offer acceptance" value={s.offer_acceptance_rate !== null ? `${s.offer_acceptance_rate}%` : "—"} icon={TrendingUp} />
          <Kpi label="Avg time to hire" value={s.avg_time_to_hire_days !== null ? `${s.avg_time_to_hire_days}d` : "—"} icon={Clock} />
          <Kpi label="Avg ATS score" value={s.avg_ats_score !== null ? s.avg_ats_score : "—"} icon={Target} />
          <Kpi label="Avg interview" value={s.avg_interview_score !== null ? s.avg_interview_score : "—"} icon={BarChart3} />
          <Kpi label="Screened" value={`${s.screened_pct}%`} icon={CheckCircle2} />
        </div>

        {/* Funnel */}
        <Section title="Hiring funnel & conversion"
          onExport={() => downloadCSV("funnel.csv", [["Stage", "Count", "Conversion %"], ...data.funnel.map((f) => [f.stage, f.count, f.conversion])])}>
          <div className="space-y-3">
            {data.funnel.map((f) => (
              <div key={f.stage}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">{f.stage}</span>
                  <span className="text-muted-foreground"><span className="font-bold text-foreground tabular-nums">{f.count}</span> · {f.conversion}% from prev</span>
                </div>
                <div className="h-7 w-full overflow-hidden rounded-lg bg-muted">
                  <div className={cn("flex h-full items-center rounded-lg px-2", STAGE_COLOR[f.stage])} style={{ width: `${Math.max(f.count > 0 ? 6 : 0, (f.count / maxFunnel) * 100)}%` }}>
                    {f.count > 0 && <span className="text-[10px] font-bold text-white">{Math.round((f.count / maxFunnel) * 100)}%</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* By job */}
        <Section title="Job performance"
          onExport={() => downloadCSV("by-job.csv", [["Job", "Department", "Status", "Applicants", "Hired", "Avg ATS", "Days open"], ...data.by_job.map((j) => [j.title, j.department, j.status, j.applicants, j.hired, j.avg_ats, j.days_open])])}>
          {data.by_job.length === 0 ? <p className="text-sm text-muted-foreground">No jobs in range.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Job</th><th className="pb-2 font-medium">Dept</th><th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Applicants</th><th className="pb-2 font-medium">Hired</th><th className="pb-2 font-medium">Avg ATS</th><th className="pb-2 font-medium">Days open</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {data.by_job.map((j, i) => (
                    <tr key={i}>
                      <td className="py-2 font-medium">{j.title}</td>
                      <td className="py-2 text-muted-foreground">{j.department}</td>
                      <td className="py-2 capitalize text-muted-foreground">{j.status}</td>
                      <td className="py-2 tabular-nums">{j.applicants}</td>
                      <td className="py-2 tabular-nums">{j.hired}</td>
                      <td className="py-2 tabular-nums">{j.avg_ats ?? "—"}</td>
                      <td className="py-2 tabular-nums">{j.days_open ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* By source */}
          <Section title="Source effectiveness"
            onExport={() => downloadCSV("by-source.csv", [["Source", "Applicants", "Hired", "Avg score", "Conversion %"], ...data.by_source.map((s) => [s.source, s.applicants, s.hired, s.avg_score, s.conversion])])}>
            {data.by_source.length === 0 ? <p className="text-sm text-muted-foreground">No source data.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Source</th><th className="pb-2 font-medium">Apps</th><th className="pb-2 font-medium">Hired</th><th className="pb-2 font-medium">Avg</th><th className="pb-2 font-medium">Conv</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {data.by_source.map((s, i) => (
                    <tr key={i}>
                      <td className="py-2 font-medium capitalize">{s.source}</td>
                      <td className="py-2 tabular-nums">{s.applicants}</td>
                      <td className="py-2 tabular-nums">{s.hired}</td>
                      <td className="py-2 tabular-nums">{s.avg_score ?? "—"}</td>
                      <td className="py-2 tabular-nums">{s.conversion}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* By department */}
          <Section title="By department"
            onExport={() => downloadCSV("by-department.csv", [["Department", "Jobs", "Applicants", "Hired"], ...data.by_department.map((d) => [d.department, d.jobs, d.applicants, d.hired])])}>
            {data.by_department.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Department</th><th className="pb-2 font-medium">Jobs</th><th className="pb-2 font-medium">Applicants</th><th className="pb-2 font-medium">Hired</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {data.by_department.map((d, i) => (
                    <tr key={i}>
                      <td className="py-2 font-medium">{d.department}</td>
                      <td className="py-2 tabular-nums">{d.jobs}</td>
                      <td className="py-2 tabular-nums">{d.applicants}</td>
                      <td className="py-2 tabular-nums">{d.hired}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recommendations + interviews */}
          <Section title="Candidate quality">
            <p className="mb-2 text-xs font-medium text-muted-foreground">AI recommendation distribution</p>
            <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {([["strong_yes", "bg-green-500"], ["yes", "bg-blue-500"], ["maybe", "bg-amber-500"], ["no", "bg-red-500"]] as const).map(([k, c]) => {
                const pct = Math.round((data.recommendations[k] / recTotal) * 100);
                return pct > 0 ? <div key={k} className={c} style={{ width: `${pct}%` }} title={`${k}: ${data.recommendations[k]}`} /> : null;
              })}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" />Strong yes: <b className="tabular-nums">{data.recommendations.strong_yes}</b></span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" />Yes: <b className="tabular-nums">{data.recommendations.yes}</b></span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Maybe: <b className="tabular-nums">{data.recommendations.maybe}</b></span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />No: <b className="tabular-nums">{data.recommendations.no}</b></span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
              <div><p className="text-lg font-bold tabular-nums">{data.interviews.sent}</p><p className="text-[10px] text-muted-foreground">Interviews sent</p></div>
              <div><p className="text-lg font-bold tabular-nums">{data.interviews.completion_rate}%</p><p className="text-[10px] text-muted-foreground">Completion</p></div>
              <div><p className="text-lg font-bold tabular-nums">{data.interviews.avg_score ?? "—"}</p><p className="text-[10px] text-muted-foreground">Avg score</p></div>
            </div>
          </Section>

          {/* Pre-boarding */}
          <Section title="Pre-boarding">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">References</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{data.preboarding.references_completed}<span className="text-sm font-normal text-muted-foreground">/{data.preboarding.references_total}</span></p>
                <p className="text-[10px] text-muted-foreground">completed</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Background checks</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-green-400">{data.preboarding.checks_clear}<span className="text-sm font-normal text-muted-foreground">/{data.preboarding.checks_total}</span></p>
                <p className="text-[10px] text-muted-foreground">cleared{data.preboarding.checks_flagged > 0 ? ` · ${data.preboarding.checks_flagged} flagged` : ""}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-green-500/30 bg-green-500/5 p-3">
                <p className="flex items-center gap-1.5 text-xs text-green-400"><ShieldCheck className="h-3.5 w-3.5" /> Cleared to start</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{data.preboarding.cleared_to_start}</p>
              </div>
            </div>
          </Section>
        </div>

        {/* Applications over time */}
        {data.applications_over_time.length > 0 && (
          <Section title="Applications over time"
            onExport={() => downloadCSV("applications-over-time.csv", [["Date", "Applications"], ...data.applications_over_time.map((d) => [d.date, d.count])])}>
            <div className="flex h-28 items-end gap-1">
              {data.applications_over_time.map((d) => {
                const max = Math.max(...data.applications_over_time.map((x) => x.count), 1);
                return (
                  <div key={d.date} className="group flex flex-1 flex-col items-center gap-1">
                    <div className="relative w-full">
                      <div className="hidden group-hover:block absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background">{d.count} · {d.date.slice(5)}</div>
                    </div>
                    <div className="w-full rounded-t bg-primary/60 transition-colors hover:bg-primary" style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }} />
                  </div>
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </main>
  );
}
