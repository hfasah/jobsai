import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;

interface AwardRequest {
  plan: "pro" | "premium" | "accelerator";
}

// POST /api/referrals/award
// Called when user buys a plan: award tokens to referrer and referred user
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as AwardRequest;
  const plan = body.plan as string | undefined;

  if (!["pro", "premium", "accelerator"].includes(plan ?? "")) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  try {
    // Find the referral record (this user was referred)
    const { data: referral } = await supabaseAdmin
      .from("referrals")
      .select("id, referrer_user_id, status")
      .eq("referred_user_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    if (!referral) {
      return NextResponse.json({ error: "No pending referral found" }, { status: 404 });
    }

    // Determine rewards based on plan
    const baseReward = 1000;
    const premiumBonus = plan === "premium" ? 500 : 0;
    const referredBonus = 1000;

    // Award tokens to referrer
    const referrerTokens = baseReward + premiumBonus;
    const { error: referrerError } = await supabaseAdmin
      .from("referral_rewards")
      .insert({
        user_id: referral.referrer_user_id,
        referral_id: referral.id,
        reward_type: plan === "premium" ? "referrer_premium_bonus" : "referrer_base",
        tokens: referrerTokens,
      });

    if (referrerError) throw referrerError;

    // Award tokens to referred user
    const { error: referredError } = await supabaseAdmin
      .from("referral_rewards")
      .insert({
        user_id: userId,
        referral_id: referral.id,
        reward_type: "referred_signup",
        tokens: referredBonus,
      });

    if (referredError) throw referredError;

    // Update referral as converted
    const { error: updateError } = await supabaseAdmin
      .from("referrals")
      .update({
        status: "converted",
        plan_purchased: plan,
        converted_at: new Date().toISOString(),
      })
      .eq("id", referral.id);

    if (updateError) throw updateError;

    // Add tokens to both users in user_tokens table
    const { data: referrerData } = await supabaseAdmin
      .from("user_tokens")
      .select("balance")
      .eq("user_id", referral.referrer_user_id)
      .single();

    const { data: referredData } = await supabaseAdmin
      .from("user_tokens")
      .select("balance")
      .eq("user_id", userId)
      .single();

    // Update or create token records
    await supabaseAdmin.from("user_tokens").upsert({
      user_id: referral.referrer_user_id,
      balance: (referrerData?.balance ?? 0) + referrerTokens,
    });

    await supabaseAdmin.from("user_tokens").upsert({
      user_id: userId,
      balance: (referredData?.balance ?? 0) + referredBonus,
    });

    return NextResponse.json({
      ok: true,
      referrer_tokens: referrerTokens,
      referred_tokens: referredBonus,
    });
  } catch (err) {
    console.error("Award tokens error:", err);
    return NextResponse.json({ error: "Failed to award tokens" }, { status: 500 });
  }
}
