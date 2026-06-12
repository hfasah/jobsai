import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, getMyMembership } from "@/lib/enterprise";

type Ctx = { params: Promise<{ appId: string }> };

// PATCH — HM approves, rejects, requests more info, or adds notes
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const membership = await getMyMembership(userId);
  if (!membership) return NextResponse.json({ error: "Not a member." }, { status: 403 });

  // Only hiring managers, department heads, admins, and owners can make HM decisions
  const allowedRoles = ["owner", "admin", "recruiter", "hiring_manager", "department_head"];
  if (!allowedRoles.includes(membership.role)) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const { appId } = await params;
  const body = await req.json().catch(() => ({}));
  const { action, notes, stage } = body as { action?: string; notes?: string; stage?: string };

  // Verify the application belongs to this org
  const { data: app } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id,job_id,stage,hm_decision, job:enterprise_jobs(hiring_manager_id)")
    .eq("id", appId)
    .eq("org_id", org.id)
    .maybeSingle();

  if (!app) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  // For hiring_manager role, verify they own the job (or allow if no HM assigned)
  if (membership.role === "hiring_manager") {
    const hmId = (app.job as unknown as { hiring_manager_id: string | null } | null)?.hiring_manager_id;
    if (hmId && hmId !== userId) {
      return NextResponse.json({ error: "Not your job." }, { status: 403 });
    }
  }

  if (action === "approve") {
    // Advance to offer stage
    await supabaseAdmin
      .from("enterprise_applications")
      .update({
        hm_decision: "approved",
        hm_decision_at: new Date().toISOString(),
        hm_notes: notes ?? null,
        stage: "offer",
        stage_updated_at: new Date().toISOString(),
      })
      .eq("id", appId);
    return NextResponse.json({ ok: true, new_stage: "offer" });
  }

  if (action === "reject") {
    await supabaseAdmin
      .from("enterprise_applications")
      .update({
        hm_decision: "rejected",
        hm_decision_at: new Date().toISOString(),
        hm_notes: notes ?? null,
        stage: "rejected",
        stage_updated_at: new Date().toISOString(),
      })
      .eq("id", appId);
    return NextResponse.json({ ok: true, new_stage: "rejected" });
  }

  if (action === "more_info") {
    await supabaseAdmin
      .from("enterprise_applications")
      .update({
        hm_decision: "more_info",
        hm_decision_at: new Date().toISOString(),
        hm_notes: notes ?? null,
      })
      .eq("id", appId);
    return NextResponse.json({ ok: true });
  }

  if (action === "move_stage" && stage) {
    const validStages = ["applied", "screened", "interview", "offer", "hired", "rejected"];
    if (!validStages.includes(stage)) {
      return NextResponse.json({ error: "Invalid stage." }, { status: 400 });
    }
    await supabaseAdmin
      .from("enterprise_applications")
      .update({
        stage,
        stage_updated_at: new Date().toISOString(),
        hm_decision: stage === "offer" || stage === "hired" ? "approved" : stage === "rejected" ? "rejected" : null,
        hm_decision_at: new Date().toISOString(),
        hm_notes: notes ?? null,
      })
      .eq("id", appId);
    return NextResponse.json({ ok: true, new_stage: stage });
  }

  if (action === "add_note") {
    await supabaseAdmin
      .from("enterprise_applications")
      .update({ hm_notes: notes ?? "" })
      .eq("id", appId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
