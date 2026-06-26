import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crmContext } from "@/lib/enterprise-crm";

// GET /api/enterprise/crm/tasks?status=&owner=&company_id=&contact_id=&scope=due|overdue|today
export async function GET(req: NextRequest) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;

  const sp = req.nextUrl.searchParams;
  let q = supabaseAdmin
    .from("crm_tasks")
    .select("*, company:crm_companies(id, name), contact:crm_contacts(id, first_name, last_name)")
    .eq("org_id", ctx.org.id)
    .order("due_at", { ascending: true, nullsFirst: false });

  const status = sp.get("status");
  if (status && status !== "all") q = q.eq("status", status);
  const owner = sp.get("owner");
  if (owner) q = q.eq("owner_id", owner);
  const companyId = sp.get("company_id");
  if (companyId) q = q.eq("company_id", companyId);
  const contactId = sp.get("contact_id");
  if (contactId) q = q.eq("contact_id", contactId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST — create a task / follow-up.
export async function POST(req: NextRequest) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;

  const body = await req.json().catch(() => ({}));
  if (!body.title?.trim()) return NextResponse.json({ error: "Task title is required." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("crm_tasks")
    .insert({
      org_id: ctx.org.id,
      title: body.title.trim(),
      status: "open",
      due_at: body.due_at || null,
      reminder_at: body.reminder_at || null,
      company_id: body.company_id || null,
      contact_id: body.contact_id || null,
      deal_id: body.deal_id || null,
      job_order_id: body.job_order_id || null,
      notes: body.notes?.trim() || null,
      owner_id: body.owner_id || ctx.userId,
      created_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
