import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { CAMPAIGN_FEATURE_KEY } from "@/lib/campaigns";
import { getOrCreateIntakePool } from "@/lib/enterprise-intake-inbox";

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

  if (action === "pause") {
    // Hold sending but keep the sequence position.
    await supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .update({ status: "paused", next_send_at: null })
      .eq("id", eid).eq("status", "active");
    return NextResponse.json({ ok: true });
  }

  if (action === "resume") {
    await supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .update({ status: "active", next_send_at: now })
      .eq("id", eid).eq("status", "paused");
    return NextResponse.json({ ok: true });
  }

  if (action === "move_to_pipeline") {
    // Create an application on the enrollment's job (or the intake pool),
    // deduped by org + email. Also stops the sequence.
    const enr = enrollment as { candidate_email: string; candidate_name: string | null; job_id: string | null };
    const email = enr.candidate_email.toLowerCase();
    const { data: existing } = await supabaseAdmin
      .from("enterprise_applications").select("id").eq("org_id", org.id).ilike("candidate_email", email).limit(1).maybeSingle();
    let appId = (existing as { id: string } | null)?.id ?? null;
    if (!appId) {
      let jobId = enr.job_id;
      if (!jobId) jobId = await getOrCreateIntakePool(org.id, userId);
      if (jobId) {
        const { data: app } = await supabaseAdmin
          .from("enterprise_applications")
          .insert({ org_id: org.id, job_id: jobId, candidate_name: enr.candidate_name?.trim() || email.split("@")[0], candidate_email: email, source: "jobsai", stage: "applied" })
          .select("id").single();
        appId = (app as { id: string } | null)?.id ?? null;
      }
    }
    await supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .update({ status: "completed", next_send_at: null, completed_at: now })
      .eq("id", eid);
    return NextResponse.json({ ok: true, application_id: appId });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
