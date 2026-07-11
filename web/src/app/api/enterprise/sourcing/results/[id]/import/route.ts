import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { enforceLimit } from "@/lib/enterprise-limits";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";
import { importExternalCandidate, type ImportTarget, type OnDuplicate, type StoredCandidateRow } from "@/lib/sourcing/import";

export const maxDuration = 30;

const CANDIDATE_COLS =
  "id, provider_key, provider_record_id, full_name, first_name, last_name, job_title, company, location_country, location_locality, skills, experience_years, linkedin_url, portfolio_url, emails, phones, suppressed";

// POST /api/enterprise/sourcing/results/[id]/import
// { target: talent_pool|job|intake, jobId?, groupId?, onDuplicate?: skip|import_anyway|merge }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_import_sourced");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const target: ImportTarget = ["talent_pool", "job", "intake"].includes(body.target) ? body.target : "talent_pool";
  const onDuplicate: OnDuplicate = ["skip", "import_anyway", "merge"].includes(body.onDuplicate) ? body.onDuplicate : "skip";

  // Applications count toward the plan's candidate limit.
  if (target !== "talent_pool") {
    const limited = await enforceLimit(userId, "candidates", 1);
    if (limited) return limited;
  }

  const { data: result } = await supabaseAdmin
    .from("sourcing_run_results")
    .select("id, external_candidate_id")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  const resultRow = result as { id: string; external_candidate_id: string | null } | null;
  if (!resultRow?.external_candidate_id) {
    return NextResponse.json({ error: "Result not found or not an external candidate." }, { status: 404 });
  }

  const { data: cand } = await supabaseAdmin
    .from("sourcing_external_candidates")
    .select(CANDIDATE_COLS)
    .eq("id", resultRow.external_candidate_id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!cand) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });

  const outcome = await importExternalCandidate({
    orgId: org.id,
    userId,
    candidate: cand as unknown as StoredCandidateRow,
    target,
    jobId: typeof body.jobId === "string" ? body.jobId : null,
    groupId: typeof body.groupId === "string" ? body.groupId : null,
    onDuplicate,
  });

  if (outcome.status === "needs_email") {
    return NextResponse.json({ error: "Reveal the candidate's email before importing.", needs_email: true }, { status: 409 });
  }
  if (outcome.status === "duplicate_confirm") {
    return NextResponse.json({ data: { status: "duplicate_confirm", verdict: outcome.verdict } });
  }
  if (outcome.status === "error") {
    return NextResponse.json({ error: outcome.error ?? "Import failed." }, { status: 400 });
  }

  // Reflect the import on the run result row.
  await supabaseAdmin
    .from("sourcing_run_results")
    .update({ dedup_status: "imported" })
    .eq("id", resultRow.id)
    .eq("org_id", org.id);

  after(() => {
    audit({
      org_id: org.id,
      user_id: userId,
      action: "sourcing.candidate_imported",
      resource_type: "sourcing_external_candidate",
      resource_id: resultRow.external_candidate_id!,
      metadata: { target, decision: outcome.status, application_id: outcome.application_id ?? null, talent_pool_id: outcome.talent_pool_id ?? null },
    });
  });

  return NextResponse.json({ data: outcome });
}
