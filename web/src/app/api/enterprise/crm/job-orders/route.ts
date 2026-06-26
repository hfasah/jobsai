import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crmContext, JOB_TYPES, JOB_ORDER_STATUSES, PRIORITIES } from "@/lib/enterprise-crm";

// GET /api/enterprise/crm/job-orders?status=&priority=&recruiter=&company_id=
export async function GET(req: NextRequest) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;

  const sp = req.nextUrl.searchParams;
  let q = supabaseAdmin
    .from("crm_job_orders")
    .select("*, company:crm_companies(id, name), contact:crm_contacts(id, first_name, last_name)")
    .eq("org_id", ctx.org.id)
    .order("created_at", { ascending: false });

  const status = sp.get("status");
  if (status && status !== "all") q = q.eq("status", status);
  const priority = sp.get("priority");
  if (priority && priority !== "all") q = q.eq("priority", priority);
  const recruiter = sp.get("recruiter");
  if (recruiter) q = q.eq("assigned_recruiter", recruiter);
  const companyId = sp.get("company_id");
  if (companyId) q = q.eq("company_id", companyId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

const NUM = (v: unknown) => (v != null && v !== "" ? Number(v) : null);

// POST /api/enterprise/crm/job-orders
export async function POST(req: NextRequest) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;

  const body = await req.json().catch(() => ({}));
  if (!body.title?.trim()) return NextResponse.json({ error: "Job title is required." }, { status: 400 });
  if (!body.company_id) return NextResponse.json({ error: "A client company is required." }, { status: 400 });

  const { data: co } = await supabaseAdmin.from("crm_companies").select("id").eq("id", body.company_id).eq("org_id", ctx.org.id).maybeSingle();
  if (!co) return NextResponse.json({ error: "Company not found." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("crm_job_orders")
    .insert({
      org_id: ctx.org.id,
      company_id: body.company_id,
      contact_id: body.contact_id || null,
      deal_id: body.deal_id || null,
      job_id: body.job_id || null,
      title: body.title.trim(),
      job_type: JOB_TYPES.includes(body.job_type) ? body.job_type : "permanent",
      status: JOB_ORDER_STATUSES.includes(body.status) ? body.status : "intake",
      priority: PRIORITIES.includes(body.priority) ? body.priority : "medium",
      openings: NUM(body.openings) ?? 1,
      location: body.location?.trim() || null,
      work_mode: body.work_mode || null,
      salary_min: NUM(body.salary_min),
      salary_max: NUM(body.salary_max),
      pay_rate: NUM(body.pay_rate),
      bill_rate: NUM(body.bill_rate),
      fee_pct: NUM(body.fee_pct),
      markup: NUM(body.markup),
      placement_value: NUM(body.placement_value),
      expected_close_at: body.expected_close_at || null,
      description: body.description?.trim() || null,
      internal_notes: body.internal_notes?.trim() || null,
      assigned_recruiter: body.assigned_recruiter || ctx.userId,
      created_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
