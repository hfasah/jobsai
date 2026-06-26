import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crmContext } from "@/lib/enterprise-crm";

type Ctx = { params: Promise<{ dealId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const { dealId } = await params;

  const { data: deal, error } = await supabaseAdmin
    .from("crm_deals")
    .select("*, company:crm_companies(id, name), contact:crm_contacts(id, first_name, last_name)")
    .eq("id", dealId)
    .eq("org_id", ctx.org.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!deal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });

  const [activities, tasks, jobOrders] = await Promise.all([
    supabaseAdmin.from("crm_activities").select("*").eq("org_id", ctx.org.id).eq("deal_id", dealId).order("occurred_at", { ascending: false }).limit(100),
    supabaseAdmin.from("crm_tasks").select("*").eq("org_id", ctx.org.id).eq("deal_id", dealId).order("due_at", { ascending: true, nullsFirst: false }),
    supabaseAdmin.from("crm_job_orders").select("id, title, status").eq("org_id", ctx.org.id).eq("deal_id", dealId).order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({ data: deal, activities: activities.data ?? [], tasks: tasks.data ?? [], jobOrders: jobOrders.data ?? [] });
}

const EDITABLE = ["name", "company_id", "contact_id", "value", "stage", "probability", "expected_close_at", "next_action", "notes", "owner_id"] as const;

export async function PUT(req: NextRequest, { params }: Ctx) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const { dealId } = await params;
  const body = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of EDITABLE) if (k in body) update[k] = body[k];
  if (typeof update.name === "string" && !update.name.trim()) {
    return NextResponse.json({ error: "Deal name cannot be empty." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("crm_deals")
    .update(update)
    .eq("id", dealId)
    .eq("org_id", ctx.org.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const { dealId } = await params;

  const { error } = await supabaseAdmin.from("crm_deals").delete().eq("id", dealId).eq("org_id", ctx.org.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
