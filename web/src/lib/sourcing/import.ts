// Import an external candidate into the ATS (talent pool, a job's pipeline,
// or the intake pool). Explicit, credit-free, permission-gated; provenance is
// recorded in sourcing_imports. Both target tables require candidate_email
// NOT NULL, so an import always needs a revealed email first. SERVER-ONLY.
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateIntakePool } from "@/lib/enterprise-intake-inbox";
import { loadInternalIndex, dedupeVerdict } from "./dedupe";
import { titleCase } from "./normalize";
import type { DedupVerdict, ExternalCandidate } from "./types";

export type ImportTarget = "talent_pool" | "job" | "intake";
export type OnDuplicate = "skip" | "import_anyway" | "merge";

export interface StoredCandidateRow {
  id: string;
  provider_key: string;
  provider_record_id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  company: string | null;
  location_country: string | null;
  location_locality: string | null;
  skills: string[];
  experience_years: number | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  emails: { value: string; verification_status?: string }[];
  phones: { value: string }[];
  suppressed: boolean;
}

export interface ImportOutcome {
  status: "imported" | "merged" | "skipped" | "needs_email" | "duplicate_confirm" | "error";
  verdict?: DedupVerdict;
  application_id?: string;
  talent_pool_id?: string;
  error?: string;
}

function toExternalShape(c: StoredCandidateRow): ExternalCandidate {
  return {
    provider_key: c.provider_key,
    provider_record_id: c.provider_record_id,
    source_type: "provider_api",
    permitted_use: null,
    confidence: null,
    full_name: c.full_name,
    first_name: c.first_name,
    last_name: c.last_name,
    job_title: c.job_title,
    company: c.company,
    location_country: c.location_country,
    location_locality: c.location_locality,
    skills: c.skills,
    experience_years: c.experience_years,
    industries: [],
    education: [],
    languages: [],
    linkedin_url: c.linkedin_url,
    github_url: null,
    portfolio_url: c.portfolio_url,
    has_email: c.emails.length > 0,
    has_phone: c.phones.length > 0,
  };
}

async function recordImport(args: {
  orgId: string;
  userId: string;
  candidateId: string;
  target: ImportTarget;
  jobId?: string | null;
  applicationId?: string | null;
  talentPoolId?: string | null;
  poolGroupId?: string | null;
  dedupStatus: string;
  decision: "imported_new" | "imported_anyway" | "merged" | "skipped";
}): Promise<void> {
  await supabaseAdmin.from("sourcing_imports").insert({
    org_id: args.orgId,
    external_candidate_id: args.candidateId,
    imported_by: args.userId,
    target_type: args.target,
    job_id: args.jobId ?? null,
    application_id: args.applicationId ?? null,
    talent_pool_id: args.talentPoolId ?? null,
    pool_group_id: args.poolGroupId ?? null,
    dedup_status: args.dedupStatus,
    dedup_decision: args.decision,
  });
}

