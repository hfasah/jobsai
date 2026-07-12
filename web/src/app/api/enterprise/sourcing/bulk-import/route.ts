import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { enforceLimit } from "@/lib/enterprise-limits";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";
import { importExternalCandidate, type ImportTarget, type OnDuplicate, type StoredCandidateRow } from "@/lib/sourcing/import";

export const maxDuration = 60;

const MAX_BULK = 100;
const CANDIDATE_COLS =
  "id, provider_key, provider_record_id, full_name, first_name, last_name, job_title, company, location_country, location_locality, skills, experience_years, linkedin_url, portfolio_url, emails, phones, suppressed";

// POST /api/enterprise/sourcing/bulk-import
// { resultIds: string[], target, jobId?, groupId?, onDuplicate? }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_import_sourced");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const resultIds: string[] = Array.isArray(body.resultIds)
    ? body.resultIds.filter((x: unknown): x is string => typeof x === "string").slice(0, MAX_BULK)
    : [];
  if (resultIds.length === 0) return NextResponse.json({ error: "resultIds is required." }, { status: 400 });
  const target: ImportTarget = ["talent_pool", "job", "intake", "crm_contact", "campaign"].includes(body.target) ? body.target : "talent_pool";
  const onDuplicate: OnDuplicate = ["skip", "import_anyway", "merge"].includes(body.onDuplicate) ? body.onDuplicate : "skip";

  if (target === "job" || target === "intake") {
    const limited = await enforceLimit(userId, "candidates", resultIds.length);
    if (limited) return limited;
  }

  const { data: results } = await supabaseAdmin
    .from("sourcing_run_results")
    .select("id, external_candidate_id")
    .eq("org_id", org.id)
    .in("id", resultIds);
  const rows = (results ?? []) as { id: string; external_candidate_id: string | null }[];

  const summary = { imported: 0, merged: 0, skipped: 0, needs_email: 0, duplicates: 0, errors: 0 };
  const importedResultIds: string[] = [];

  for (const row of rows) {
    if (!row.external_candidate_id) { summary.skipped++; continue; }
    const { data: cand } = await supabaseAdmin
      .from("sourcing_external_candidates")
      .select(CANDIDATE_COLS)
      .eq("id", row.external_candidate_id)
      .eq("org_id", org.id)
      .maybeSingle();
    if (!cand) { summary.errors++; continue; }

    const outcome = await importExternalCandidate({
      orgId: org.id,
      userId,
      candidate: cand as unknown as StoredCandidateRow,
      target,
      jobId: typeof body.jobId === "string" ? body.jobId : null,
      groupId: typeof body.groupId === "string" ? body.groupId : null,
      campaignId: typeof body.campaignId === "string" ? body.campaignId : null,
      onDuplicate,
    });
    if (outcome.status === "imported") { summary.imported++; importedResultIds.push(row.id); }
    else if (outcome.status === "merged") { summary.merged++; importedResultIds.push(row.id); }
    else if (outcome.status === "needs_email") summary.needs_email++;
    else if (outcome.status === "duplicate_confirm") summary.duplicates++;
    else if (outcome.status === "skipped") summary.skipped++;
    else summary.errors++;
  }

  if (importedResultIds.length > 0) {
    await supabaseAdmin
      .from("sourcing_run_results")
      .update({ dedup_status: "imported" })
      .eq("org_id", org.id)
      .in("id", importedResultIds);
  }

  after(() => {
    audit({
      org_id: org.id,
      user_id: userId,
      action: "sourcing.candidate_imported",
      resource_type: "sourcing_bulk_import",
      metadata: { target, requested: resultIds.length, ...summary },
    });
  });

  return NextResponse.json({ data: summary });
}
