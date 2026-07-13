// Import an external candidate into the ATS (talent pool, a job's pipeline,
// or the intake pool). Explicit, credit-free, permission-gated; provenance is
// recorded in sourcing_imports. Both target tables require candidate_email
// NOT NULL, so an import always needs a revealed email first. SERVER-ONLY.
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateIntakePool } from "@/lib/enterprise-intake-inbox";
import { loadInternalIndex, dedupeVerdict } from "./dedupe";
import { titleCase } from "./normalize";
import { isEmailSuppressed } from "@/lib/outreach/suppression";
import type { DedupVerdict, ExternalCandidate } from "./types";

export type ImportTarget = "talent_pool" | "job" | "intake" | "crm_contact" | "campaign";
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
  status: "imported" | "merged" | "skipped" | "needs_email" | "duplicate_confirm" | "do_not_contact" | "error";
  verdict?: DedupVerdict;
  application_id?: string;
  talent_pool_id?: string;
  crm_contact_id?: string;
  enrollment_id?: string;
  pending?: boolean; // enrolled into a draft with no sequence yet — parked until launch
  error?: string;
  reason?: string; // human-readable note for a skip (e.g. already in a campaign)
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
  crmContactId?: string | null;
  campaignId?: string | null;
  enrollmentId?: string | null;
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
    crm_contact_id: args.crmContactId ?? null,
    campaign_id: args.campaignId ?? null,
    enrollment_id: args.enrollmentId ?? null,
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
  campaignId?: string | null;
  onDuplicate?: OnDuplicate;
}): Promise<ImportOutcome> {
  const { orgId, userId, candidate, target } = args;
  const onDuplicate = args.onDuplicate ?? "skip";

  if (candidate.suppressed) return { status: "error", error: "Candidate is suppressed." };
  const email = candidate.emails[0]?.value ?? null;
  if (!email) return { status: "needs_email" };

  // Do-Not-Contact: never enrol a suppressed address into outreach (campaign) or
  // nurture (talent pool). Job/intake targets are applicants, not outreach.
  if ((target === "campaign" || target === "talent_pool") && await isEmailSuppressed(orgId, email)) {
    return { status: "do_not_contact" };
  }

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

  // CRM contact — for lead-gen / decision-maker outreach. Creates (or links)
  // the company, then a contact keyed by email. Dedup by (org, email).
  if (target === "crm_contact") {
    const first = candidate.first_name ?? (candidate.full_name ?? name).split(" ")[0];
    const last = candidate.last_name ?? ((candidate.full_name ?? "").split(" ").slice(1).join(" ") || null);

    let companyId: string | null = null;
    if (candidate.company) {
      const { data: existingCo } = await supabaseAdmin
        .from("crm_companies")
        .select("id")
        .eq("org_id", orgId)
        .ilike("name", candidate.company)
        .maybeSingle();
      if (existingCo) companyId = (existingCo as { id: string }).id;
      else {
        const { data: newCo } = await supabaseAdmin
          .from("crm_companies")
          .insert({ org_id: orgId, name: candidate.company, source: "sourcing", created_by: userId })
          .select("id")
          .single();
        companyId = (newCo as { id: string } | null)?.id ?? null;
      }
    }

    // Dedup: update an existing contact with the same email rather than dup.
    const { data: existingContact } = await supabaseAdmin
      .from("crm_contacts")
      .select("id")
      .eq("org_id", orgId)
      .ilike("email", email)
      .maybeSingle();
    let contactId: string;
    if (existingContact) {
      contactId = (existingContact as { id: string }).id;
    } else {
      const { data: contact, error } = await supabaseAdmin
        .from("crm_contacts")
        .insert({
          org_id: orgId,
          company_id: companyId,
          first_name: first,
          last_name: last,
          title: titleCase(candidate.job_title),
          email,
          phone: candidate.phones[0]?.value ?? null,
          linkedin_url: candidate.linkedin_url,
          contact_type: "other",
          tags: candidate.skills.slice(0, 12),
          notes: importNote,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error || !contact) return { status: "error", error: error?.message ?? "Could not create contact." };
      contactId = (contact as { id: string }).id;
    }
    await recordImport({ orgId, userId, candidateId: candidate.id, target, crmContactId: contactId, dedupStatus: verdict.status, decision: existingContact ? "merged" : decision });
    return { status: existingContact ? "merged" : "imported", verdict, crm_contact_id: contactId };
  }

  // Campaign — enroll straight into a cold-email sequence (search → outreach).
  if (target === "campaign") {
    if (!args.campaignId) return { status: "error", error: "A campaign is required." };
    const { data: campaign } = await supabaseAdmin
      .from("enterprise_campaigns")
      .select("id, dedup_days, allow_unverified")
      .eq("id", args.campaignId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!campaign) return { status: "error", error: "Campaign not found." };
    const opts = campaign as { dedup_days: number | null; allow_unverified: boolean };

    const emailStatus = candidate.emails.find((e) => e.value === email)?.verification_status ?? candidate.emails[0]?.verification_status ?? null;

    // Deliverability guard: an address the verifier marked INVALID will bounce
    // and hurt sender reputation. SKIP it (don't block the batch) — the rest of
    // the selection still enrols. Unknown/risky are allowed through (risky =
    // "likely valid"); only a hard "invalid" is dropped.
    if (emailStatus === "invalid") {
      return { status: "skipped", verdict, reason: "Email failed verification (invalid) — skipped to protect deliverability." };
    }

    // Options: block unverified emails when the campaign requires verified ones.
    if (opts.allow_unverified === false && emailStatus !== "valid" && emailStatus !== "risky") {
      return { status: "skipped", verdict, reason: "Email isn't verified — this campaign only accepts verified addresses." };
    }

    // Options: recency guard — skip if contacted (any campaign) within N days.
    if (opts.dedup_days && opts.dedup_days > 0) {
      const cutoff = new Date(Date.now() - opts.dedup_days * 86_400_000).toISOString();
      const { data: recent } = await supabaseAdmin
        .from("enterprise_campaign_enrollments")
        .select("id")
        .eq("org_id", orgId)
        .ilike("candidate_email", email)
        .gte("last_sent_at", cutoff)
        .limit(1)
        .maybeSingle();
      if (recent) return { status: "skipped", verdict, reason: `Contacted within the last ${opts.dedup_days} days — skipped.` };
    }

    // A draft campaign may have no sequence yet. Rather than block (the old
    // deadlock: sourcing wouldn't add leads without steps, and you couldn't
    // write steps without leads), we PARK the lead — enrolled but unscheduled
    // (next_send_at = null). Nothing sends until a step is written AND the
    // campaign is launched (the launch preflight requires steps, and launch
    // backfills next_send_at for parked enrollments). See PATCH campaigns/[id].
    const { data: steps } = await supabaseAdmin
      .from("enterprise_campaign_steps")
      .select("delay_days")
      .eq("campaign_id", args.campaignId)
      .order("step_order", { ascending: true })
      .limit(1);
    const hasSteps = !!steps && steps.length > 0;

    // Already enrolled in THIS campaign → don't double-message.
    const { data: existingEnroll } = await supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .select("id")
      .eq("campaign_id", args.campaignId)
      .ilike("candidate_email", email)
      .maybeSingle();
    if (existingEnroll) {
      await recordImport({ orgId, userId, candidateId: candidate.id, target, campaignId: args.campaignId, enrollmentId: (existingEnroll as { id: string }).id, dedupStatus: verdict.status, decision: "merged" });
      return { status: "merged", verdict, enrollment_id: (existingEnroll as { id: string }).id };
    }

    // Already in an ACTIVE campaign elsewhere in the org → don't let two
    // campaigns (or two recruiters) contact the same person at once.
    const { data: activeElsewhere } = await supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .select("id")
      .eq("org_id", orgId)
      .ilike("candidate_email", email)
      .eq("status", "active")
      .neq("campaign_id", args.campaignId)
      .limit(1)
      .maybeSingle();
    if (activeElsewhere) {
      return { status: "skipped", verdict, reason: "Already in another active campaign — skipped to avoid overlapping outreach." };
    }

    // Parked (no steps yet) → next_send_at null so the cron never picks it up.
    // Launch backfills the schedule once a sequence exists.
    const nextSendAt = hasSteps
      ? new Date(Date.now() + Math.max(0, steps![0].delay_days || 0) * 86_400_000).toISOString()
      : null;
    const { data: enrollment, error } = await supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .insert({
        campaign_id: args.campaignId,
        org_id: orgId,
        candidate_name: name,
        candidate_email: email,
        candidate_source: "sourcing",
        status: "active",
        current_step_order: 0,
        next_send_at: nextSendAt,
        enrolled_by: userId,
        email_status: candidate.emails.find((e) => e.value === email)?.verification_status ?? candidate.emails[0]?.verification_status ?? null,
      })
      .select("id")
      .single();
    if (error || !enrollment) return { status: "error", error: error?.message ?? "Could not enroll." };
    const enrollmentId = (enrollment as { id: string }).id;
    await recordImport({ orgId, userId, candidateId: candidate.id, target, campaignId: args.campaignId, enrollmentId, dedupStatus: verdict.status, decision });
    return { status: "imported", verdict, enrollment_id: enrollmentId, pending: !hasSteps };
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
