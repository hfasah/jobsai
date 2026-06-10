import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  email: string;
  total_referrals: number;
  converted_referrals: number;
  total_tokens: number;
  conversion_rate: number;
}

// GET /api/referrals/leaderboard?period=month
// Get top referrers (this month or all-time)
export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") ?? "all-time";

  try {
    // Get all referral rewards grouped by user
    let query = supabaseAdmin
      .from("referral_rewards")
      .select("user_id, tokens, referrals(referrer_user_id, status, referred_user_id)");

    // Filter by period if needed
    if (period === "month") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte("awarded_at", thirtyDaysAgo.toISOString());
    }

    const { data: rewards } = await query;

    // Aggregate by user
    const userStats = new Map<
      string,
      {
        tokens: number;
        referrals: Set<string>;
        conversions: number;
      }
    >();

    if (rewards) {
      for (const reward of rewards) {
        const userId = reward.user_id;
        if (!userStats.has(userId)) {
          userStats.set(userId, {
            tokens: 0,
            referrals: new Set(),
            conversions: 0,
          });
        }

        const stats = userStats.get(userId)!;
        stats.tokens += reward.tokens;

        // Count unique referrals and conversions
        if (reward.referrals) {
          const ref = Array.isArray(reward.referrals)
            ? reward.referrals[0]
            : reward.referrals;
          if (ref) {
            stats.referrals.add(ref.referred_user_id);
            if (ref.status === "converted") {
              stats.conversions++;
            }
          }
        }
      }
    }

    // Build leaderboard entries
    const leaderboard: LeaderboardEntry[] = [];

    for (const [userId, stats] of userStats) {
      const totalReferrals = stats.referrals.size;
      const conversionRate =
        totalReferrals > 0
          ? Math.round((stats.conversions / totalReferrals) * 100)
          : 0;

      leaderboard.push({
        rank: 0, // Will be set after sorting
        user_id: userId,
        email: "", // Will be fetched below
        total_referrals: totalReferrals,
        converted_referrals: stats.conversions,
        total_tokens: stats.tokens,
        conversion_rate: conversionRate,
      });
    }

    // Sort by tokens (descending) then referrals (descending)
    leaderboard.sort((a, b) => {
      if (b.total_tokens !== a.total_tokens) {
        return b.total_tokens - a.total_tokens;
      }
      return b.total_referrals - a.total_referrals;
    });

    // Assign ranks
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Fetch user emails (for top 100)
    if (leaderboard.length > 0) {
      const userIds = leaderboard
        .slice(0, 100)
        .map((entry) => entry.user_id);
      const { data: users } = await supabaseAdmin
        .from("user_profiles")
        .select("id, email")
        .in("id", userIds);

      const emailMap = new Map(users?.map((u) => [u.id, u.email]) ?? []);

      for (const entry of leaderboard.slice(0, 100)) {
        entry.email = emailMap.get(entry.user_id) ?? "Unknown";
      }
    }

    return NextResponse.json({
      period,
      leaderboard: leaderboard.slice(0, 100), // Top 100
    });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
