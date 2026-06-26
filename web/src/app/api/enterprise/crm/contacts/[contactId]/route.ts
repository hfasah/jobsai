import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crmContext } from "@/lib/enterprise-crm";

type Ctx = { params: Promise<{ contactId: string }> };

// GET — contact (with company) + its activities and tasks.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const { contactId } = await params;

  const { data: contact, error } = await supabaseAdmin
    .from("crm_contacts")
    .select("*, company:crm_companies(id, name)")
    .eq("id", contactId)
    .eq("org_id", ctx.org.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  const [activities, tasks, submissions] = await Promise.all([
    supabaseAdmin.from("crm_activities").select("*").eq("org_id", ctx.org.id).eq("contact_id", contactId).order("occurred_at", { ascending: false }).limit(100),
    supabaseAdmin.from("crm_tasks").select("*").eq("org_id", ctx.org.id).eq("contact_id", contactId).order("due_at", { ascending: true, nullsFirst: false }),
    supabaseAdmin.from("crm_submissions").select("*, job_order:crm_job_orders(id, title)").eq("org_id", ctx.org.id).eq("contact_id", contactId).order("submitted_at", { ascending: false }),
  ]);

  return NextResponse.json({ data: contact, activities: activities.data ?? [], tasks: tasks.data ?? [], submissions: submissions.data ?? [] });
}

const EDITABLE = [
  "company_id", "first_name", "last_name", "title", "email", "phone", "linkedin_url",
  "contact_type", "relationship_status", "tags", "notes", "owner_id",
  "last_contacted_at", "next_follow_up_at",
] as const;

export async function PUT(req: NextRequest, { params }: Ctx) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const { contactId } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.company_id) {
    const { data: co } = await supabaseAdmin
      .from("crm_companies").select("id").eq("id", body.company_id).eq("org_id", ctx.org.id).maybeSingle();
    if (!co) return NextResponse.json({ error: "Company not found." }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of EDITABLE) if (k in body) update[k] = body[k];
  if (typeof update.first_name === "string" && !update.first_name.trim()) {
    return NextResponse.json({ error: "First name cannot be empty." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("crm_contacts")
    .update(update)
    .eq("id", contactId)
    .eq("org_id", ctx.org.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const { contactId } = await params;

  const { error } = await supabaseAdmin
    .from("crm_contacts").delete().eq("id", contactId).eq("org_id", ctx.org.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
