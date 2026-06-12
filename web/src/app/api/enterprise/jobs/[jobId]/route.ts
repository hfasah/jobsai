import { auth } from "@clerk/nextjs/server";
import { requirePermission } from "@/lib/enterprise-permissions";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { sendWebhookEvent } from "@/lib/enterprise-webhooks";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId } = await params;

  const { data, error } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("org_id", org.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(userId, "can_manage_jobs");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId } = await params;
  const body = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  const fields = ["title","department","location","employment_type","description","responsibilities","qualifications","nice_to_have","salary_min","salary_max","salary_currency","status","closes_at","hiring_manager_id"];
  for (const f of fields) if (body[f] !== undefined) update[f] = body[f];
  if (body.status === "active" && body.published_at === undefined) update.published_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("enterprise_jobs")
    .update(update)
    .eq("id", jobId)
    .eq("org_id", org.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.status === "closed" || body.status === "paused") {
    sendWebhookEvent(org.id, "job.closed", {
      job_id: jobId,
      title: data.title,
      status: data.status,
    }).catch(() => {});
  }

  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(userId, "can_manage_jobs");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId } = await params;

  const { error } = await supabaseAdmin
    .from("enterprise_jobs")
    .delete()
    .eq("id", jobId)
    .eq("org_id", org.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
