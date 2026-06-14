import { NextRequest, NextResponse } from "next/server";
import { runMonthlyPartnerPayouts } from "@/lib/partner-payouts";

// Allow time for several Stripe transfers.
export const maxDuration = 300;

// GET /api/cron/partner-payouts — called by Vercel Cron monthly. Settles cleared
// partner commissions (past the 2-month hold, over the $500 minimum) to partners
// who completed Stripe Connect onboarding. Manual-payout partners are untouched.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runMonthlyPartnerPayouts();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("partner-payouts cron error:", e);
    return NextResponse.json({ error: "Payout run failed" }, { status: 500 });
  }
}
