import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crmContext, SUBMISSION_STATUSES } from "@/lib/enterprise-crm";

// GET /api/enterprise/crm/submissions?company_id=&job_order_id=&contact_id=&status=
export async function GET(req: NextRequest) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;

  const sp = req.nextUrl.searchParams;
  let q = supabaseAdmin
    .from("crm_submissions")
    .select("*, company:crm_companies(id, name), job_order:crm_job_orders(id, title), contact:crm_contacts(id, first_name, last_name)")
    .eq("org_id", ctx.org.id)
    .order("submitted_at", { ascending: false });

  for (const key of ["company_id", "job_order_id", "contact_id"] as const) {
    const v = sp.get(key);
    if (v) q = q.eq(key, v);
  }
  const status = sp.get("status");
  if (status && status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST — submit a candidate to a client (optionally for a specific job order).
// Logs a candidate_submitted activity so it threads onto the client timeline.
export async function POST(req: NextRequest) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;

  const body = await req.json().catch(() => ({}));
  if (!body.candidate_name?.trim()) return NextResponse.json({ error: "Candidate name is required." }, { status: 400 });
  if (!body.company_id) return NextResponse.json({ error: "A client company is required." }, { status: 400 });

  const { data: co } = await supabaseAdmin.from("crm_companies").select("id").eq("id", body.company_id).eq("org_id", ctx.org.id).maybeSingle();
  if (!co) return NextResponse.json({ error: "Company not found." }, { status: 400 });
  if (body.job_order_id) {
    const { data: jo } = await supabaseAdmin.from("crm_job_orders").select("id").eq("id", body.job_order_id).eq("org_id", ctx.org.id).maybeSingle();
    if (!jo) return NextResponse.json({ error: "Job order not found." }, { status: 400 });
  }

  const status = SUBMISSION_STATUSES.includes(body.status) ? body.status : "submitted";
  const submittedAt = body.submitted_at || new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("crm_submissions")
    .insert({
      org_id: ctx.org.id,
      company_id: body.company_id,
      job_order_id: body.job_order_id || null,
      contact_id: body.contact_id || null,
      application_id: body.application_id || null,
      candidate_name: body.candidate_name.trim(),
      candidate_email: body.candidate_email?.trim() || null,
      candidate_phone: body.candidate_phone?.trim() || null,
      resume_url: body.resume_url?.trim() || null,
      status,
      submitted_at: submittedAt,
      notes: body.notes?.trim() || null,
      owner_id: body.owner_id || ctx.userId,
      created_by: ctx.userId,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Thread onto the client timeline + bump recency (best-effort).
  await supabaseAdmin.from("crm_activities").insert({
    org_id: ctx.org.id, type: "candidate_submitted",
    company_id: body.company_id, contact_id: body.contact_id || null, job_order_id: body.job_order_id || null,
    subject: `Submitted ${data.candidate_name}`, occurred_at: submittedAt,
    owner_id: ctx.userId, created_by: ctx.userId,
  });
  await supabaseAdmin.from("crm_companies").update({ last_activity_at: submittedAt }).eq("id", body.company_id).eq("org_id", ctx.org.id);

  return NextResponse.json({ data }, { status: 201 });
}
