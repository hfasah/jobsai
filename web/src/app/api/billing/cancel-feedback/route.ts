import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserBilling } from "@/lib/billing";

// POST /api/billing/cancel-feedback — save churn survey before Stripe portal redirect
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const reasons: string[] = Array.isArray(body.reasons) ? body.reasons.filter((r: unknown) => typeof r === "string") : [];
  const comment: string = typeof body.comment === "string" ? body.comment.trim() : "";
  const wait: boolean = body.wait === true;

  const billing = await getUserBilling(userId);

  await supabaseAdmin.from("churn_feedback").insert({
    user_id: userId,
    plan: billing.plan,
    reasons,
    comment: comment || null,
    wait,
  });

  return NextResponse.json({ ok: true });
}
