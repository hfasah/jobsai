import { supabaseAdmin } from "@/lib/supabase";

export interface ReportFilters { from?: string | null; to?: string | null; job?: string | null; department?: string | null; }

export async function computeReport(orgId: string, filters: ReportFilters) {
  const { from, to, job: jobFilter, department: deptFilter } = filters;

  const [jobsRes, appsRes, interviewsRes, refsRes, checksRes, onboardingRes] = await Promise.all([
    supabaseAdmin.from("enterprise_jobs").select("id,title,department,status,created_at,published_at,closes_at").eq("org_id", orgId),
    supabaseAdmin.from("enterprise_applications").select("id,job_id,stage,source,match_score,ats_score,ai_recommendation,created_at,stage_updated_at,screened_at").eq("org_id", orgId),
    supabaseAdmin.from("enterprise_interviews").select("id,application_id,status,overall_score,invited_at,completed_at").eq("org_id", orgId),
    supabaseAdmin.from("enterprise_references").select("id,application_id,status").eq("org_id", orgId),
    supabaseAdmin.from("enterprise_background_checks").select("id,application_id,status").eq("org_id", orgId),
    supabaseAdmin.from("enterprise_onboarding").select("id,application_id,status,start_date").eq("org_id", orgId),
  ]);

  let jobs = jobsRes.data ?? [];
  let apps = appsRes.data ?? [];
  const interviews = interviewsRes.data ?? [];
  const refs = refsRes.data ?? [];
  const checks = checksRes.data ?? [];
  const onboarding = onboardingRes.data ?? [];

  if (deptFilter) jobs = jobs.filter((j) => j.department === deptFilter);
  if (jobFilter) jobs = jobs.filter((j) => j.id === jobFilter);
  const jobIds = new Set(jobs.map((j) => j.id));
  apps = apps.filter((a) => jobIds.has(a.job_id));
  if (from) apps = apps.filter((a) => a.created_at >= from);
  if (to) apps = apps.filter((a) => a.created_at <= `${to}T23:59:59`);

  const appIds = new Set(apps.map((a) => a.id));
  const fInterviews = interviews.filter((i) => appIds.has(i.application_id));
  const fRefs = refs.filter((r) => appIds.has(r.application_id));
  const fChecks = checks.filter((c) => appIds.has(c.application_id));
  const fOnboarding = onboarding.filter((o) => appIds.has(o.application_id));

  const num = apps.length || 1;
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : null;
  const daysBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;

  const stages = ["applied", "screened", "interview", "offer", "hired"];
  const stageRank: Record<string, number> = { applied: 0, screened: 1, interview: 2, offer: 3, hired: 4, rejected: -1 };
  const reached = (s: string) => apps.filter((a) => stageRank[a.stage] >= stageRank[s] || a.stage === s).length;
  const funnel = stages.map((s, i) => {
    const count = reached(s);
    const prev = i === 0 ? count : reached(stages[i - 1]);
    return { stage: s, count, conversion: prev > 0 ? Math.round((count / prev) * 100) : 0 };
  });

  const hired = apps.filter((a) => a.stage === "hired");
  const avgTimeToHire = hired.length ? Math.round(avg(hired.map((a) => daysBetween(a.created_at, a.stage_updated_at)))!) : null;
  const screened = apps.filter((a) => a.screened_at);
  const avgTimeToScreen = screened.length ? Math.round(avg(screened.map((a) => daysBetween(a.created_at, a.screened_at!)))!) : null;
  const offers = apps.filter((a) => ["offer", "hired"].includes(a.stage)).length;
  const offerAcceptance = offers > 0 ? Math.round((hired.length / offers) * 100) : null;

  const byJob = jobs.map((j) => {
    const ja = apps.filter((a) => a.job_id === j.id);
    return {
      title: j.title, department: j.department ?? "—", status: j.status,
      applicants: ja.length, hired: ja.filter((a) => a.stage === "hired").length,
      avg_ats: avg(ja.filter((a) => a.ats_score != null).map((a) => a.ats_score!)),
      days_open: j.published_at ? Math.round(daysBetween(j.published_at, j.closes_at ?? new Date().toISOString())) : null,
    };
  }).sort((a, b) => b.applicants - a.applicants);

  const sources = [...new Set(apps.map((a) => a.source))];
  const bySource = sources.map((s) => {
    const sa = apps.filter((a) => a.source === s);
    return {
      source: s, applicants: sa.length, hired: sa.filter((a) => a.stage === "hired").length,
      avg_score: avg(sa.filter((a) => a.match_score != null).map((a) => a.match_score!)),
      conversion: sa.length ? Math.round((sa.filter((a) => a.stage === "hired").length / sa.length) * 100) : 0,
    };
  }).sort((a, b) => b.applicants - a.applicants);

  const depts = [...new Set(jobs.map((j) => j.department ?? "—"))];
  const byDept = depts.map((d) => {
    const dJobs = jobs.filter((j) => (j.department ?? "—") === d);
    const dIds = new Set(dJobs.map((j) => j.id));
    const da = apps.filter((a) => dIds.has(a.job_id));
    return { department: d, jobs: dJobs.length, applicants: da.length, hired: da.filter((a) => a.stage === "hired").length };
  }).sort((a, b) => b.applicants - a.applicants);

  const recDist = { strong_yes: 0, yes: 0, maybe: 0, no: 0 };
  for (const a of apps) if (a.ai_recommendation && a.ai_recommendation in recDist) recDist[a.ai_recommendation as keyof typeof recDist]++;

  const preboarding = {
    references_total: fRefs.length,
    references_completed: fRefs.filter((r) => r.status === "completed").length,
    checks_total: fChecks.length,
    checks_clear: fChecks.filter((c) => c.status === "clear").length,
    checks_flagged: fChecks.filter((c) => ["flagged", "failed"].includes(c.status)).length,
    cleared_to_start: fOnboarding.filter((o) => ["cleared", "completed"].includes(o.status)).length,
  };

  const completedInt = fInterviews.filter((i) => i.status === "completed");
  const interviewStats = {
    sent: fInterviews.length, completed: completedInt.length,
    completion_rate: fInterviews.length ? Math.round((completedInt.length / fInterviews.length) * 100) : 0,
    avg_score: avg(completedInt.filter((i) => i.overall_score != null).map((i) => i.overall_score!)),
  };

  const byDay: Record<string, number> = {};
  for (const a of apps) { const d = a.created_at.slice(0, 10); byDay[d] = (byDay[d] ?? 0) + 1; }
  const overTime = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

  return {
    filters_applied: { from, to, job: jobFilter, department: deptFilter },
    summary: {
      total_jobs: jobs.length, active_jobs: jobs.filter((j) => j.status === "active").length,
      total_applicants: apps.length, total_hired: hired.length,
      offer_acceptance_rate: offerAcceptance, avg_time_to_hire_days: avgTimeToHire, avg_time_to_screen_days: avgTimeToScreen,
      avg_ats_score: avg(apps.filter((a) => a.ats_score != null).map((a) => a.ats_score!)),
      avg_match_score: avg(apps.filter((a) => a.match_score != null).map((a) => a.match_score!)),
      avg_interview_score: interviewStats.avg_score, screened_pct: Math.round((screened.length / num) * 100),
    },
    funnel, by_job: byJob, by_source: bySource, by_department: byDept,
    recommendations: recDist, preboarding, interviews: interviewStats, applications_over_time: overTime,
    all_jobs: (jobsRes.data ?? []).map((j) => ({ id: j.id, title: j.title })),
    all_departments: [...new Set((jobsRes.data ?? []).map((j) => j.department).filter(Boolean))],
  };
}

