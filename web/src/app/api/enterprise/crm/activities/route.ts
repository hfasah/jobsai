import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crmContext, ACTIVITY_TYPES } from "@/lib/enterprise-crm";

// GET /api/enterprise/crm/activities?company_id=&contact_id=&type=&limit=
export async function GET(req: NextRequest) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;

  const sp = req.nextUrl.searchParams;
  let q = supabaseAdmin
    .from("crm_activities")
    .select("*, company:crm_companies(id, name), contact:crm_contacts(id, first_name, last_name)")
    .eq("org_id", ctx.org.id)
    .order("occurred_at", { ascending: false })
    .limit(Math.min(Number(sp.get("limit")) || 100, 300));

  const companyId = sp.get("company_id");
  if (companyId) q = q.eq("company_id", companyId);
  const contactId = sp.get("contact_id");
  if (contactId) q = q.eq("contact_id", contactId);
  const type = sp.get("type");
  if (type && type !== "all") q = q.eq("type", type);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST — log an activity. Bumps the parent company's last_activity_at and the
// contact's last_contacted_at so dashboards/lists reflect recency.
export async function POST(req: NextRequest) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;

  const body = await req.json().catch(() => ({}));
  const type = ACTIVITY_TYPES.includes(body.type) ? body.type : "note";
  if (!body.subject?.trim() && !body.body?.trim()) {
    return NextResponse.json({ error: "Add a subject or note." }, { status: 400 });
  }

  // Validate any supplied parent refs belong to this org.
  const companyId = body.company_id || null;
  const contactId = body.contact_id || null;
  if (companyId) {
    const { data } = await supabaseAdmin.from("crm_companies").select("id").eq("id", companyId).eq("org_id", ctx.org.id).maybeSingle();
    if (!data) return NextResponse.json({ error: "Company not found." }, { status: 400 });
  }
  if (contactId) {
    const { data } = await supabaseAdmin.from("crm_contacts").select("id").eq("id", contactId).eq("org_id", ctx.org.id).maybeSingle();
    if (!data) return NextResponse.json({ error: "Contact not found." }, { status: 400 });
  }

  const occurredAt = body.occurred_at || new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("crm_activities")
    .insert({
      org_id: ctx.org.id,
      type,
      company_id: companyId,
      contact_id: contactId,
      deal_id: body.deal_id || null,
      job_order_id: body.job_order_id || null,
      subject: body.subject?.trim() || null,
      body: body.body?.trim() || null,
      outcome: body.outcome?.trim() || null,
      next_step: body.next_step?.trim() || null,
      occurred_at: occurredAt,
      reminder_at: body.reminder_at || null,
      owner_id: body.owner_id || ctx.userId,
      created_by: ctx.userId,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Recency bumps (best-effort).
  if (companyId) {
    await supabaseAdmin.from("crm_companies").update({ last_activity_at: occurredAt }).eq("id", companyId).eq("org_id", ctx.org.id);
  }
  if (contactId) {
    await supabaseAdmin.from("crm_contacts").update({ last_contacted_at: occurredAt }).eq("id", contactId).eq("org_id", ctx.org.id);
  }

  return NextResponse.json({ data }, { status: 201 });
}
