import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { STAGE_LABELS } from "@/types/application";
import type { AnalyticsData, ScoreBucket, WeekActivity } from "@/types/analytics";

const SCORE_BUCKETS: ScoreBucket[] = [
  { label: "76 – 100", min: 76, max: 100, count: 0 },
  { label: "51 – 75",  min: 51, max: 75,  count: 0 },
  { label: "26 – 50",  min: 26, max: 50,  count: 0 },
  { label: "0 – 25",   min: 0,  max: 25,  count: 0 },
];

function mondayOf(d: Date): string {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diff);
  return mon.toISOString().slice(0, 10);
}

function weekLabel(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Fetch all base data in parallel ─────────────────────────────────────────
  const [jobsRes, applicationsRes, atsRes, tailorRes, coverRes, prepRes] = await Promise.all([
    supabaseAdmin.from("jobs").select("id, created_at").eq("user_id", userId),
    supabaseAdmin.from("applications").select("stage, created_at").eq("user_id", userId),
    supabaseAdmin.from("ats_scans").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabaseAdmin.from("tailored_resumes").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabaseAdmin.from("cover_letters").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabaseAdmin.from("interview_preps").select("*", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const jobs = jobsRes.data ?? [];
  const applications = applicationsRes.data ?? [];
  const jobIds = jobs.map((j) => j.id);

  // ── Fetch job matches only when there are jobs ───────────────────────────────
  const matchesData =
    jobIds.length > 0
      ? (
          await supabaseAdmin
            .from("job_matches")
            .select("match_score, missing_keywords, matched_keywords")
            .in("job_id", jobIds)
        ).data ?? []
      : [];

  // ── Summary ──────────────────────────────────────────────────────────────────
  const scores = matchesData.map((m) => m.match_score as number);
  const avg_match_score =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const stageMap = new Map<string, number>();
  for (const a of applications) {
    stageMap.set(a.stage, (stageMap.get(a.stage) ?? 0) + 1);
  }

  const summary = {
    total_jobs: jobs.length,
    avg_match_score,
    total_applications: applications.length,
    active_applications: applications.filter((a) => a.stage !== "rejected").length,
    offers: stageMap.get("offer") ?? 0,
  };

  // ── Applications by stage ────────────────────────────────────────────────────
  const applications_by_stage = (
    ["saved", "applied", "interviewing", "offer", "rejected"] as const
  ).map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: stageMap.get(stage) ?? 0,
  }));

  // ── Match score distribution ─────────────────────────────────────────────────
  const match_distribution = SCORE_BUCKETS.map((b) => ({
    ...b,
    count: scores.filter((s) => s >= b.min && s <= b.max).length,
  }));

  // ── Skill frequency ──────────────────────────────────────────────────────────
  function topSkills(field: "missing_keywords" | "matched_keywords", n = 10) {
    const freq = new Map<string, number>();
    for (const m of matchesData) {
      const list = (m[field] as string[]) ?? [];
      for (const skill of list) {
        const k = skill.trim().toLowerCase();
        if (k) freq.set(k, (freq.get(k) ?? 0) + 1);
      }
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([skill, count]) => ({ skill, count }));
  }

  // ── Weekly activity (last 5 weeks) ───────────────────────────────────────────
  const now = new Date();
  const weekKeys: string[] = [];
  for (let i = 4; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i * 7);
    weekKeys.push(mondayOf(d));
  }

  const jobsByWeek = new Map<string, number>();
  for (const j of jobs) {
    const k = mondayOf(new Date(j.created_at));
    jobsByWeek.set(k, (jobsByWeek.get(k) ?? 0) + 1);
  }

  const appsByWeek = new Map<string, number>();
  for (const a of applications) {
    const k = mondayOf(new Date(a.created_at));
    appsByWeek.set(k, (appsByWeek.get(k) ?? 0) + 1);
  }

  const activity_by_week: WeekActivity[] = weekKeys.map((wk) => ({
    week: weekLabel(wk),
    jobs: jobsByWeek.get(wk) ?? 0,
    applications: appsByWeek.get(wk) ?? 0,
  }));

  // ── Assemble response ────────────────────────────────────────────────────────
  const data: AnalyticsData = {
    summary,
    applications_by_stage,
    match_distribution,
    top_missing_skills: topSkills("missing_keywords"),
    top_matched_skills: topSkills("matched_keywords"),
    activity_by_week,
    ai_usage: {
      ats_scans: atsRes.count ?? 0,
      tailored_resumes: tailorRes.count ?? 0,
      cover_letters: coverRes.count ?? 0,
      interview_preps: prepRes.count ?? 0,
    },
  };

  return NextResponse.json({ data });
}
