import { supabaseAdmin } from "@/lib/supabase";

// Domain that receives candidate resumes. Each org gets <handle>@<this domain>.
// Configurable so staging can use a different inbound domain.
export const INTAKE_DOMAIN = process.env.ENTERPRISE_INTAKE_DOMAIN ?? "apply.jobsai.work";

// The org's intake handle (mailbox local-part). Defaults to the slug until the
// org customises it.
export function intakeHandle(org: { slug: string; intake_email_handle?: string | null }): string {
  return (org.intake_email_handle ?? org.slug).toLowerCase();
}

export function intakeAddress(org: { slug: string; intake_email_handle?: string | null }): string {
  return `${intakeHandle(org)}@${INTAKE_DOMAIN}`;
}

// "Jane Doe <jane@acme.com>" → { name, email }; bare "jane@acme.com" → { email }.
export function parseAddress(raw: string | null | undefined): { name: string | null; email: string } {
  const s = (raw ?? "").trim();
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  return { name: null, email: s.toLowerCase() };
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
export function firstEmail(text: string | null | undefined): string | null {
  const m = (text ?? "").match(EMAIL_RE);
  return m ? m[0].toLowerCase() : null;
}

// Resolve which org an inbound message is for by matching the recipient(s)
// against the intake domain + each org's handle. Returns null if none match.
export async function resolveIntakeOrg(
  toList: string[],
): Promise<{ id: string; slug: string } | null> {
  const handles = [...new Set(
    toList
      .map((addr) => parseAddress(addr).email)
      .filter((e) => e.endsWith(`@${INTAKE_DOMAIN}`))
      .map((e) => e.split("@")[0].trim().toLowerCase())
      .filter(Boolean),
  )];
  if (!handles.length) return null;

  // Match a custom handle OR the slug, case-INSENSITIVELY. The handle is stored
  // lowercased, but slugs/legacy rows may carry mixed case, so a plain `in`
  // (case-sensitive) misses them — which surfaces as a dropped forwarding email
  // ("no-intake-match"). Handles are validated to [a-z0-9-], so they carry no
  // ilike wildcards.
  const conds = handles.flatMap((h) => [
    `intake_email_handle.ilike.${h}`,
    `slug.ilike.${h}`,
  ]);
  const { data } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("id, slug, intake_email_handle")
    .or(conds.join(","))
    .limit(1);
  const org = data?.[0] as { id: string; slug: string } | undefined;
  return org ?? null;
}

// Find (or lazily create) the org's catch-all "General Applications" job, so
// candidates with no specific posting still land in the inbox.
export async function getOrCreateIntakePool(orgId: string, createdBy: string): Promise<string | null> {
  const { data: existing } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("id")
    .eq("org_id", orgId)
    .eq("is_intake_pool", true)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created } = await supabaseAdmin
    .from("enterprise_jobs")
    .insert({
      org_id: orgId,
      title: "General Applications",
      department: "Talent Pool",
      status: "active",
      is_intake_pool: true,
      created_by: createdBy,
      description: "Catch-all pool for resumes received by email or uploaded for review.",
    })
    .select("id")
    .single();
  return created?.id ?? null;
}

export interface IntakeCandidate {
  orgId: string;
  jobId: string;
  name: string;
  email: string;
  phone?: string | null;
  resumeText?: string | null;
  resumeUrl?: string | null;
  source: "email" | "upload";
  coverLetter?: string | null;
}

// Create an application from an intake (email/upload), de-duplicating on email
// within the job. Returns { id, deduped }.
export async function createIntakeApplication(
  c: IntakeCandidate,
): Promise<{ id: string | null; deduped: boolean }> {
  const email = c.email.trim().toLowerCase();

  const { data: dup } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id")
    .eq("job_id", c.jobId)
    .eq("candidate_email", email)
    .maybeSingle();
  if (dup?.id) return { id: dup.id, deduped: true };

  const { data, error } = await supabaseAdmin
    .from("enterprise_applications")
    .insert({
      job_id: c.jobId,
      org_id: c.orgId,
      candidate_name: c.name.trim() || email.split("@")[0],
      candidate_email: email,
      candidate_phone: c.phone ?? null,
      resume_text: c.resumeText ?? null,
      resume_url: c.resumeUrl ?? null,
      cover_letter: c.coverLetter ?? null,
      source: c.source,
      stage: "applied",
      triaged: false,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[intake] insert application failed:", error.message);
    return { id: null, deduped: false };
  }
  return { id: data.id, deduped: false };
}
