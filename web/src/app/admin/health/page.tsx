"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Activity } from "lucide-react";

interface Report { id: string; platform: string; status: string; summary: { counts?: { critical: number; warn: number; ok: number } }; created_at: string }
interface Finding { id: string; report_id: string; severity: string; area: string; title: string; detail: string | null; metric: Record<string, unknown> }

const SEV_STYLE: Record<string, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/5",
  warn: "border-amber-500/40 bg-amber-500/10",
  critical: "border-red-500/40 bg-red-500/10",
};
const SEV_ICON: Record<string, React.ReactNode> = {
  ok: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  critical: <XCircle className="h-4 w-4 text-red-500" />,
};
const STATUS_PILL: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-500",
  warn: "bg-amber-500/15 text-amber-500",
  critical: "bg-red-500/15 text-red-500",
};

export default function HealthPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [latestIds, setLatestIds] = useState<Record<string, string>>({});
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/health")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) { setError(j.error); return; }
        setReports(j.reports ?? []);
        setLatestIds(j.latest_ids ?? {});
        setFindings(j.findings ?? []);
      })
      .catch(() => setError("Failed to load health data."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading health reports…</div>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;

  const platforms: { key: string; label: string }[] = [
    { key: "consumer", label: "Consumer (jobsai.work)" },
    { key: "enterprise", label: "Enterprise (app.jobsai.work)" },
  ];

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Activity className="h-6 w-6 text-primary" /> Platform Health</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Weekly outcome checks (Mondays): did the work actually happen, not just did the crons run.
          Warn/critical findings also arrive by email.
        </p>
      </div>

      {reports.length === 0 && (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No reports yet. The first sweep runs Monday 07:00 UTC (consumer) and 07:30 UTC (enterprise).
          You can trigger them early from Vercel → Cron Jobs → /api/cron/health → Run.
        </p>
      )}

      {platforms.map(({ key, label }) => {
        const latest = reports.find((r) => r.id === latestIds[key]);
        const items = findings.filter((f) => f.report_id === latestIds[key]);
        if (!latest) return null;
        return (
          <section key={key}>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="font-semibold">{label}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${STATUS_PILL[latest.status] ?? ""}`}>{latest.status}</span>
              <span className="text-xs text-muted-foreground">{new Date(latest.created_at).toLocaleString()}</span>
            </div>
            <div className="space-y-2">
              {[...items].sort((a, b) => ["critical", "warn", "ok"].indexOf(a.severity) - ["critical", "warn", "ok"].indexOf(b.severity)).map((f) => (
                <div key={f.id} className={`flex items-start gap-3 rounded-xl border p-3.5 ${SEV_STYLE[f.severity] ?? "border-border"}`}>
                  <span className="mt-0.5 shrink-0">{SEV_ICON[f.severity]}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{f.area}</span>
                      {f.title}
                    </p>
                    {f.detail && <p className="mt-1 text-xs text-muted-foreground">{f.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {reports.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">History</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Platform</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Critical</th><th className="px-4 py-2.5">Warn</th>
              </tr></thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="px-4 py-2.5 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2.5 capitalize">{r.platform}</td>
                    <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_PILL[r.status] ?? ""}`}>{r.status}</span></td>
                    <td className="px-4 py-2.5 tabular-nums">{r.summary?.counts?.critical ?? 0}</td>
                    <td className="px-4 py-2.5 tabular-nums">{r.summary?.counts?.warn ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
