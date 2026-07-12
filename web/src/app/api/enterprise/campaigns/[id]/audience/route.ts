import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { CAMPAIGN_FEATURE_KEY } from "@/lib/campaigns";

type Ctx = { params: Promise<{ id: string }> };

// GET — the campaign's audience (its enrollments). Powers the wizard's Audience
// step: who's in the campaign so far, with contact + verification signals.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const { data: campaign } = await supabaseAdmin
    .from("enterprise_campaigns").select("id").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("enterprise_campaign_enrollments")
    .select("id, candidate_name, candidate_email, status, candidate_source, email_status, enrolled_at")
    .eq("campaign_id", id).eq("org_id", org.id)
    .neq("status", "removed")
    .order("enrolled_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as {
    id: string; candidate_name: string; candidate_email: string; status: string;
    candidate_source: string; email_status: string | null; enrolled_at: string;
  }[];

  // Deliverability breakdown across the audience. valid/risky = safe to send
  // ("verified" / "likely valid"); invalid/unknown/none need review.
  const byStatus = { valid: 0, risky: 0, invalid: 0, unknown: 0, none: 0 };
  for (const r of rows) {
    const s = (r.email_status ?? "none") as keyof typeof byStatus;
    if (s in byStatus) byStatus[s]++; else byStatus.none++;
  }

  return NextResponse.json({
    data: {
      total: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      sendable: byStatus.valid + byStatus.risky, // verified + likely-valid
      by_status: byStatus,
      enrollments: rows,
    },
  });
}
