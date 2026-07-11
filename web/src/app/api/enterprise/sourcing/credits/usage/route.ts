import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { getEffectivePermission } from "@/lib/enterprise-permissions";
import { getMyOrg, getMyMembership } from "@/lib/enterprise";
import type { MemberRole } from "@/types/enterprise";

const PAGE_SIZE = 50;

// GET — paginated credit ledger. Visible to report viewers or sourcing managers.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  const member = await getMyMembership(userId);
  if (!org || !member) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const role = member.role as MemberRole;
  const [canReports, canManage] = await Promise.all([
    getEffectivePermission(org.id, role, "can_view_reports"),
    getEffectivePermission(org.id, role, "can_manage_sourcing"),
  ]);
  if (!canReports && !canManage) {
    return NextResponse.json({ error: "You don't have permission to view credit usage." }, { status: 403 });
  }

  const page = Math.max(0, parseInt(req.nextUrl.searchParams.get("page") ?? "0", 10) || 0);
  const from = page * PAGE_SIZE;
  const { data } = await supabaseAdmin
    .from("sourcing_credit_ledger")
    .select("id, amount, balance_after, reason, period, ref_type, ref_id, created_by, created_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const rows = data ?? [];
  return NextResponse.json({ data: { entries: rows, page, has_more: rows.length === PAGE_SIZE } });
}
