import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;

// GET /api/referrals/stats
// Get referral stats for current user
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Get referral code (create if doesn't exist)
    let { data: referrals } = await supabaseAdmin
      .from("referrals")
      .select("referral_code")
      .eq("referrer_user_id", userId)
      .limit(1)
      .single();

    let referralCode: string;
    if (!referrals) {
      // Generate referral code from user ID
      referralCode = `USER${userId.slice(0, 8).toUpperCase()}`;

      // Create first referral record with the code
      await supabaseAdmin.from("referrals").insert({
        referrer_user_id: userId,
        referred_user_id: userId, // Placeholder
        referral_code: referralCode,
        status: "pending",
      });
    } else {
      referralCode = referrals.referral_code;
    }

    // Get stats
    const { data: allReferrals } = await supabaseAdmin
      .from("referrals")
      .select("status, plan_purchased")
      .eq("referrer_user_id", userId);

    const { data: rewards } = await supabaseAdmin
      .from("referral_rewards")
      .select("tokens")
      .eq("user_id", userId);

    const total = allReferrals?.length ?? 0;
    const converted = allReferrals?.filter((r) => r.status === "converted").length ?? 0;
    const totalTokens = rewards?.reduce((sum, r) => sum + r.tokens, 0) ?? 0;

    return NextResponse.json({
      referral_code: referralCode,
      total_referrals: total,
      converted_referrals: converted,
      total_tokens_earned: totalTokens,
    });
  } catch (err) {
    console.error("Stats error:", err);
    return NextResponse.json({ error: "Failed to get stats" }, { status: 500 });
  }
}
