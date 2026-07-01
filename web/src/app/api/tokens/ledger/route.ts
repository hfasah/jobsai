import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ledgerLabel } from "@/lib/token-labels";

// GET /api/tokens/ledger?limit=100 — the signed-in user's own credit history
// (spends + grants/refunds), newest first, plus a spend-by-feature breakdown.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = Math.min(500, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "100")));

  const { data, error } = await supabaseAdmin
    .from("token_ledger")
    .select("id, delta, balance_after, reason, feature, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((r) => ({
    id: r.id,
    delta: r.delta,
    balance_after: r.balance_after,
    label: ledgerLabel(r.reason as string | null, r.feature as string | null),
    reason: r.reason,
    created_at: r.created_at,
  }));

  // Spend-by-feature breakdown (spends only) over the returned window.
  const spendByLabel = new Map<string, { spent: number; count: number }>();
  let totalSpent = 0;
  let totalCredited = 0;
  for (const r of rows) {
    if (r.delta < 0) {
      totalSpent += -r.delta;
      const cur = spendByLabel.get(r.label) ?? { spent: 0, count: 0 };
      cur.spent += -r.delta; cur.count += 1;
      spendByLabel.set(r.label, cur);
    } else {
      totalCredited += r.delta;
    }
  }
  const breakdown = [...spendByLabel.entries()]
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.spent - a.spent);

  return NextResponse.json({ data: { rows, breakdown, totalSpent, totalCredited } });
}
