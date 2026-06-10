import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;

// POST /api/referrals/track
// Called on signup: associates new user with referrer via referral code
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const referralCode = (body.referral_code as string | undefined)?.trim();

  if (!referralCode) {
    return NextResponse.json({ error: "No referral code provided" }, { status: 400 });
  }

  try {
    // Find referrer by code
    const { data: referrer } = await supabaseAdmin
      .from("referrals")
      .select("referrer_user_id")
      .eq("referral_code", referralCode)
      .maybeSingle();

    if (!referrer) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
    }

    const referrerId = referrer.referrer_user_id;

    // Create referral record
    const { error } = await supabaseAdmin.from("referrals").insert({
      referrer_user_id: referrerId,
      referred_user_id: userId,
      referral_code: referralCode,
      status: "pending",
    });

    if (error) {
      console.error("Referral insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, referrer_id: referrerId });
  } catch (err) {
    console.error("Referral tracking error:", err);
    return NextResponse.json({ error: "Failed to track referral" }, { status: 500 });
  }
}
