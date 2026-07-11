import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { getEffectivePermission } from "@/lib/enterprise-permissions";
import { getMyOrg, getMyMembership } from "@/lib/enterprise";
import { sanitizeFilters } from "@/lib/sourcing/filters";
import type { MemberRole } from "@/types/enterprise";

type SearchRow = {
  id: string;
  name: string;
  query_text: string | null;
  filters: unknown;
  mode: string;
  weights: unknown;
  visibility: "private" | "shared";
  last_run_at: string | null;
  run_count: number;
  created_by: string;
  created_at: string;
};

async function loadVisible(orgId: string, id: string, userId: string): Promise<SearchRow | null> {
  const { data } = await supabaseAdmin
    .from("sourcing_searches")
    .select("id, name, query_text, filters, mode, weights, visibility, last_run_at, run_count, created_by, created_at")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  const row = data as SearchRow | null;
  if (!row) return null;
  if (row.visibility !== "shared" && row.created_by !== userId) return null;
  return row;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await ctx.params;
  const row = await loadVisible(org.id, id, userId);
  if (!row) return NextResponse.json({ error: "Search not found." }, { status: 404 });
  return NextResponse.json({ data: row });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await ctx.params;
  const row = await loadVisible(org.id, id, userId);
  if (!row) return NextResponse.json({ error: "Search not found." }, { status: 404 });
  // Only the creator edits (shared searches are read-only to others).
  if (row.created_by !== userId) {
    return NextResponse.json({ error: "Only the creator can edit this search." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 120);
  if (typeof body.query === "string") patch.query_text = body.query.slice(0, 1000);
  if (body.filters) patch.filters = sanitizeFilters(body.filters);
  if (["external", "internal", "combined"].includes(body.mode)) patch.mode = body.mode;
  if (body.weights && typeof body.weights === "object") patch.weights = body.weights;
  if (["private", "shared"].includes(body.visibility)) patch.visibility = body.visibility;

  await supabaseAdmin.from("sourcing_searches").update(patch).eq("id", id).eq("org_id", org.id);
  return NextResponse.json({ data: { updated: true } });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  const member = await getMyMembership(userId);
  if (!org || !member) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await ctx.params;
  const { data } = await supabaseAdmin
    .from("sourcing_searches")
    .select("id, created_by")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  const row = data as { id: string; created_by: string } | null;
  if (!row) return NextResponse.json({ error: "Search not found." }, { status: 404 });

  // Creator, or anyone with sourcing management rights, may delete.
  const canManage = await getEffectivePermission(org.id, member.role as MemberRole, "can_manage_sourcing");
  if (row.created_by !== userId && !canManage) {
    return NextResponse.json({ error: "You can't delete this search." }, { status: 403 });
  }

  await supabaseAdmin.from("sourcing_searches").delete().eq("id", id).eq("org_id", org.id);
  return NextResponse.json({ data: { deleted: true } });
}
