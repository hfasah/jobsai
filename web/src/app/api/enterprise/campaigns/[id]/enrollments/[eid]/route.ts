import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { CAMPAIGN_FEATURE_KEY } from "@/lib/campaigns";

type Ctx = { params: Promise<{ id: string; eid: string }> };

// PATCH — recruiter actions on a single enrollment.
//   mark_replied  → stops the sequence, flags the latest send as replied
//   unsubscribe   → stops the sequence, suppresses this email org-wide
//   remove        → quietly drops them from this campaign
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return gate;

  const { id, eid } = await params;
  const { action } = await req.json().catch(() => ({}));

  const { data: enrollment } = await supabaseAdmin
    .from("enterprise_campaign_enrollments")
    .select("*")
    .eq("id", eid)
    .eq("campaign_id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!enrollment) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const now = new Date().toISOString();

  if (action === "mark_replied") {
    await supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .update({ status: "replied", replied_at: now, next_send_at: null })
      .eq("id", eid);
    // Attribute the reply to the most recent send for per-step analytics.
    const { data: lastSend } = await supabaseAdmin
      .from("enterprise_campaign_sends")
      .select("id")
      .eq("enrollment_id", eid)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastSend) {
      await supabaseAdmin
        .from("enterprise_campaign_sends")
        .update({ replied_at: now })
        .eq("id", lastSend.id)
        .is("replied_at", null);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "unsubscribe") {
    // Stop this enrollment and any other active enrollment for the same email.
    await supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .update({ status: "unsubscribed", next_send_at: null })
      .eq("org_id", org.id)
      .eq("candidate_email", enrollment.candidate_email)
      .eq("status", "active");
    await supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .update({ status: "unsubscribed", next_send_at: null })
      .eq("id", eid);
    return NextResponse.json({ ok: true });
  }

  if (action === "remove") {
    await supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .update({ status: "removed", next_send_at: null })
      .eq("id", eid);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