export async function importExternalCandidate(args: {
  orgId: string;
  userId: string;
  candidate: StoredCandidateRow;
  target: ImportTarget;
  jobId?: string | null;
  groupId?: string | null;
  onDuplicate?: OnDuplicate;
}): Promise<ImportOutcome> {
  const { orgId, userId, candidate, target } = args;
  const onDuplicate = args.onDuplicate ?? "skip";

  if (candidate.suppressed) return { status: "error", error: "Candidate is suppressed." };
  const email = candidate.emails[0]?.value ?? null;
  if (!email) return { status: "needs_email" };

  const name = titleCase(candidate.full_name) ?? email;
  const revealedEmails = candidate.emails.map((e) => e.value);

  // Fresh dedup verdict at import time (a reveal may have changed things).
  const index = await loadInternalIndex(orgId, [
    { candidate: toExternalShape(candidate), externalId: candidate.id, revealedEmails },
  ]);
  const verdict = dedupeVerdict(toExternalShape(candidate), index, {
    externalId: candidate.id,
    revealedEmails,
  });

  const isDuplicate = verdict.status === "existing" || verdict.status === "imported" || verdict.status === "possible_duplicate";
  if (isDuplicate && onDuplicate === "skip") {
    // "skip" doubles as the confirm step: the caller shows the matches and
    // re-submits with import_anyway or merge.
    return { status: "duplicate_confirm", verdict };
  }

  if (isDuplicate && onDuplicate === "merge") {
    // Fill blanks on the existing record; never overwrite recruiter data.
    const appMatch = verdict.matches.find((m) => m.type === "application");
    const poolMatch = verdict.matches.find((m) => m.type === "talent_pool");
    if (appMatch) {
      const { data: existing } = await supabaseAdmin
        .from("enterprise_applications")
        .select("id, linkedin_url, candidate_phone, portfolio_url")
        .eq("id", appMatch.id)
        .eq("org_id", orgId)
        .maybeSingle();
      const row = existing as { id: string; linkedin_url: string | null; candidate_phone: string | null; portfolio_url: string | null } | null;
      if (row) {
        const patch: Record<string, unknown> = {};
        if (!row.linkedin_url && candidate.linkedin_url) patch.linkedin_url = candidate.linkedin_url;
        if (!row.candidate_phone && candidate.phones[0]) patch.candidate_phone = candidate.phones[0].value;
        if (!row.portfolio_url && candidate.portfolio_url) patch.portfolio_url = candidate.portfolio_url;
        if (Object.keys(patch).length > 0) {
          await supabaseAdmin.from("enterprise_applications").update(patch).eq("id", row.id).eq("org_id", orgId);
        }
        await recordImport({ orgId, userId, candidateId: candidate.id, target, applicationId: row.id, dedupStatus: verdict.status, decision: "merged" });
        return { status: "merged", verdict, application_id: row.id };
      }
    }
    if (poolMatch) {
      await recordImport({ orgId, userId, candidateId: candidate.id, target, talentPoolId: poolMatch.id, dedupStatus: verdict.status, decision: "merged" });
      return { status: "merged", verdict, talent_pool_id: poolMatch.id };
    }
    // nothing concrete to merge into — fall through to a normal import
  }

  const decision = isDuplicate ? "imported_anyway" : "imported_new";
  const importNote = `Imported via Global Sourcing (${candidate.provider_key})`;

  if (target === "talent_pool") {
    const { data: pool, error } = await supabaseAdmin
      .from("enterprise_talent_pool")
      .upsert(
        {
          org_id: orgId,
          candidate_name: name,
          candidate_email: email,
          candidate_phone: candidate.phones[0]?.value ?? null,
          linkedin_url: candidate.linkedin_url,
          skills_tags: candidate.skills.slice(0, 20),
          source_job_title: titleCase(candidate.job_title),
          notes: importNote,
          status: "active",
        },
        { onConflict: "org_id,candidate_email" },
      )
      .select("id")
      .single();
    if (error || !pool) return { status: "error", error: error?.message ?? "Insert failed." };
    const poolId = (pool as { id: string }).id;
    if (args.groupId) {
      await supabaseAdmin
        .from("enterprise_talent_pool_memberships")
        .upsert({ org_id: orgId, talent_pool_id: poolId, group_id: args.groupId }, { onConflict: "talent_pool_id,group_id", ignoreDuplicates: true });
    }
    await recordImport({ orgId, userId, candidateId: candidate.id, target, talentPoolId: poolId, poolGroupId: args.groupId ?? null, dedupStatus: verdict.status, decision });
    return { status: "imported", verdict, talent_pool_id: poolId };
  }

  // job / intake -> an enterprise_applications row
  let jobId = args.jobId ?? null;
  if (target === "intake") {
    jobId = await getOrCreateIntakePool(orgId, userId);
  } else if (jobId) {
    const { data: job } = await supabaseAdmin
      .from("enterprise_jobs")
      .select("id")
      .eq("id", jobId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!job) return { status: "error", error: "Job not found." };
  }
  if (!jobId) return { status: "error", error: "A job is required for this import." };

  // Per-job duplicate guard (same unique key the intake flow uses).
  const { data: existingApp } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id")
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .eq("candidate_email", email)
    .maybeSingle();
  if (existingApp) {
    await recordImport({ orgId, userId, candidateId: candidate.id, target, jobId, applicationId: (existingApp as { id: string }).id, dedupStatus: verdict.status, decision: "merged" });
    return { status: "merged", verdict, application_id: (existingApp as { id: string }).id };
  }

  const { data: app, error } = await supabaseAdmin
    .from("enterprise_applications")
    .insert({
      org_id: orgId,
      job_id: jobId,
      candidate_name: name,
      candidate_email: email,
      candidate_phone: candidate.phones[0]?.value ?? null,
      candidate_location: [titleCase(candidate.location_locality), titleCase(candidate.location_country)].filter(Boolean).join(", ") || null,
      linkedin_url: candidate.linkedin_url,
      portfolio_url: candidate.portfolio_url,
      source: "import",
      stage: "applied",
      triaged: false,
      tags: candidate.skills.slice(0, 12),
      notes: importNote,
    })
    .select("id")
    .single();
  if (error || !app) return { status: "error", error: error?.message ?? "Insert failed." };
  const appId = (app as { id: string }).id;

  await recordImport({ orgId, userId, candidateId: candidate.id, target, jobId, applicationId: appId, dedupStatus: verdict.status, decision });
  return { status: "imported", verdict, application_id: appId };
}
