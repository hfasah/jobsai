import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crmContext } from "@/lib/enterprise-crm";

// GET /api/enterprise/crm/contacts?company_id=&status=&owner=&tag=&q=
// Returns contacts with their company name embedded for list display.
export async function GET(req: NextRequest) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;

  const sp = req.nextUrl.searchParams;
  let q = supabaseAdmin
    .from("crm_contacts")
    .select("*, company:crm_companies(id, name)")
    .eq("org_id", ctx.org.id)
    .order("created_at", { ascending: false });

  const companyId = sp.get("company_id");
  if (companyId) q = q.eq("company_id", companyId);
  const status = sp.get("status");
  if (status && status !== "all") q = q.eq("relationship_status", status);
  const owner = sp.get("owner");
  if (owner) q = q.eq("owner_id", owner);
  const tag = sp.get("tag");
  if (tag) q = q.contains("tags", [tag]);
  const search = sp.get("q")?.trim();
  if (search) q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,title.ilike.%${search}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/enterprise/crm/contacts
export async function POST(req: NextRequest) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;

  const body = await req.json().catch(() => ({}));
  if (!body.first_name?.trim()) return NextResponse.json({ error: "First name is required." }, { status: 400 });

  // If a company is supplied, verify it belongs to this org (prevent cross-org linking).
  if (body.company_id) {
    const { data: co } = await supabaseAdmin
      .from("crm_companies").select("id").eq("id", body.company_id).eq("org_id", ctx.org.id).maybeSingle();
    if (!co) return NextResponse.json({ error: "Company not found." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("crm_contacts")
    .insert({
      org_id: ctx.org.id,
      company_id: body.company_id || null,
      first_name: body.first_name.trim(),
      last_name: body.last_name?.trim() || null,
      title: body.title?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      linkedin_url: body.linkedin_url?.trim() || null,
      contact_type: body.contact_type || "other",
      relationship_status: body.relationship_status || "new",
      tags: Array.isArray(body.tags) ? body.tags : [],
      notes: body.notes?.trim() || null,
      owner_id: body.owner_id || ctx.userId,
      next_follow_up_at: body.next_follow_up_at || null,
      created_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
