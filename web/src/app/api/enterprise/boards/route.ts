import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { count } = await supabaseAdmin
    .from("enterprise_jobs").select("id", { count: "exact", head: true })
    .eq("org_id", org.id).eq("status", "active");

  return NextResponse.json({ data: {
    slug: org.slug,
    connected: (org as { connected_boards?: string[] }).connected_boards ?? [],
    active_jobs: count ?? 0,
  } });
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const connected: string[] = Array.isArray(body.connected) ? body.connected : [];

  const { error } = await supabaseAdmin.from("enterprise_orgs").update({ connected_boards: connected }).eq("id", org.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
