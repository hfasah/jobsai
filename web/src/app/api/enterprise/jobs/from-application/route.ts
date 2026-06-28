import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getMyOrg } from "@/lib/enterprise";
import { requirePermission } from "@/lib/enterprise-permissions";
import { supabaseAdmin } from "@/lib/supabase";
import { parseJobFromText, createDraftJobFromParsed } from "@/lib/job-intake";

export const maxDuration = 60;

// POST { application_id } — manual reclassify: a misfiled candidate is actually
// a job description. Parse its content into a draft job and remove the candidate
// entry. Used when auto-detection routed a JD to candidates.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(userId, "can_manage_jobs");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { application_id } = await req.json().catch(() => ({}));
  if (!application_id) return NextResponse.json({ error: "application_id required." }, { status: 400 });

  const { data: app } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id, resume_text, cover_letter, candidate_name")
    .eq("id", application_id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const text = `${app.candidate_name ?? ""}\n${app.resume_text ?? ""}\n${app.cover_letter ?? ""}`.trim();
  if (text.length < 30) return NextResponse.json({ error: "Not enough content to build a job." }, { status: 400 });

  const parsed = await parseJobFromText(text, { orgId: org.id, userId });
  const jobId = await createDraftJobFromParsed(org.id, parsed, userId);
  if (!jobId) return NextResponse.json({ error: "Couldn't extract a job from this — post it manually." }, { status: 422 });

  // It was a job, not a candidate — remove the misfiled candidate entry.
  await supabaseAdmin.from("enterprise_applications").delete().eq("id", application_id).eq("org_id", org.id);

  return NextResponse.json({ data: { job_id: jobId, title: parsed.title ?? null } });
}
