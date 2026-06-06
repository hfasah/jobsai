import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export const maxDuration = 30;

// Comprehensive HR reporting endpoint.
// Query params: from, to (ISO dates), job (id), department
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const jobFilter = url.searchParams.get("job");
  const deptFilter = url.searchParams.get("department");

  // Load everything for the org
  const [jobsRes, appsRes, interviewsRes, refsRes, checksRes, onboardingRes] = await Promise.all([
    supabaseAdmin.from("enterprise_jobs").select("id,title,department,status,created_at,published_at,closes_at").eq("org_id", org.id),
    supabaseAdmin.from("enterprise_applications").select("id,job_id,stage,source,match_score,ats_score,ai_recommendation,created_at,stage_updated_at,screened_at").eq("org_id", org.id),
    supabaseAdmin.from("enterprise_interviews").select("id,application_id,status,overall_score,invited_at,completed_at").eq("org_id", org.id),
    supabaseAdmin.from("enterprise_references").select("id,application_id,status").eq("org_id", org.id),
    supabaseAdmin.from("enterprise_background_checks").select("id,application_id,status").eq("org_id", org.id),
    supabaseAdmin.from("enterprise_onboarding").select("id,application_id,status,start_date").eq("org_id", org.id),
  ]);

  let jobs = jobsRes.data ?? [];
  let apps = appsRes.data ?? [];
  const interviews = interviewsRes.data ?? [];
  const refs = refsRes.data ?? [];
  const checks = checksRes.data ?? [];
  const onboarding = onboardingRes.data ?? [];

  // Apply filters
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

  // ── Funnel + conversion ──────────────────────────────────────────────────────
  const stages = ["applied", "screened", "interview", "offer", "hired"];
  // count candidates who reached at least each stage
  const stageRank: Record<string, number> = { applied: 0, screened: 1, interview: 2, offer: 3, hired: 4, rejected: -1 };
  const reached = (s: string) => apps.filter((a) => stageRank[a.stage] >= stageRank[s] || a.stage === s).length;
  const funnel = stages.map((s, i) => {
    const count = reached(s);
    const prev = i === 0 ? count : reached(stages[i - 1]);
    return { stage: s, count, conversion: prev > 0 ? Math.round((count / prev) * 100) : 0 };
  });

  // ── Time metrics ─────────────────────────────────────────────────────────────
  const hired = apps.filter((a) => a.stage === "hired");
  const avgTimeToHire = hired.length ? Math.round(avg(hired.map((a) => daysBetween(a.created_at, a.stage_updated_at)))!) : null;
  const screened = apps.filter((a) => a.screened_at);
  const avgTimeToScreen = screened.length ? Math.round(avg(screened.map((a) => daysBetween(a.created_at, a.screened_at!)))!) : null;

  // ── Offer acceptance ─────────────────────────────────────────────────────────
  const offers = apps.filter((a) => ["offer", "hired"].includes(a.stage)).length;
  const offerAcceptance = offers > 0 ? Math.round((hired.length / offers) * 100) : null;

  // ── By job ───────────────────────────────────────────────────────────────────
  const byJob = jobs.map((j) => {
    const ja = apps.filter((a) => a.job_id === j.id);
    return {
      title: j.title, department: j.department ?? "—", status: j.status,
      applicants: ja.length,
      hired: ja.filter((a) => a.stage === "hired").length,
      avg_ats: avg(ja.filter((a) => a.ats_score != null).map((a) => a.ats_score!)),
      days_open: j.published_at ? Math.round(daysBetween(j.published_at, j.closes_at ?? new Date().toISOString())) : null,
    };
  }).sort((a, b) => b.applicants - a.applicants);

  // ── By source ────────────────────────────────────────────────────────────────
  const sources = [...new Set(apps.map((a) => a.source))];
  const bySource = sources.map((s) => {
    const sa = apps.filter((a) => a.source === s);
    return {
      source: s, applicants: sa.length,
      hired: sa.filter((a) => a.stage === "hired").length,
      avg_score: avg(sa.filter((a) => a.match_score != null).map((a) => a.match_score!)),
      conversion: sa.length ? Math.round((sa.filter((a) => a.stage === "hired").length / sa.length) * 100) : 0,
    };
  }).sort((a, b) => b.applicants - a.applicants);

  // ── By department ────────────────────────────────────────────────────────────
  const depts = [...new Set(jobs.map((j) => j.department ?? "—"))];
  const byDept = depts.map((d) => {
    const dJobs = jobs.filter((j) => (j.department ?? "—") === d);
    const dIds = new Set(dJobs.map((j) => j.id));
    const da = apps.filter((a) => dIds.has(a.job_id));
    return { department: d, jobs: dJobs.length, applicants: da.length, hired: da.filter((a) => a.stage === "hired").length };
  }).sort((a, b) => b.applicants - a.applicants);

  // ── Recommendations distribution ─────────────────────────────────────────────
  const recDist = { strong_yes: 0, yes: 0, maybe: 0, no: 0 };
  for (const a of apps) if (a.ai_recommendation && a.ai_recommendation in recDist) recDist[a.ai_recommendation as keyof typeof recDist]++;

  // ── Pre-boarding ─────────────────────────────────────────────────────────────
  const preboarding = {
    references_total: fRefs.length,
    references_completed: fRefs.filter((r) => r.status === "completed").length,
    checks_total: fChecks.length,
    checks_clear: fChecks.filter((c) => c.status === "clear").length,
    checks_flagged: fChecks.filter((c) => ["flagged", "failed"].includes(c.status)).length,
    cleared_to_start: fOnboarding.filter((o) => ["cleared", "completed"].includes(o.status)).length,
  };

  // ── Interview stats ──────────────────────────────────────────────────────────
  const completedInt = fInterviews.filter((i) => i.status === "completed");
  const interviewStats = {
    sent: fInterviews.length,
    completed: completedInt.length,
    completion_rate: fInterviews.length ? Math.round((completedInt.length / fInterviews.length) * 100) : 0,
    avg_score: avg(completedInt.filter((i) => i.overall_score != null).map((i) => i.overall_score!)),
  };

  // ── Applications over time (daily, within range or last 30d) ─────────────────
  const byDay: Record<string, number> = {};
  for (const a of apps) { const d = a.created_at.slice(0, 10); byDay[d] = (byDay[d] ?? 0) + 1; }
  const overTime = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

  return NextResponse.json({
    data: {
      filters_applied: { from, to, job: jobFilter, department: deptFilter },
      summary: {
        total_jobs: jobs.length,
        active_jobs: jobs.filter((j) => j.status === "active").length,
        total_applicants: apps.length,
        total_hired: hired.length,
        offer_acceptance_rate: offerAcceptance,
        avg_time_to_hire_days: avgTimeToHire,
        avg_time_to_screen_days: avgTimeToScreen,
        avg_ats_score: avg(apps.filter((a) => a.ats_score != null).map((a) => a.ats_score!)),
        avg_match_score: avg(apps.filter((a) => a.match_score != null).map((a) => a.match_score!)),
        avg_interview_score: interviewStats.avg_score,
        screened_pct: Math.round((screened.length / num) * 100),
      },
      funnel,
      by_job: byJob,
      by_source: bySource,
      by_department: byDept,
      recommendations: recDist,
      preboarding,
      interviews: interviewStats,
      applications_over_time: overTime,
      // for filter dropdowns
      all_jobs: (jobsRes.data ?? []).map((j) => ({ id: j.id, title: j.title })),
      all_departments: [...new Set((jobsRes.data ?? []).map((j) => j.department).filter(Boolean))],
    },
  });
}
