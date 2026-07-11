import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { getMyOrg } from "@/lib/enterprise";

// POST /api/enterprise/sourcing/searches/[id]/duplicate — copy a search (own
// or shared) as a private search owned by the caller.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await ctx.params;
  const { data } = await supabaseAdmin
    .from("sourcing_searches")
    .select("name, query_text, filters, mode, weights, visibility, created_by")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  const row = data as { name: string; query_text: string | null; filters: unknown; mode: string; weights: unknown; visibility: string; created_by: string } | null;
  if (!row || (row.visibility !== "shared" && row.created_by !== userId)) {
    return NextResponse.json({ error: "Search not found." }, { status: 404 });
  }

  const { data: copy, error } = await supabaseAdmin
    .from("sourcing_searches")
    .insert({
      org_id: org.id,
      created_by: userId,
      name: `${row.name} (copy)`.slice(0, 120),
      query_text: row.query_text,
      filters: row.filters,
      mode: row.mode,
      weights: row.weights,
      visibility: "private",
    })
    .select("id, name")
    .single();
  if (error || !copy) return NextResponse.json({ error: "Could not duplicate." }, { status: 500 });
  return NextResponse.json({ data: copy });
}
