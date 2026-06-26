import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crmContext } from "@/lib/enterprise-crm";

type Ctx = { params: Promise<{ companyId: string }> };

// GET — company + its contacts, activities, and tasks (for the detail page).
export async function GET(_req: NextRequest, { params }: Ctx) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const { companyId } = await params;

  const { data: company, error } = await supabaseAdmin
    .from("crm_companies")
    .select("*")
    .eq("id", companyId)
    .eq("org_id", ctx.org.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const [contacts, activities, tasks, jobOrders, deals, submissions] = await Promise.all([
    supabaseAdmin.from("crm_contacts").select("*").eq("org_id", ctx.org.id).eq("company_id", companyId).order("created_at", { ascending: false }),
    supabaseAdmin.from("crm_activities").select("*").eq("org_id", ctx.org.id).eq("company_id", companyId).order("occurred_at", { ascending: false }).limit(100),
    supabaseAdmin.from("crm_tasks").select("*").eq("org_id", ctx.org.id).eq("company_id", companyId).order("due_at", { ascending: true, nullsFirst: false }),
    // job orders/deals/submissions tables exist from migrations 118/119.
    supabaseAdmin.from("crm_job_orders").select("*").eq("org_id", ctx.org.id).eq("company_id", companyId).order("created_at", { ascending: false }),
    supabaseAdmin.from("crm_deals").select("*").eq("org_id", ctx.org.id).eq("company_id", companyId).order("created_at", { ascending: false }),
    supabaseAdmin.from("crm_submissions").select("*, job_order:crm_job_orders(id, title)").eq("org_id", ctx.org.id).eq("company_id", companyId).order("submitted_at", { ascending: false }),
  ]);

  return NextResponse.json({
    data: company,
    contacts: contacts.data ?? [],
    activities: activities.data ?? [],
    tasks: tasks.data ?? [],
    jobOrders: jobOrders.data ?? [],
    deals: deals.data ?? [],
    submissions: submissions.data ?? [],
  });
}

const EDITABLE = [
  "name", "industry", "website", "location", "size", "status", "source",
  "tags", "notes", "owner_id", "next_follow_up_at",
] as const;

// PUT — update editable fields (org-scoped).
export async function PUT(req: NextRequest, { params }: Ctx) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of EDITABLE) if (k in body) update[k] = body[k];
  if (typeof update.name === "string" && !update.name.trim()) {
    return NextResponse.json({ error: "Company name cannot be empty." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("crm_companies")
    .update(update)
    .eq("id", companyId)
    .eq("org_id", ctx.org.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE — remove the company (contacts cascade to null, activities/tasks cascade).
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const { companyId } = await params;

  const { error } = await supabaseAdmin
    .from("crm_companies")
    .delete()
    .eq("id", companyId)
    .eq("org_id", ctx.org.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
