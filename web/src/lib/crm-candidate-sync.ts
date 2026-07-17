// Every candidate lands in the Recruiting CRM ("all candidates must be in the
// CRM"): applicants and talent-pool entries mirror into crm_contacts the same
// way revealed sourcing leads do (lib/sourcing/crm-sync.ts). Dedup is by email
// per org; existing contacts get blanks filled and candidate links attached —
// never overwritten. Best-effort by design: a CRM hiccup must never fail an
// application upload or intake email. SERVER-ONLY.
import { supabaseAdmin } from "@/lib/supabase";

export interface CandidateForCrm {
  name: string | null;
  email: string;
  phone?: string | null;
  linkedinUrl?: string | null;
  source: "applicant" | "talent_pool";
  applicationId?: string | null;
  talentPoolId?: string | null;
}

export async function syncCandidateToCrm(orgId: string, createdBy: string, c: CandidateForCrm): Promise<void> {
  try {
    const email = c.email.trim().toLowerCase();
    if (!email) return;
    const name = (c.name ?? "").trim() || email.split("@")[0];
    const first = name.split(" ")[0];
    const last = name.split(" ").slice(1).join(" ") || null;

    const { data: existing } = await supabaseAdmin
      .from("crm_contacts")
      .select("id, phone, linkedin_url, application_id, talent_pool_id")
      .eq("org_id", orgId)
      .ilike("email", email)
      .maybeSingle();
    if (existing) {
      const row = existing as { id: string; phone: string | null; linkedin_url: string | null; application_id?: string | null; talent_pool_id?: string | null };
      const patch: Record<string, unknown> = {};
      if (!row.phone && c.phone) patch.phone = c.phone;
      if (!row.linkedin_url && c.linkedinUrl) patch.linkedin_url = c.linkedinUrl;
      if (!row.application_id && c.applicationId) patch.application_id = c.applicationId;
      if (!row.talent_pool_id && c.talentPoolId) patch.talent_pool_id = c.talentPoolId;
      if (Object.keys(patch).length > 0) {
        const { error } = await supabaseAdmin.from("crm_contacts").update(patch).eq("id", row.id).eq("org_id", orgId);
        // Pending migration 174: retry without the link columns.
        if (error && /application_id|talent_pool_id|source/i.test(error.message)) {
          delete patch.application_id;
          delete patch.talent_pool_id;
          if (Object.keys(patch).length > 0) {
            await supabaseAdmin.from("crm_contacts").update(patch).eq("id", row.id).eq("org_id", orgId);
          }
        }
      }
      return;
    }

    const base = {
      org_id: orgId,
      first_name: first,
      last_name: last,
      email,
      phone: c.phone ?? null,
      linkedin_url: c.linkedinUrl ?? null,
      contact_type: "candidate",
      notes: c.source === "talent_pool" ? "Added automatically from the Talent Pool" : "Added automatically from Applicants",
      created_by: createdBy,
    };
    const { error } = await supabaseAdmin.from("crm_contacts").insert({
      ...base,
      source: c.source,
      application_id: c.applicationId ?? null,
      talent_pool_id: c.talentPoolId ?? null,
    });
    // Candidate capture must never break on a missed migration (174) — retry
    // with the base columns only.
    if (error && /source|application_id|talent_pool_id/i.test(error.message)) {
      const retry = await supabaseAdmin.from("crm_contacts").insert(base);
      if (retry.error) console.error("[crm-sync] candidate insert failed:", retry.error.message);
    } else if (error) {
      console.error("[crm-sync] candidate insert failed:", error.message);
    }
  } catch (e) {
    console.error("[crm-sync] candidate sync failed", e);
  }
}
