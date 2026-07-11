import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";

// POST /api/enterprise/sourcing/results/[id]/flag
// { action: not_relevant | bad_data | suppress }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action: "not_relevant" | "bad_data" | "suppress" = ["not_relevant", "bad_data", "suppress"].includes(body.action)
    ? body.action
    : "not_relevant";

  const { data: result } = await supabaseAdmin
    .from("sourcing_run_results")
    .select("id, external_candidate_id")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  const resultRow = result as { id: string; external_candidate_id: string | null } | null;
  if (!resultRow) return NextResponse.json({ error: "Result not found." }, { status: 404 });

  if (action === "not_relevant") {
    await supabaseAdmin
      .from("sourcing_run_results")
      .update({ not_relevant: true })
      .eq("id", resultRow.id)
      .eq("org_id", org.id);
    return NextResponse.json({ data: { flagged: "not_relevant" } });
  }

  if (!resultRow.external_candidate_id) {
    return NextResponse.json({ error: "Only external candidates can be flagged this way." }, { status: 400 });
  }

  const { data: cand } = await supabaseAdmin
    .from("sourcing_external_candidates")
    .select("id, provider_key, provider_record_id, full_name, linkedin_url, emails")
    .eq("id", resultRow.external_candidate_id)
    .eq("org_id", org.id)
    .maybeSingle();
  const candidate = cand as { id: string; provider_key: string; provider_record_id: string; full_name: string | null; linkedin_url: string | null; emails: { value: string }[] } | null;
  if (!candidate) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });

  if (action === "bad_data") {
    await supabaseAdmin
      .from("sourcing_external_candidates")
      .update({ bad_data_reported: true, updated_at: new Date().toISOString() })
      .eq("id", candidate.id)
      .eq("org_id", org.id);
    return NextResponse.json({ data: { flagged: "bad_data" } });
  }

  // suppress: add to the do-not-source list and hide from future searches.
  await supabaseAdmin.from("sourcing_suppressions").insert({
    org_id: org.id,
    email: candidate.emails[0]?.value ?? null,
    linkedin_url: candidate.linkedin_url,
    provider_key: candidate.provider_key,
    provider_record_id: candidate.provider_record_id,
    full_name: candidate.full_name,
    reason: "user_suppressed",
    created_by: userId,
  });
  await supabaseAdmin
    .from("sourcing_external_candidates")
    .update({ suppressed: true, updated_at: new Date().toISOString() })
    .eq("id", candidate.id)
    .eq("org_id", org.id);
  await supabaseAdmin
    .from("sourcing_run_results")
    .update({ not_relevant: true })
    .eq("id", resultRow.id)
    .eq("org_id", org.id);

  after(() => {
    audit({
      org_id: org.id,
      user_id: userId,
      action: "sourcing.candidate_suppressed",
      resource_type: "sourcing_external_candidate",
      resource_id: candidate.id,
      metadata: { provider: candidate.provider_key },
    });
  });

  return NextResponse.json({ data: { flagged: "suppressed" } });
}
