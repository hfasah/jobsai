// Mirror a revealed sourcing lead into the Recruiting CRM (crm_companies +
// crm_contacts) so the whole team can research/track/re-contact it there — not
// just in My Leads. Runs best-effort after a reveal (in after()); never blocks
// or fails the reveal. Idempotent: dedups the company by name and the contact
// by email, so re-revealing or re-running never creates duplicates. SERVER-ONLY.
import { supabaseAdmin } from "@/lib/supabase";
import { titleCase } from "./normalize";

interface LeadRow {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  company: string | null;
  linkedin_url: string | null;
  skills: string[] | null;
  emails: { value: string }[] | null;
  phones: { value: string }[] | null;
}

// Sync one owned lead (by its external-candidate id) into the CRM. No-op unless
// the lead has a revealed email (a CRM contact keyed by email is the point).
export async function syncLeadToCrm(orgId: string, userId: string, externalCandidateId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("sourcing_external_candidates")
    .select("full_name, first_name, last_name, job_title, company, linkedin_url, skills, emails, phones")
    .eq("id", externalCandidateId)
    .eq("org_id", orgId)
    .maybeSingle();
  const lead = data as LeadRow | null;
  const email = lead?.emails?.[0]?.value?.toLowerCase() ?? null;
  if (!lead || !email) return;

  const first = lead.first_name ?? (lead.full_name ?? email).split(" ")[0];
  const last = lead.last_name ?? ((lead.full_name ?? "").split(" ").slice(1).join(" ") || null);

  // Company: reuse an existing one (case-insensitive) or create it.
  let companyId: string | null = null;
  if (lead.company) {
    const { data: existingCo } = await supabaseAdmin
      .from("crm_companies")
      .select("id")
      .eq("org_id", orgId)
      .ilike("name", lead.company)
      .maybeSingle();
    if (existingCo) companyId = (existingCo as { id: string }).id;
    else {
      const { data: newCo } = await supabaseAdmin
        .from("crm_companies")
        .insert({ org_id: orgId, name: lead.company, source: "sourcing", created_by: userId })
        .select("id")
        .single();
      companyId = (newCo as { id: string } | null)?.id ?? null;
    }
  }

  // Contact: dedup by email. Update the existing one (fill company/links) or
  // create it. Never overwrite a recruiter-edited name/notes.
  const { data: existing } = await supabaseAdmin
    .from("crm_contacts")
    .select("id, company_id, linkedin_url")
    .eq("org_id", orgId)
    .ilike("email", email)
    .maybeSingle();
  if (existing) {
    const row = existing as { id: string; company_id: string | null; linkedin_url: string | null };
    const patch: Record<string, unknown> = {};
    if (!row.company_id && companyId) patch.company_id = companyId;
    if (!row.linkedin_url && lead.linkedin_url) patch.linkedin_url = lead.linkedin_url;
    if (Object.keys(patch).length > 0) {
      await supabaseAdmin.from("crm_contacts").update(patch).eq("id", row.id).eq("org_id", orgId);
    }
    return;
  }

  await supabaseAdmin.from("crm_contacts").insert({
    org_id: orgId,
    company_id: companyId,
    first_name: first,
    last_name: last,
    title: titleCase(lead.job_title),
    email,
    phone: lead.phones?.[0]?.value ?? null,
    linkedin_url: lead.linkedin_url,
    contact_type: "other",
    tags: (lead.skills ?? []).slice(0, 12),
    notes: "Added automatically from Global Sourcing",
    created_by: userId,
  });
}
