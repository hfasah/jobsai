import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const oneWeekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const oneDayAhead = new Date(Date.now() + 86_400_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const [stalledRes, pendingOffersRes, todayScheduleRes, sourcingRepliesRes, newHighScoreRes] = await Promise.all([
    supabaseAdmin.from("enterprise_applications")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("stage", "applied")
      .lte("created_at", twoWeeksAgo)
      .gte("match_score", 60),

    supabaseAdmin.from("enterprise_offers")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("status", "sent")
      .lte("created_at", oneWeekAgo),

    supabaseAdmin.from("enterprise_interview_schedule")
      .select("id,candidate_name,scheduled_at", { count: "exact" })
      .eq("org_id", org.id)
      .gte("scheduled_at", `${today}T00:00:00`)
      .lt("scheduled_at", `${today}T23:59:59`)
      .limit(3),

    supabaseAdmin.from("enterprise_sourcing_outreach")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .gte("replied_at", oneWeekAgo)
      .eq("reply_added_to_pipeline", false),

    supabaseAdmin.from("enterprise_applications")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .gte("created_at", oneWeekAgo)
      .gte("match_score", 80)
      .eq("stage", "applied"),
  ]);

  const nudges: Array<{ type: string; message: string; count: number; href: string; color: string }> = [];

  const stalledCount = stalledRes.count ?? 0;
  if (stalledCount > 0) {
    nudges.push({
      type: "stalled",
      message: `${stalledCount} strong candidate${stalledCount !== 1 ? "s" : ""} waiting >2 weeks`,
      count: stalledCount,
      href: "/enterprise/candidates",
      color: "amber",
    });
  }

  const newHighScore = newHighScoreRes.count ?? 0;
  if (newHighScore > 0) {
    nudges.push({
      type: "high_score",
      message: `${newHighScore} new applicant${newHighScore !== 1 ? "s" : ""} with 80%+ match score`,
      count: newHighScore,
      href: "/enterprise/candidates",
      color: "green",
    });
  }

  const todayInterviews = todayScheduleRes.data ?? [];
  if (todayInterviews.length > 0) {
    nudges.push({
      type: "interviews_today",
      message: `${todayInterviews.length} interview${todayInterviews.length !== 1 ? "s" : ""} scheduled today`,
      count: todayInterviews.length,
      href: "/enterprise/schedule",
      color: "violet",
    });
  }

  const repliesCount = sourcingRepliesRes.count ?? 0;
  if (repliesCount > 0) {
    nudges.push({
      type: "sourcing_replies",
      message: `${repliesCount} sourcing repl${repliesCount !== 1 ? "ies" : "y"} not added to pipeline`,
      count: repliesCount,
      href: "/enterprise/sourcing",
      color: "cyan",
    });
  }

  const offersCount = pendingOffersRes.count ?? 0;
  if (offersCount > 0) {
    nudges.push({
      type: "offers_pending",
      message: `${offersCount} offer${offersCount !== 1 ? "s" : ""} awaiting response for >1 week`,
      count: offersCount,
      href: "/enterprise/offers",
      color: "blue",
    });
  }

  return NextResponse.json({ nudges });
}
