import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserPlan, PLAN_LIMITS, getDailyApplyCount } from "@/lib/billing";
import { getTokenBalance, TOKEN_COSTS } from "@/lib/tokens";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/extension/apply-gate
// Auth: Authorization: Bearer jsk_xxx
// Returns whether the user may apply right now and how many applies remain today,
// so the extension can stop a bulk run at the per-plan daily cap.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return NextResponse.json({ allowed: false, error: "Missing API key." }, { status: 401, headers: CORS_HEADERS });

  const { data: billing } = await supabaseAdmin
    .from("user_billing")
    .select("user_id")
    .eq("extension_api_key", token)
    .maybeSingle();
  if (!billing?.user_id) return NextResponse.json({ allowed: false, error: "Invalid API key." }, { status: 401, headers: CORS_HEADERS });

  const userId = billing.user_id;
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];

  // Access is credit-governed: each extension apply costs TOKEN_COSTS.extension_apply.
  // Remaining is bounded by both the daily fair-use cap and the credit balance.
  const cost = TOKEN_COSTS.extension_apply;
  const dailyCap = limits.daily_apply && limits.daily_apply > 0 ? limits.daily_apply : 25;
  const [used, balance] = await Promise.all([getDailyApplyCount(userId), getTokenBalance(userId)]);
  const byCap = Math.max(0, dailyCap - used);
  const byCredits = Math.floor(balance / cost);
  const remaining = Math.min(byCap, byCredits);

  const reason =
    byCap <= 0
      ? `You've hit today's ${dailyCap} apply limit on ${limits.label}. It resets tomorrow.`
      : byCredits <= 0
        ? `Not enough credits — each apply costs ${cost}. Top up to continue.`
        : null;

  return NextResponse.json(
    { allowed: remaining > 0, remaining, cap: dailyCap, cost, balance, reason, upgrade_required: byCredits <= 0 },
    { headers: CORS_HEADERS }
  );
}
