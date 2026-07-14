import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { CAMPAIGN_FEATURE_KEY } from "@/lib/campaigns";
import { loadSuppressedSet } from "@/lib/outreach/suppression";

type Ctx = { params: Promise<{ id: string }> };

interface EnrollCandidate {
  name: string;
  email: string;
  source?: "application" | "pool" | "manual";
  source_id?: string;
}

// POST — enroll candidates into a campaign. Schedules the first step based on
// its delay; the cron handles the rest. Idempotent per (campaign, email).
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return gate;

  const { id } = await params;
  const { candidates, job_id } = await req.json().catch(() => ({}));

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return NextResponse.json({ error: "candidates array is required." }, { status: 400 });
  }
  if (candidates.length > 200) {
    return NextResponse.json({ error: "Max 200 candidates per enrollment batch." }, { status: 400 });
  }

  const { data: campaign } = await supabaseAdmin
    .from("enterprise_campaigns")
    .select("id, status, dedup_days, allow_unverified")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const opts = campaign as { dedup_days: number | null; allow_unverified: boolean };

  // Manually-added leads have no verified email. If the campaign requires
  // verified addresses, they can't be added this way.
  if (opts.allow_unverified === false) {
    return NextResponse.json({ error: "This campaign only accepts verified emails — add leads via Search (with reveal), or allow unverified in Options." }, { status: 400 });
  }

  // A draft campaign can be built before its sequence exists. If there are no
  // steps yet, PARK enrollees (next_send_at = null) so the list can be built
  // now; launch backfills the schedule once a sequence is written. This breaks
  // the deadlock where you couldn't add leads without steps, nor easily write
  // steps around leads. The launch preflight still requires steps to send.
  const { data: steps } = await supabaseAdmin
    .from("enterprise_campaign_steps")
    .select("step_order, delay_days")
    .eq("campaign_id", id)
    .order("step_order", { ascending: true });
  const hasSteps = !!steps && steps.length > 0;
  const nextSendAt = hasSteps
    ? new Date(Date.now() + Math.max(0, steps![0].delay_days || 0) * 86_400_000).toISOString()
    : null;

  // Skip candidates already enrolled (don't double-message anyone).
  const emails = (candidates as EnrollCandidate[])
    .map((c) => c.email?.trim().toLowerCase())
    .filter(Boolean);
  const { data: existing } = await supabaseAdmin
    .from("enterprise_campaign_enrollments")
    .select("candidate_email")
    .eq("campaign_id", id)
    .in("candidate_email", emails);
  const already = new Set((existing ?? []).map((e) => e.candidate_email.toLowerCase()));

  // Cross-campaign: don't add anyone already being contacted by another LIVE
  // campaign (active/scheduled). Being parked in a draft/paused/stopped campaign
  // is NOT active outreach, so it must not block enrolling here.
  const { data: elsewhere } = await supabaseAdmin
    .from("enterprise_campaign_enrollments")
    .select("candidate_email, campaign:enterprise_campaigns(status)")
    .eq("org_id", org.id).neq("campaign_id", id).eq("status", "active")
    .in("candidate_email", emails);
  for (const e of elsewhere ?? []) {
    const cs = (e.campaign as { status?: string } | null)?.status;
    if (cs === "active" || cs === "scheduled") already.add(e.candidate_email.toLowerCase());
  }

  // Recency guard from the campaign's dedup window.
  if (opts.dedup_days && opts.dedup_days > 0) {
    const cutoff = new Date(Date.now() - opts.dedup_days * 86_400_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .select("candidate_email")
      .eq("org_id", org.id).gte("last_sent_at", cutoff)
      .in("candidate_email", emails);
    for (const e of recent ?? []) already.add(e.candidate_email.toLowerCase());
  }

  // Do-Not-Contact: never enrol a suppressed address (org-wide).
  const suppressed = await loadSuppressedSet(org.id, emails);
  for (const e of suppressed) already.add(e);

  const rows = (candidates as EnrollCandidate[])
    .filter((c) => c.email?.trim() && c.name?.trim() && !already.has(c.email.trim().toLowerCase()))
    .map((c) => ({
      campaign_id: id,
      org_id: org.id,
      job_id: job_id ?? null,
      candidate_name: c.name.trim(),
      candidate_email: c.email.trim().toLowerCase(),
      candidate_source: c.source ?? "manual",
      source_id: c.source_id ?? null,
      status: "active" as const,
      current_step_order: 0,
      next_send_at: nextSendAt,
      enrolled_by: userId,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ data: { enrolled: 0, skipped: candidates.length } });
  }

  const { error } = await supabaseAdmin.from("enterprise_campaign_enrollments").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data: { enrolled: rows.length, skipped: candidates.length - rows.length },
  });
}
