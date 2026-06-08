import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return adminIds.includes(userId) ? userId : null;
}

type Window = "day" | "week" | "month";
interface Bucket { tokens: number; uses: number; users: Set<string> }
const emptyBucket = (): Bucket => ({ tokens: 0, uses: 0, users: new Set() });

// GET /api/admin/usage — token consumption per feature for day / week / month.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = Date.now();
  const dayAgo = now - 86_400_000;
  const weekAgo = now - 7 * 86_400_000;
  const monthAgo = now - 30 * 86_400_000;
  const monthAgoISO = new Date(monthAgo).toISOString();

  // Page through spend rows (delta < 0) for the last 30 days.
  const features = new Map<string, Record<Window, Bucket>>();
  const totals: Record<Window, Bucket> = { day: emptyBucket(), week: emptyBucket(), month: emptyBucket() };
  const PAGE = 1000;
  const MAX_ROWS = 100_000; // safety cap
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("token_ledger")
      .select("feature, delta, user_id, created_at")
      .lt("delta", 0)
      .gte("created_at", monthAgoISO)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;

    for (const row of data) {
      const feature = row.feature || "other";
      const tokens = Math.abs(row.delta);
      const ts = new Date(row.created_at).getTime();
      const uid = row.user_id;
      if (!features.has(feature)) features.set(feature, { day: emptyBucket(), week: emptyBucket(), month: emptyBucket() });
      const f = features.get(feature)!;
      const windows: Window[] = ts >= dayAgo ? ["day", "week", "month"] : ts >= weekAgo ? ["week", "month"] : ["month"];
      for (const w of windows) {
        f[w].tokens += tokens; f[w].uses += 1; f[w].users.add(uid);
        totals[w].tokens += tokens; totals[w].uses += 1; totals[w].users.add(uid);
      }
    }
    if (data.length < PAGE) break;
  }

  const serialize = (b: Bucket) => ({ tokens: b.tokens, uses: b.uses, users: b.users.size });
  const featureRows = [...features.entries()]
    .map(([feature, w]) => ({ feature, day: serialize(w.day), week: serialize(w.week), month: serialize(w.month) }))
    .sort((a, b) => b.month.tokens - a.month.tokens);

  return NextResponse.json({
    data: {
      features: featureRows,
      totals: { day: serialize(totals.day), week: serialize(totals.week), month: serialize(totals.month) },
      generated_at: new Date().toISOString(),
    },
  });
}
