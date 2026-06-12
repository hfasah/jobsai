import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { runStaleAgent } from "@/lib/pipeline-agent";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all orgs that have at least one active stale_candidate rule
  const { data: orgs } = await supabaseAdmin
    .from("enterprise_pipeline_rules")
    .select("org_id")
    .eq("active", true)
    .eq("trigger_event", "stale_candidate");

  if (!orgs?.length) return NextResponse.json({ ok: true, orgs_processed: 0, total_fired: 0 });

  const orgIds = [...new Set(orgs.map((r) => r.org_id))];
  let totalFired = 0;

  for (const orgId of orgIds) {
    try {
      const fired = await runStaleAgent(orgId);
      totalFired += fired;
    } catch (err) {
      console.error(`Stale agent failed for org ${orgId}:`, err);
    }
  }

  return NextResponse.json({ ok: true, orgs_processed: orgIds.length, total_fired: totalFired });
}
