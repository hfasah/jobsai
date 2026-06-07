import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserPlan, PLAN_LIMITS, getDailyApplyCount } from "@/lib/billing";

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

  if (!limits.auto_apply) {
    return NextResponse.json(
      { allowed: false, remaining: 0, cap: 0, upgrade_required: true, reason: "Auto-apply is a paid feature. Upgrade to apply with JobsAI." },
      { headers: CORS_HEADERS }
    );
  }

  const used = await getDailyApplyCount(userId);
  const remaining = Math.max(0, limits.daily_apply - used);
  return NextResponse.json(
    {
      allowed: remaining > 0,
      remaining,
      cap: limits.daily_apply,
      reason: remaining > 0 ? null : `You've reached your ${limits.daily_apply}/day limit on ${limits.label}. It resets tomorrow — upgrade for more.`,
    },
    { headers: CORS_HEADERS }
  );
}
