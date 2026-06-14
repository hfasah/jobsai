import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, getMyMembership, orgHasAccess } from "@/lib/enterprise";

// Lets a recruiter leave a workspace that hasn't been activated yet, so they're
// not trapped on the locked screen and can start a different company. Refuses
// to abandon an active/comped workspace (that should be managed from Billing).
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getMyMembership(userId);
  if (!membership) return NextResponse.json({ data: { left: false } });

  const org = await getMyOrg(userId);
  if (org && orgHasAccess((org as unknown as { access_status?: string }).access_status)) {
    return NextResponse.json(
      { error: "This workspace is active — manage it from Billing instead of leaving." },
      { status: 400 },
    );
  }

  // Remove this user's membership.
  await supabaseAdmin
    .from("enterprise_members")
    .delete()
    .eq("user_id", userId)
    .eq("org_id", membership.org_id);

  // If the pending workspace now has no members, clean it up (cascades members).
  const { count } = await supabaseAdmin
    .from("enterprise_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", membership.org_id);
  if (!count) {
    await supabaseAdmin.from("enterprise_orgs").delete().eq("id", membership.org_id);
  }

  return NextResponse.json({ data: { left: true } });
}
