import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crmContext } from "@/lib/enterprise-crm";

type Ctx = { params: Promise<{ jobOrderId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const { jobOrderId } = await params;

  const { data: jobOrder, error } = await supabaseAdmin
    .from("crm_job_orders")
    .select("*, company:crm_companies(id, name), contact:crm_contacts(id, first_name, last_name), deal:crm_deals(id, name, stage)")
    .eq("id", jobOrderId)
    .eq("org_id", ctx.org.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!jobOrder) return NextResponse.json({ error: "Job order not found." }, { status: 404 });

  // If a posting is linked, surface its live candidate count from the ATS.
  let linkedJob: { id: string; title: string; status: string; candidate_count: number } | null = null;
  if (jobOrder.job_id) {
    const [{ data: job }, { count }] = await Promise.all([
      supabaseAdmin.from("enterprise_jobs").select("id, title, status").eq("id", jobOrder.job_id).eq("org_id", ctx.org.id).maybeSingle(),
      supabaseAdmin.from("enterprise_applications").select("id", { count: "exact", head: true }).eq("org_id", ctx.org.id).eq("job_id", jobOrder.job_id),
    ]);
    if (job) linkedJob = { ...job, candidate_count: count ?? 0 };
  }

  const [activities, tasks] = await Promise.all([
    supabaseAdmin.from("crm_activities").select("*").eq("org_id", ctx.org.id).eq("job_order_id", jobOrderId).order("occurred_at", { ascending: false }).limit(100),
    supabaseAdmin.from("crm_tasks").select("*").eq("org_id", ctx.org.id).eq("job_order_id", jobOrderId).order("due_at", { ascending: true, nullsFirst: false }),
  ]);

  return NextResponse.json({ data: jobOrder, linkedJob, activities: activities.data ?? [], tasks: tasks.data ?? [] });
}

const EDITABLE = [
  "company_id", "contact_id", "deal_id", "job_id", "title", "job_type", "status", "priority",
  "openings", "location", "work_mode", "salary_min", "salary_max", "pay_rate", "bill_rate",
  "fee_pct", "markup", "placement_value", "expected_close_at", "description", "internal_notes", "assigned_recruiter",
] as const;

export async function PUT(req: NextRequest, { params }: Ctx) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const { jobOrderId } = await params;
  const body = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of EDITABLE) if (k in body) update[k] = body[k] === "" ? null : body[k];
  if (typeof update.title === "string" && !update.title.trim()) {
    return NextResponse.json({ error: "Job title cannot be empty." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("crm_job_orders")
    .update(update)
    .eq("id", jobOrderId)
    .eq("org_id", ctx.org.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const { jobOrderId } = await params;

  const { error } = await supabaseAdmin.from("crm_job_orders").delete().eq("id", jobOrderId).eq("org_id", ctx.org.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
