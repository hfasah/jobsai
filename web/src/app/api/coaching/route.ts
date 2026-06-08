import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { blockNonJobSeeker } from "@/lib/roles";
import { getTokenAccount, deductTokens, TOKEN_COSTS } from "@/lib/tokens";
import { PLAN_LIMITS, COACHING_SESSION_MINUTES, COACHING_USD } from "@/lib/billing";
import { fmtTokens } from "@/lib/utils";

export const dynamic = "force-dynamic";

const COST = TOKEN_COSTS.coaching_session;
const monthStartISO = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString(); };

async function freeUsedThisMonth(userId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("coaching_bookings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("paid_with", "included")
    .neq("status", "cancelled")
    .gte("created_at", monthStartISO());
  return count ?? 0;
}

// GET /api/coaching — booking options + history.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;

  const acct = await getTokenAccount(userId);
  const limits = PLAN_LIMITS[acct.plan];
  const freeTotal = (limits as { coaching_free_sessions_month?: number }).coaching_free_sessions_month ?? 0;
  const freeUsed = freeTotal > 0 ? await freeUsedThisMonth(userId) : 0;

  const { data: bookings } = await supabaseAdmin
    .from("coaching_bookings")
    .select("id, plan, paid_with, tokens_spent, minutes, status, preferred_times, scheduled_at, zoom_link, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    data: {
      cost_tokens: COST,
      cost_usd: COACHING_USD,
      session_minutes: COACHING_SESSION_MINUTES,
      balance: acct.balance,
      plan: acct.plan,
      free_total: freeTotal,
      free_used: freeUsed,
      free_available: Math.max(0, freeTotal - freeUsed),
      bookings: bookings ?? [],
    },
  });
}

// POST /api/coaching — request a session (free if available, else pay in tokens).
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;

  const body = await req.json().catch(() => ({}));
  const preferred_times = typeof body.preferred_times === "string" ? body.preferred_times.slice(0, 500) : null;
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 1000) : null;

  const acct = await getTokenAccount(userId);
  const limits = PLAN_LIMITS[acct.plan];
  const freeTotal = (limits as { coaching_free_sessions_month?: number }).coaching_free_sessions_month ?? 0;
  const freeUsed = freeTotal > 0 ? await freeUsedThisMonth(userId) : 0;
  const useFree = freeTotal - freeUsed > 0;

  let paidWith: "included" | "tokens" = "included";
  let tokensSpent = 0;

  if (!useFree) {
    // Pay with tokens (meterFree so free-plan users are actually charged).
    const spend = await deductTokens(userId, COST, "coaching_session", { booking: true }, { meterFree: true });
    if (!spend.ok) {
      return NextResponse.json(
        { error: `A coaching session costs ${fmtTokens(COST)} tokens (≈ $${COACHING_USD}). You have ${fmtTokens(acct.balance)}. Top up to book.`, upgrade_required: true },
        { status: 402 }
      );
    }
    paidWith = "tokens";
    tokensSpent = COST;
  }

  const { data, error } = await supabaseAdmin
    .from("coaching_bookings")
    .insert({
      user_id: userId,
      plan: acct.plan,
      paid_with: paidWith,
      tokens_spent: tokensSpent,
      minutes: COACHING_SESSION_MINUTES,
      status: "requested",
      preferred_times,
      notes,
    })
    .select("*")
    .single();

  if (error) {
    // Refund tokens if we charged but couldn't save the booking.
    if (tokensSpent > 0) {
      const { addTokens } = await import("@/lib/tokens");
      await addTokens(userId, tokensSpent, "coaching_refund", { reason: "booking save failed" });
    }
    console.error("coaching booking error:", error.message);
    return NextResponse.json({ error: "Couldn't save your booking. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ data, paid_with: paidWith });
}

// PATCH /api/coaching — pick a time slot for an existing booking.
// Body: { booking_id, scheduled_at (ISO) }
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;

  const body = await req.json().catch(() => ({}));
  const bookingId = String(body.booking_id ?? "");
  const when = new Date(String(body.scheduled_at ?? ""));
  if (!bookingId || isNaN(when.getTime())) {
    return NextResponse.json({ error: "A valid booking and time slot are required." }, { status: 400 });
  }
  if (when.getTime() < Date.now()) {
    return NextResponse.json({ error: "Please choose a future time slot." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("coaching_bookings")
    .update({ scheduled_at: when.toISOString(), status: "scheduled" })
    .eq("id", bookingId)
    .eq("user_id", userId)   // ownership guard
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Couldn't schedule that slot. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ data });
}
