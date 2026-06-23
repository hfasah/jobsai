import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { checkSkyvernHealth } from "@/lib/skyvern";

export const dynamic = "force-dynamic";

// GET /api/admin/skyvern-health — admin diagnostic for the browser-agent service.
// Reports whether SKYVERN_API_KEY is set and whether Skyvern accepts it, so an
// "agent broken across the board" report can be triaged (bad key vs no credits
// vs outage) without creating a paid run.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const health = await checkSkyvernHealth();
  return NextResponse.json({ data: health });
}
