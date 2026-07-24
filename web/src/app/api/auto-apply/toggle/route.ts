import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTokenBalance } from "@/lib/tokens";
import { TOKEN_COSTS } from "@/lib/tokens";

// Continuous Auto-Apply control. The heavy lifting (find + apply) runs in the
// discover/auto-apply crons; this endpoint just flips the switch and reports
// live status for the button + status card on the Search Jobs screen.

async function status(userId: string) {
  const [{ data: prefs }, { count: submitted }, { count: matches }, balance] = await Promise.all([
    supabaseAdmin.from("user_preferences").select("auto_apply_enabled, auto_apply_mode").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("apply_attempts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "submitted"),
    supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", userId),
    getTokenBalance(userId),
  ]);
  const cost = TOKEN_COSTS.auto_apply;
  return {
    enabled: Boolean(prefs?.auto_apply_enabled),
    mode: prefs?.auto_apply_mode ?? "hybrid",
    applicationsSubmitted: submitted ?? 0,
    jobMatchesFound: matches ?? 0,
    balance,
    appliesLeft: Math.floor(balance / cost),
    lowCredits: balance < cost, // can't afford even one more apply
  };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await status(userId));
}

// POST { enabled: boolean } — turn continuous auto-apply on or off (pause).
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const enabled = Boolean(body.enabled);

  const update: Record<string, unknown> = { auto_apply_enabled: enabled };
  // Turning it on defaults to autonomous mode so it actually applies without
  // per-job review; users can dial it back to hybrid/review in Preferences.
  if (enabled) update.auto_apply_mode = body.mode ?? "auto";

  const { error } = await supabaseAdmin
    .from("user_preferences")
    .upsert({ user_id: userId, ...update }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(await status(userId));
}
