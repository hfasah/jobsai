import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crmContext, DEAL_STAGES } from "@/lib/enterprise-crm";

// GET /api/enterprise/crm/deals?stage=&owner=&company_id=
export async function GET(req: NextRequest) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;

  const sp = req.nextUrl.searchParams;
  let q = supabaseAdmin
    .from("crm_deals")
    .select("*, company:crm_companies(id, name), contact:crm_contacts(id, first_name, last_name)")
    .eq("org_id", ctx.org.id)
    .order("created_at", { ascending: false });

  const stage = sp.get("stage");
  if (stage && stage !== "all") q = q.eq("stage", stage);
  const owner = sp.get("owner");
  if (owner) q = q.eq("owner_id", owner);
  const companyId = sp.get("company_id");
  if (companyId) q = q.eq("company_id", companyId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/enterprise/crm/deals
export async function POST(req: NextRequest) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;

  const body = await req.json().catch(() => ({}));
  if (!body.name?.trim()) return NextResponse.json({ error: "Deal name is required." }, { status: 400 });
  const stage = DEAL_STAGES.includes(body.stage) ? body.stage : "lead";

  if (body.company_id) {
    const { data } = await supabaseAdmin.from("crm_companies").select("id").eq("id", body.company_id).eq("org_id", ctx.org.id).maybeSingle();
    if (!data) return NextResponse.json({ error: "Company not found." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("crm_deals")
    .insert({
      org_id: ctx.org.id,
      name: body.name.trim(),
      company_id: body.company_id || null,
      contact_id: body.contact_id || null,
      value: body.value != null && body.value !== "" ? Number(body.value) : null,
      stage,
      probability: body.probability != null && body.probability !== "" ? Number(body.probability) : null,
      expected_close_at: body.expected_close_at || null,
      next_action: body.next_action?.trim() || null,
      notes: body.notes?.trim() || null,
      owner_id: body.owner_id || ctx.userId,
      created_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
