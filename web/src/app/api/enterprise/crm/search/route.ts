import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crmContext } from "@/lib/enterprise-crm";

// GET /api/enterprise/crm/search?q= — global search across companies, contacts,
// job orders, and deals. Org-scoped; returns small grouped result sets.
export async function GET(req: NextRequest) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const orgId = ctx.org.id;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ companies: [], contacts: [], jobOrders: [], deals: [] });

  const like = `%${q}%`;
  const [companies, contacts, jobOrders, deals] = await Promise.all([
    supabaseAdmin.from("crm_companies").select("id, name, status, industry").eq("org_id", orgId).or(`name.ilike.${like},industry.ilike.${like},location.ilike.${like}`).limit(8),
    supabaseAdmin.from("crm_contacts").select("id, first_name, last_name, title, company:crm_companies(name)").eq("org_id", orgId).or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},title.ilike.${like}`).limit(8),
    supabaseAdmin.from("crm_job_orders").select("id, title, status, company:crm_companies(name)").eq("org_id", orgId).or(`title.ilike.${like},location.ilike.${like}`).limit(8),
    supabaseAdmin.from("crm_deals").select("id, name, stage, company:crm_companies(name)").eq("org_id", orgId).or(`name.ilike.${like}`).limit(8),
  ]);

  return NextResponse.json({
    companies: companies.data ?? [],
    contacts: contacts.data ?? [],
    jobOrders: jobOrders.data ?? [],
    deals: deals.data ?? [],
  });
}
