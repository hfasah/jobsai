import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crmContext } from "@/lib/enterprise-crm";
import { pushCompanyToPipedrive } from "@/lib/pipedrive";

// GET /api/enterprise/crm/companies?status=&owner=&tag=&q=
export async function GET(req: NextRequest) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;

  const sp = req.nextUrl.searchParams;
  let q = supabaseAdmin
    .from("crm_companies")
    .select("*")
    .eq("org_id", ctx.org.id)
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const status = sp.get("status");
  if (status && status !== "all") q = q.eq("status", status);
  const owner = sp.get("owner");
  if (owner) q = q.eq("owner_id", owner);
  const tag = sp.get("tag");
  if (tag) q = q.contains("tags", [tag]);
  const search = sp.get("q")?.trim();
  if (search) q = q.or(`name.ilike.%${search}%,industry.ilike.%${search}%,location.ilike.%${search}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/enterprise/crm/companies
export async function POST(req: NextRequest) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;

  const body = await req.json().catch(() => ({}));
  if (!body.name?.trim()) return NextResponse.json({ error: "Company name is required." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("crm_companies")
    .insert({
      org_id: ctx.org.id,
      name: body.name.trim(),
      industry: body.industry?.trim() || null,
      website: body.website?.trim() || null,
      location: body.location?.trim() || null,
      size: body.size?.trim() || null,
      status: body.status || "prospect",
      source: body.source?.trim() || null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      notes: body.notes?.trim() || null,
      owner_id: body.owner_id || ctx.userId,
      next_follow_up_at: body.next_follow_up_at || null,
      created_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mirror to Pipedrive if connected (no-op otherwise). Backgrounded so the
  // response isn't blocked on an external API.
  after(() => pushCompanyToPipedrive(ctx.org.id, data.id).catch(() => {}));

  return NextResponse.json({ data }, { status: 201 });
}
