import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

// GET — named talent pools with a member count each.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const [{ data: groups }, { data: memberships }, { data: members }] = await Promise.all([
    supabaseAdmin.from("enterprise_talent_pool_groups").select("id, name, created_at").eq("org_id", org.id).order("created_at", { ascending: true }),
    supabaseAdmin.from("enterprise_talent_pool_memberships").select("talent_pool_id, group_id").eq("org_id", org.id),
    supabaseAdmin.from("enterprise_talent_pool").select("id").eq("org_id", org.id),
  ]);

  // A candidate can be in multiple pools — count via the membership junction.
  const counts = new Map<string, number>();
  const grouped = new Set<string>();
  for (const m of memberships ?? []) {
    counts.set(m.group_id as string, (counts.get(m.group_id as string) ?? 0) + 1);
    grouped.add(m.talent_pool_id as string);
  }
  const ungrouped = (members ?? []).filter((m) => !grouped.has(m.id as string)).length;

  return NextResponse.json({
    data: {
      groups: (groups ?? []).map((g) => ({ ...g, count: counts.get(g.id) ?? 0 })),
      ungrouped_count: ungrouped,
      total: (members ?? []).length,
    },
  });
}

// POST { name } — create a named talent pool.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { name } = await req.json().catch(() => ({}));
  if (!name || !String(name).trim()) return NextResponse.json({ error: "Pool name required." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("enterprise_talent_pool_groups")
    .insert({ org_id: org.id, name: String(name).trim().slice(0, 80), created_by: userId })
    .select("id, name, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { ...data, count: 0 } }, { status: 201 });
}
