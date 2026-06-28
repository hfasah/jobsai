import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

// POST /api/enterprise/jobs/[jobId]/applications/bulk
// body: { ids: string[], action: "move_stage" | "reject" | "add_tag" | "remove_tag", stage?: string, tag?: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId } = await params;
  const body = await req.json().catch(() => ({}));

  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
  if (!ids.length) return NextResponse.json({ error: "No application IDs provided." }, { status: 400 });

  const action: string = body.action;

  if (action === "move_stage" || action === "reject") {
    const stage = action === "reject" ? "rejected" : body.stage;
    if (!stage) return NextResponse.json({ error: "Stage is required." }, { status: 400 });

    await supabaseAdmin
      .from("enterprise_applications")
      .update({ stage, stage_updated_at: new Date().toISOString() })
      .in("id", ids)
      .eq("org_id", org.id)
      .eq("job_id", jobId);
  } else if (action === "move_to_job") {
    // Move selected candidates into another job's pipeline (e.g. out of the
    // General Applications intake pool). They enter as fresh, unscreened
    // applicants so they can be screened against the target role.
    const targetJobId: string = body.target_job_id;
    if (!targetJobId) return NextResponse.json({ error: "Target job is required." }, { status: 400 });
    if (targetJobId === jobId) return NextResponse.json({ error: "Pick a different job." }, { status: 400 });
    const { data: target } = await supabaseAdmin
      .from("enterprise_jobs").select("id").eq("id", targetJobId).eq("org_id", org.id).maybeSingle();
    if (!target) return NextResponse.json({ error: "Target job not found." }, { status: 404 });

    await supabaseAdmin
      .from("enterprise_applications")
      .update({ job_id: targetJobId, pool_id: null, stage: "applied", stage_updated_at: new Date().toISOString(), screened_at: null, triaged: false })
      .in("id", ids)
      .eq("org_id", org.id)
      .eq("job_id", jobId);
  } else if (action === "add_tag") {
    const tag: string = body.tag;
    if (!tag) return NextResponse.json({ error: "Tag is required." }, { status: 400 });
    // Fetch current tags and append
    const { data: apps } = await supabaseAdmin
      .from("enterprise_applications")
      .select("id, tags")
      .in("id", ids)
      .eq("org_id", org.id);

    for (const app of apps ?? []) {
      const tags: string[] = app.tags ?? [];
      if (!tags.includes(tag)) {
        await supabaseAdmin.from("enterprise_applications").update({ tags: [...tags, tag] }).eq("id", app.id);
      }
    }
  } else if (action === "remove_tag") {
    const tag: string = body.tag;
    const { data: apps } = await supabaseAdmin
      .from("enterprise_applications")
      .select("id, tags")
      .in("id", ids)
      .eq("org_id", org.id);

    for (const app of apps ?? []) {
      await supabaseAdmin
        .from("enterprise_applications")
        .update({ tags: (app.tags ?? []).filter((t: string) => t !== tag) })
        .eq("id", app.id);
    }
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, affected: ids.length });
}
