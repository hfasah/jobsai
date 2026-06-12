import { auth } from "@clerk/nextjs/server";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

const STAGES = ["applied", "screened", "interview", "offer", "hired"];

function rangeStart(range: string): string | null {
  const map: Record<string, number> = { "30d": 30, "90d": 90, "1y": 365 };
  const days = map[range];
  if (!days) return null;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function bucket(dateStr: string, range: string): string {
  const d = new Date(dateStr);
  if (range === "1y") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return dateStr.slice(0, 10);
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "executive_analytics");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const range = req.nextUrl.searchParams.get("range") ?? "30d";
  const since = rangeStart(range);

  const [jobsRes, appsRes, interviewsRes, offersRes] = await Promise.all([
    supabaseAdmin
      .from("enterprise_jobs")
      .select("id,title,status,created_at,published_at")
      .eq("org_id", org.id),

    supabaseAdmin
      .from("enterprise_applications")
      .select("id,job_id,stage,source,match_score,ats_score,ai_recommendation,created_at,stage_updated_at,screened_at")
      .eq("org_id", org.id)
      .then((r) => {
        if (!since) return r;
        return supabaseAdmin
          .from("enterprise_applications")
          .select("id,job_id,stage,source,match_score,ats_score,ai_recommendation,created_at,stage_updated_at,screened_at")
          .eq("org_id", org.id)
          .gte("created_at", since);
      }),

    supabaseAdmin
      .from("enterprise_interviews")
      .select("id,application_id,status,invited_at,completed_at,overall_score")
      .eq("org_id", org.id),

    supabaseAdmin
      .from("enterprise_offer_letters")
      .select("id,status,created_at,signed_at")
      .eq("org_id", org.id),
  ]);

  const jobs = jobsRes.data ?? [];
  const apps = appsRes.data ?? [];
  const interviews = interviewsRes.data ?? [];
  const offers = offersRes.data ?? [];

  // ── Funnel with conversion rates ────────────────────────────────────────────
  const stageCounts = STAGES.map((stage) => ({
    stage,
    count: apps.filter((a) => a.stage === stage || (stage === "hired" && a.stage === "hired")).length,
  }));
  // include rejected in "applied" denominator for conversion calc
  const totalEntered = apps.length;
  const funnel = stageCounts.map((s, i) => {
    const prev = i === 0 ? totalEntered : (stageCounts[i - 1]?.count ?? 0);
    return {
      ...s,
      conversion_pct: prev > 0 ? Math.round((s.count / prev) * 100) : 0,
      of_total_pct: totalEntered > 0 ? Math.round((s.count / totalEntered) * 100) : 0,
    };
  });

  // ── Offer acceptance rate ────────────────────────────────────────────────────
  const sentOffers = offers.filter((o) => o.status !== "draft").length;
  const signedOffers = offers.filter((o) => o.status === "signed").length;
  const offerAcceptanceRate = sentOffers > 0 ? Math.round((signedOffers / sentOffers) * 100) : null;

  // ── Stage velocity (avg days per stage) ─────────────────────────────────────
  // Only apps with screened_at can give us a screened duration
  const velocity: Array<{ stage: string; avg_days: number }> = [];
  const screened = apps.filter((a) => a.screened_at && a.created_at);
  if (screened.length > 0) {
    const avgApplied = screened.reduce((s, a) => {
      return s + (new Date(a.screened_at!).getTime() - new Date(a.created_at).getTime()) / 86_400_000;
    }, 0) / screened.length;
    velocity.push({ stage: "applied → screened", avg_days: Math.round(avgApplied * 10) / 10 });
  }

  const hired = apps.filter((a) => a.stage === "hired" && a.created_at && a.stage_updated_at);
  if (hired.length > 0) {
    const avgHire = hired.reduce((s, a) => {
      return s + (new Date(a.stage_updated_at).getTime() - new Date(a.created_at).getTime()) / 86_400_000;
    }, 0) / hired.length;
    velocity.push({ stage: "applied → hired", avg_days: Math.round(avgHire) });
  }

  // ── AI adoption ─────────────────────────────────────────────────────────────
  const screened2 = apps.filter((a) => a.screened_at !== null);
  const aiScreenedPct = apps.length > 0 ? Math.round((screened2.length / apps.length) * 100) : 0;
  const withMatchScore = apps.filter((a) => a.match_score !== null);
  const avgMatchScore = withMatchScore.length > 0
    ? Math.round(withMatchScore.reduce((s, a) => s + (a.match_score ?? 0), 0) / withMatchScore.length)
    : null;
  const withAts = apps.filter((a) => a.ats_score !== null);
  const avgAtsScore = withAts.length > 0
    ? Math.round(withAts.reduce((s, a) => s + (a.ats_score ?? 0), 0) / withAts.length)
    : null;

  // ── KPI totals ───────────────────────────────────────────────────────────────
  const avgTimeToHire = hired.length > 0
    ? Math.round(hired.reduce((s, a) => {
        return s + (new Date(a.stage_updated_at).getTime() - new Date(a.created_at).getTime()) / 86_400_000;
      }, 0) / hired.length)
    : null;
  const completedInterviews = interviews.filter((i) => i.status === "completed");
  const interviewCompletionRate = interviews.length > 0
    ? Math.round((completedInterviews.length / interviews.length) * 100)
    : 0;
  const avgInterviewScore = completedInterviews.length > 0
    ? Math.round(completedInterviews.reduce((s, i) => s + (i.overall_score ?? 0), 0) / completedInterviews.length)
    : null;

  // ── Per-job breakdown ────────────────────────────────────────────────────────
  const activeJobs = jobs.filter((j) => j.status === "active");
  const perJob = activeJobs.map((job) => {
    const jobApps = apps.filter((a) => a.job_id === job.id);
    const withScore = jobApps.filter((a) => a.match_score !== null);
    const jobHired = jobApps.filter((a) => a.stage === "hired");
    const avgDaysToHire = jobHired.length > 0
      ? Math.round(jobHired.reduce((s, a) => {
          return s + (new Date(a.stage_updated_at).getTime() - new Date(a.created_at).getTime()) / 86_400_000;
        }, 0) / jobHired.length)
      : null;
    return {
      job_id: job.id,
      title: job.title,
      applicants: jobApps.length,
      screened: jobApps.filter((a) => ["screened", "interview", "offer", "hired"].includes(a.stage)).length,
      interview: jobApps.filter((a) => ["interview", "offer", "hired"].includes(a.stage)).length,
      offer: jobApps.filter((a) => ["offer", "hired"].includes(a.stage)).length,
      hired: jobHired.length,
      avg_match_score: withScore.length > 0
        ? Math.round(withScore.reduce((s, a) => s + (a.match_score ?? 0), 0) / withScore.length)
        : null,
      avg_days_to_hire: avgDaysToHire,
    };
  }).sort((a, b) => b.applicants - a.applicants);

  // ── Source quality ───────────────────────────────────────────────────────────
  const sources = [...new Set(apps.map((a) => a.source).filter(Boolean))];
  const sourceQuality = sources.map((source) => {
    const srcApps = apps.filter((a) => a.source === source);
    const withScore2 = srcApps.filter((a) => a.match_score !== null);
    return {
      source,
      applicants: srcApps.length,
      avg_match_score: withScore2.length > 0
        ? Math.round(withScore2.reduce((s, a) => s + (a.match_score ?? 0), 0) / withScore2.length)
        : 0,
      hired: srcApps.filter((a) => a.stage === "hired").length,
    };
  }).sort((a, b) => b.avg_match_score - a.avg_match_score);

  // ── Over-time charts ─────────────────────────────────────────────────────────
  const appsByDay: Record<string, number> = {};
  const hiresByDay: Record<string, number> = {};

  for (const app of apps) {
    const key = bucket(app.created_at, range);
    appsByDay[key] = (appsByDay[key] ?? 0) + 1;
  }
  for (const app of apps.filter((a) => a.stage === "hired")) {
    const key = bucket(app.stage_updated_at, range);
    hiresByDay[key] = (hiresByDay[key] ?? 0) + 1;
  }

  const allKeys = [...new Set([...Object.keys(appsByDay), ...Object.keys(hiresByDay)])].sort();
  const overTime = allKeys.map((date) => ({
    date,
    applications: appsByDay[date] ?? 0,
    hires: hiresByDay[date] ?? 0,
  }));

  return NextResponse.json({
    data: {
      range,
      totals: {
        active_jobs: jobs.filter((j) => j.status === "active").length,
        total_applicants: apps.length,
        total_hired: apps.filter((a) => a.stage === "hired").length,
        avg_time_to_hire_days: avgTimeToHire,
        offer_acceptance_rate: offerAcceptanceRate,
        interview_completion_rate: interviewCompletionRate,
        avg_interview_score: avgInterviewScore,
        ai_screened_pct: aiScreenedPct,
        avg_match_score: avgMatchScore,
        avg_ats_score: avgAtsScore,
      },
      funnel,
      velocity,
      source_quality: sourceQuality,
      per_job: perJob,
      over_time: overTime,
    },
  });
}
