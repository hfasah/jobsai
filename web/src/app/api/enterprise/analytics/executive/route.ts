import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const [jobsRes, appsRes, interviewsRes] = await Promise.all([
    supabaseAdmin.from("enterprise_jobs").select("id,title,status,created_at,published_at").eq("org_id", org.id),
    supabaseAdmin.from("enterprise_applications")
      .select("id,job_id,stage,source,match_score,created_at,stage_updated_at,screened_at")
      .eq("org_id", org.id),
    supabaseAdmin.from("enterprise_interviews")
      .select("id,application_id,status,invited_at,completed_at,overall_score")
      .eq("org_id", org.id),
  ]);

  const jobs = jobsRes.data ?? [];
  const apps = appsRes.data ?? [];
  const interviews = interviewsRes.data ?? [];

  // Pipeline funnel
  const funnel = ["applied", "screened", "interview", "offer", "hired"].map((stage) => ({
    stage,
    count: apps.filter((a) => a.stage === stage).length,
  }));

  // Source quality
  const sources = [...new Set(apps.map((a) => a.source))];
  const sourceQuality = sources.map((source) => {
    const srcApps = apps.filter((a) => a.source === source);
    const avg = srcApps.filter((a) => a.match_score !== null).reduce((s, a) => s + (a.match_score ?? 0), 0);
    const avgScore = srcApps.length > 0 ? Math.round(avg / srcApps.length) : 0;
    return {
      source,
      applicants: srcApps.length,
      avg_match_score: avgScore,
      hired: srcApps.filter((a) => a.stage === "hired").length,
    };
  }).sort((a, b) => b.avg_match_score - a.avg_match_score);

  // Time-to-hire (avg days from applied to hired)
  const hired = apps.filter((a) => a.stage === "hired");
  const avgTimeToHire = hired.length > 0
    ? Math.round(hired.reduce((s, a) => {
        const days = (new Date(a.stage_updated_at).getTime() - new Date(a.created_at).getTime()) / 86_400_000;
        return s + days;
      }, 0) / hired.length)
    : null;

  // Interview completion rate
  const completedInterviews = interviews.filter((i) => i.status === "completed").length;
  const interviewCompletionRate = interviews.length > 0
    ? Math.round((completedInterviews / interviews.length) * 100)
    : 0;

  // Average interview score
  const avgInterviewScore = completedInterviews > 0
    ? Math.round(interviews.filter((i) => i.status === "completed" && i.overall_score).reduce((s, i) => s + (i.overall_score ?? 0), 0) / completedInterviews)
    : null;

  // Applications over time (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const recentApps = apps.filter((a) => new Date(a.created_at) > thirtyDaysAgo);
  const byDay: Record<string, number> = {};
  for (const app of recentApps) {
    const day = app.created_at.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
  }

  return NextResponse.json({
    data: {
      totals: {
        active_jobs: jobs.filter((j) => j.status === "active").length,
        total_applicants: apps.length,
        total_hired: apps.filter((a) => a.stage === "hired").length,
        avg_time_to_hire_days: avgTimeToHire,
        interview_completion_rate: interviewCompletionRate,
        avg_interview_score: avgInterviewScore,
      },
      funnel,
      source_quality: sourceQuality,
      applications_over_time: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
    },
  });
}
