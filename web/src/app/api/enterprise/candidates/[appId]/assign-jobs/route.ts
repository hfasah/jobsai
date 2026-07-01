import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requirePermission } from "@/lib/enterprise-permissions";

export const maxDuration = 30;
type Ctx = { params: Promise<{ appId: string }> };

// Fields that define the candidate (copied into each target job's pipeline).
const COPY_FIELDS = [
  "candidate_name", "candidate_email", "candidate_phone", "candidate_location",
  "resume_text", "resume_url", "resume_storage_key", "cover_letter",
  "tags", "linkedin_url", "portfolio_url",
] as const;

// POST { job_ids: string[] } — assign an existing candidate to one or more jobs.
// Each target gets its OWN application row (same candidate, new pipeline) so the
// candidate can be screened/interviewed against multiple postings independently.
// De-duped: skips jobs where the candidate's email is already an applicant.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(userId, "can_move_stages");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { appId } = await params;

  const { job_ids } = await req.json().catch(() => ({}));
  if (!Array.isArray(job_ids) || job_ids.length === 0) {
    return NextResponse.json({ error: "Pick at least one job." }, { status: 400 });
  }

  // Source candidate (org-scoped).
  const { data: src } = await supabaseAdmin
    .from("enterprise_applications")
    .select(COPY_FIELDS.join(","))
    .eq("id", appId).eq("org_id", org.id).maybeSingle();
  if (!src) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  const s = src as unknown as Record<string, unknown>;
  const email = String(s.candidate_email ?? "").toLowerCase();

  // Validate the target jobs belong to this org.
  const { data: jobs } = await supabaseAdmin
    .from("enterprise_jobs").select("id").eq("org_id", org.id).in("id", job_ids);
  const validJobIds = new Set((jobs ?? []).map((j) => j.id));

  // Which of those already have this candidate?
  const { data: existing } = await supabaseAdmin
    .from("enterprise_applications")
    .select("job_id").eq("org_id", org.id).eq("candidate_email", email)
    .in("job_id", [...validJobIds]);
  const alreadyIn = new Set((existing ?? []).map((e) => e.job_id));

  let created = 0, skipped = 0;
  for (const jobId of job_ids as string[]) {
    if (!validJobIds.has(jobId)) { skipped++; continue; }
    if (alreadyIn.has(jobId)) { skipped++; continue; }
    const row: Record<string, unknown> = { org_id: org.id, job_id: jobId, stage: "applied", source: "assigned", triaged: false };
    for (const f of COPY_FIELDS) row[f] = s[f] ?? null;
    const { error } = await supabaseAdmin.from("enterprise_applications").insert(row);
    if (error) { skipped++; continue; }
    created++;
  }

  return NextResponse.json({ data: { created, skipped } });
}