export type ReportData = Awaited<ReturnType<typeof computeReport>>;

// Build an HTML email body for the report
export function reportEmailHtml(orgName: string, report: ReportData, note?: string): string {
  const s = report.summary;
  const cell = (v: string | number | null) => `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px">${v ?? "—"}</td>`;
  const th = (v: string) => `<th style="padding:6px 10px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;border-bottom:2px solid #eee">${v}</th>`;

  return `<div style="font-family:system-ui,sans-serif;max-width:680px;margin:0 auto;color:#0f172a">
    <h1 style="font-size:20px;margin:0 0 4px">${orgName} — Hiring Report</h1>
    <p style="color:#888;font-size:12px;margin:0 0 16px">Generated ${new Date().toLocaleString()}</p>
    ${note ? `<div style="background:#f5f3ff;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:14px">${note.replace(/\n/g, "<br>")}</div>` : ""}

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>
        <td style="padding:10px;background:#f8fafc;border-radius:8px"><div style="font-size:11px;color:#888">Applicants</div><div style="font-size:22px;font-weight:700">${s.total_applicants}</div></td>
        <td style="width:8px"></td>
        <td style="padding:10px;background:#f8fafc;border-radius:8px"><div style="font-size:11px;color:#888">Hired</div><div style="font-size:22px;font-weight:700">${s.total_hired}</div></td>
        <td style="width:8px"></td>
        <td style="padding:10px;background:#f8fafc;border-radius:8px"><div style="font-size:11px;color:#888">Offer acceptance</div><div style="font-size:22px;font-weight:700">${s.offer_acceptance_rate ?? "—"}${s.offer_acceptance_rate != null ? "%" : ""}</div></td>
        <td style="width:8px"></td>
        <td style="padding:10px;background:#f8fafc;border-radius:8px"><div style="font-size:11px;color:#888">Avg time to hire</div><div style="font-size:22px;font-weight:700">${s.avg_time_to_hire_days != null ? s.avg_time_to_hire_days + "d" : "—"}</div></td>
      </tr>
    </table>

    <h2 style="font-size:15px;margin:0 0 8px">Hiring funnel</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>${th("Stage")}${th("Count")}${th("Conversion")}</tr>
      ${report.funnel.map((f) => `<tr>${cell(f.stage)}${cell(f.count)}${cell(f.conversion + "%")}</tr>`).join("")}
    </table>

    <h2 style="font-size:15px;margin:0 0 8px">Job performance</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>${th("Job")}${th("Dept")}${th("Applicants")}${th("Hired")}${th("Avg ATS")}</tr>
      ${report.by_job.slice(0, 15).map((j) => `<tr>${cell(j.title)}${cell(j.department)}${cell(j.applicants)}${cell(j.hired)}${cell(j.avg_ats)}</tr>`).join("")}
    </table>

    <h2 style="font-size:15px;margin:0 0 8px">Source effectiveness</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>${th("Source")}${th("Applicants")}${th("Hired")}${th("Conversion")}</tr>
      ${report.by_source.map((s2) => `<tr>${cell(s2.source)}${cell(s2.applicants)}${cell(s2.hired)}${cell(s2.conversion + "%")}</tr>`).join("")}
    </table>

    <p style="color:#888;font-size:12px;border-top:1px solid #eee;padding-top:12px">Powered by <a href="https://jobsai.work" style="color:#2563eb">JobsAI.Work</a></p>
  </div>`;
}
