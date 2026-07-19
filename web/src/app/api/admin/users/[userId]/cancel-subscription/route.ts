import { NextRequest, NextResponse } from "next/server";
import { requireAdminPerm } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const ctx = await requireAdminPerm("users.cancel_sub");
  return ctx ? ctx.userId : null;
}

// POST /api/admin/users/[userId]/cancel-subscription { immediately?: boolean }
// Support tool: stop a customer's renewals (default: cancel at period end, per
// the refund policy — they keep access they paid for; no further charges).
// `immediately: true` ends access now (e.g. fraud). Never issues money refunds.
export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { userId } = await params;
  const { immediately } = await req.json().catch(() => ({} as { immediately?: boolean }));

  const { data: billing, error } = await supabaseAdmin
    .from("user_billing")
    .select("stripe_subscription_id, subscription_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const subId = (billing as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id;
  if (!subId) return NextResponse.json({ error: "No Stripe subscription on file for this user." }, { status: 404 });

  const stripe = getStripe();
  try {
    if (immediately) {
      const sub = await stripe.subscriptions.cancel(subId);
      await supabaseAdmin.from("user_billing")
        .update({ subscription_status: sub.status })
        .eq("user_id", userId);
      return NextResponse.json({ data: { status: sub.status, canceled: "immediately" } });
    }
    const sub = await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
    // current_period_end moved from the subscription to its items in newer
    // Stripe API versions — read whichever this account's version provides.
    const loose = sub as unknown as { current_period_end?: number; items?: { data?: { current_period_end?: number }[] } };
    const periodEndUnix = loose.current_period_end ?? loose.items?.data?.[0]?.current_period_end;
    return NextResponse.json({
      data: {
        status: sub.status,
        canceled: "at_period_end",
        period_end: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null,
      },
    });
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message ?? "Stripe cancel failed";
    // Already-canceled subscriptions error on update — treat as success-ish.
    if (/canceled subscription/i.test(msg)) {
      return NextResponse.json({ data: { status: "canceled", canceled: "already" } });
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
