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

  const [{ data: groups }, { data: members }] = await Promise.all([
    supabaseAdmin.from("enterprise_talent_pool_groups").select("id, name, created_at").eq("org_id", org.id).order("created_at", { ascending: true }),
    supabaseAdmin.from("enterprise_talent_pool").select("group_id").eq("org_id", org.id),
  ]);

  const counts = new Map<string, number>();
  for (const m of members ?? []) {
    const g = (m.group_id as string | null) ?? "__none__";
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }

  return NextResponse.json({
    data: {
      groups: (groups ?? []).map((g) => ({ ...g, count: counts.get(g.id) ?? 0 })),
      ungrouped_count: counts.get("__none__") ?? 0,
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
