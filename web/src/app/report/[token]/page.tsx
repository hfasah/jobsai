import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { computeReport } from "@/lib/enterprise-reports";
import { Building2, Users, Briefcase, TrendingUp, Clock, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

const STAGE_COLOR: Record<string, string> = {
  applied: "bg-blue-500", screened: "bg-violet-500", interview: "bg-amber-500", offer: "bg-cyan-500", hired: "bg-green-500",
};

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const { data: share, error: shareErr } = await supabaseAdmin
    .from("enterprise_report_shares")
    .select("id,org_id,filters,label,expires_at,view_count")
    .eq("token", token)
    .maybeSingle();

  if (shareErr || !share) notFound();

  // Check expiry
  if (share.expires_at && new Date(share.expires_at as string) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8 text-center">
        <div>
          <Clock className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <h1 className="text-xl font-bold text-slate-800">This report link has expired</h1>
          <p className="mt-2 text-sm text-slate-500">Please ask the recruiter to generate a new link.</p>
        </div>
      </div>
    );
  }

  // Increment view count (fire-and-forget)
  supabaseAdmin
    .from("enterprise_report_shares")
    .update({ view_count: (share.view_count as number ?? 0) + 1 })
    .eq("id", share.id)
    .then(() => {});

  // Load org branding
  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("name,logo_url,brand_color,website")
    .eq("id", share.org_id as string)
    .maybeSingle();

  const report = await computeReport(share.org_id as string, (share.filters as Record<string, unknown>) ?? {});
  const brand = (org?.brand_color as string) || "#6d28d9";
  const { summary, funnel, by_job, by_source } = report;

  const funnelMax = Math.max(...funnel.map((f) => f.count), 1);
  const generatedAt = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {org?.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="h-9 object-contain" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: brand }}>
                <Building2 className="h-5 w-5 text-white" />
              </div>
            )}
            <div>
              <p className="font-bold text-slate-900">{org?.name ?? "Hiring Report"}</p>
              <p className="text-xs text-slate-500">{share.label as string}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Generated</p>
            <p className="text-xs font-medium text-slate-600">{generatedAt}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        {/* KPI grid */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Key metrics</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Active jobs" value={summary.active_jobs} sub={`${summary.total_jobs} total`} />
            <Kpi label="Total applicants" value={summary.total_applicants} />
            <Kpi label="Hired" value={summary.total_hired} sub={summary.offer_acceptance_rate != null ? `${summary.offer_acceptance_rate}% offer acceptance` : undefined} />
            <Kpi label="Avg time to hire" value={summary.avg_time_to_hire_days != null ? `${summary.avg_time_to_hire_days}d` : "—"} sub="calendar days" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Screened" value={`${summary.screened_pct}%`} sub="of all applicants" />
            <Kpi label="Avg AI match score" value={summary.avg_match_score != null ? `${summary.avg_match_score}%` : "—"} />
            <Kpi label="Avg ATS score" value={summary.avg_ats_score != null ? `${summary.avg_ats_score}%` : "—"} />
            <Kpi label="Avg screen time" value={summary.avg_time_to_screen_days != null ? `${summary.avg_time_to_screen_days}d` : "—"} sub="days to first screen" />
          </div>
        </section>

        {/* Pipeline funnel */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 flex items-center gap-2 font-semibold text-slate-900">
            <TrendingUp className="h-4 w-4" style={{ color: brand }} />
            Hiring pipeline
          </h2>
          <div className="space-y-2.5">
            {funnel.map((f) => (
              <div key={f.stage} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-right text-xs font-medium capitalize text-slate-500">{f.stage}</span>
                <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-6">
                  <div
                    className={`flex h-full items-center rounded-full px-2.5 text-[10px] font-bold text-white transition-all ${STAGE_COLOR[f.stage] ?? "bg-slate-400"}`}
                    style={{ width: `${Math.max(f.count > 0 ? 8 : 0, (f.count / funnelMax) * 100)}%` }}
                  >
                    {f.count > 0 ? f.count : ""}
                  </div>
                </div>
                <span className="w-12 shrink-0 text-xs tabular-nums text-slate-400">{f.conversion}%</span>
              </div>
            ))}
          </div>
        </section>

        {/* Jobs table */}
        {by_job.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <Briefcase className="h-4 w-4" style={{ color: brand }} />
              Job performance
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Department</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 text-right font-medium">Applicants</th>
                    <th className="pb-3 text-right font-medium">Hired</th>
                    <th className="pb-3 text-right font-medium">Avg ATS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {by_job.slice(0, 10).map((j, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-3 font-medium">{j.title}</td>
                      <td className="py-3 text-slate-500">{j.department}</td>
                      <td className="py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${j.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                          {j.status}
                        </span>
                      </td>
                      <td className="py-3 text-right tabular-nums">{j.applicants}</td>
                      <td className="py-3 text-right tabular-nums font-semibold text-green-600">{j.hired}</td>
                      <td className="py-3 text-right tabular-nums text-slate-500">{j.avg_ats ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Source breakdown */}
        {by_source.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4" style={{ color: brand }} />
              Candidate sources
            </h2>
            <div className="space-y-3">
              {by_source.slice(0, 8).map((s, i) => {
                const maxApps = Math.max(...by_source.map((x) => x.applicants), 1);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-right text-xs font-medium capitalize text-slate-600">{s.source}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-5">
                      <div
                        className="flex h-full items-center rounded-full px-2 text-[10px] font-bold text-white"
                        style={{ width: `${Math.max(8, (s.applicants / maxApps) * 100)}%`, background: brand }}
                      >
                        {s.applicants}
                      </div>
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs text-slate-400">{s.conversion}% conv</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Applications over time */}
        {report.applications_over_time.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold">Applications over time</h2>
            <div className="flex h-28 items-end gap-1">
              {report.applications_over_time.map((d) => {
                const max = Math.max(...report.applications_over_time.map((x) => x.count), 1);
                return (
                  <div key={d.date} className="group flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t transition-opacity hover:opacity-80"
                      style={{ height: `${Math.max(4, (d.count / max) * 100)}%`, background: brand }}
                      title={`${d.count} on ${d.date}`}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
          <div className="flex items-center justify-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span>Hiring data verified by <a href="https://jobsai.work" target="_blank" rel="noopener noreferrer" className="font-medium text-slate-600 hover:underline">JobsAI.Work</a></span>
          </div>
          {org?.website && (
            <a href={org.website} target="_blank" rel="noopener noreferrer" className="mt-1.5 block hover:underline" style={{ color: brand }}>
              {org.name} →
            </a>
          )}
          <p className="mt-2">This report is read-only and was shared with you by {org?.name ?? "the hiring team"}.</p>
        </footer>
      </main>
    </div>
  );
}
