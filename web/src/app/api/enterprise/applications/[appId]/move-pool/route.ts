import { auth } from "@clerk/nextjs/server";
import { requirePermission } from "@/lib/enterprise-permissions";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

// POST { pool_id } — manually move a candidate into a different pool
export async function POST(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(userId, "can_move_stages");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { appId } = await params;
  const body = await req.json().catch(() => ({}));
  const poolId: string | null = body.pool_id ?? null;

  // Validate the pool belongs to the org (if provided)
  if (poolId) {
    const { data: pool } = await supabaseAdmin.from("enterprise_pools").select("id").eq("id", poolId).eq("org_id", org.id).maybeSingle();
    if (!pool) return NextResponse.json({ error: "Pool not found." }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("enterprise_applications")
    .update({ pool_id: poolId, triaged: poolId !== null })
    .eq("id", appId).eq("org_id", org.id)
    .select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
