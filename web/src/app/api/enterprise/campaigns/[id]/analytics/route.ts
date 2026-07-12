import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { CAMPAIGN_FEATURE_KEY } from "@/lib/campaigns";

type Ctx = { params: Promise<{ id: string }> };

// GET — per-step funnel (sent / opened / replied) + enrollment status breakdown
// + the enrolled candidate list.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return gate;

  const { id } = await params;
  const { data: campaign } = await supabaseAdmin
    .from("enterprise_campaigns")
    .select("id")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const [{ data: steps }, { data: sends }, { data: enrollments }] = await Promise.all([
    supabaseAdmin
      .from("enterprise_campaign_steps")
      .select("step_order, subject")
      .eq("campaign_id", id)
      .order("step_order", { ascending: true }),
    supabaseAdmin
      .from("enterprise_campaign_sends")
      .select("step_order, opened_at, replied_at")
      .eq("campaign_id", id),
    supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .select("id, candidate_name, candidate_email, status, current_step_order, next_send_at, last_sent_at, replied_at, enrolled_at")
      .eq("campaign_id", id)
      .order("enrolled_at", { ascending: false })
      .limit(500),
  ]);

  // Per-step funnel.
  const perStep = (steps ?? []).map((s) => {
    const rows = (sends ?? []).filter((r) => r.step_order === s.step_order);
    const sent = rows.length;
    const opened = rows.filter((r) => r.opened_at).length;
    const replied = rows.filter((r) => r.replied_at).length;
    return {
      step_order: s.step_order,
      subject: s.subject,
      sent,
      opened,
      replied,
      open_rate: sent ? Math.round((opened / sent) * 100) : 0,
      reply_rate: sent ? Math.round((replied / sent) * 100) : 0,
    };
  });

  // Enrollment status breakdown.
  const breakdown: Record<string, number> = {};
  for (const e of enrollments ?? []) breakdown[e.status] = (breakdown[e.status] ?? 0) + 1;

  const totalSent = (sends ?? []).length;
  const totalReplied = (sends ?? []).filter((r) => r.replied_at).length;
  const enrolled = (enrollments ?? []).length;

  // Outcome funnel — the signal that actually matters (opens are unreliable).
  // Cross-reference the audience's emails with the inbox (interest) and the ATS.
  const emails = [...new Set((enrollments ?? []).map((e) => e.candidate_email.toLowerCase()))];
  let interested = 0, meetings = 0, positiveReplies = 0, pipeline = 0;
  if (emails.length) {
    const [{ data: threads }, { count: appCount }] = await Promise.all([
      supabaseAdmin.from("inbox_threads").select("intent, interest_level").eq("org_id", org.id).in("candidate_email", emails),
      supabaseAdmin.from("enterprise_applications").select("id", { count: "exact", head: true }).eq("org_id", org.id).in("candidate_email", emails),
    ]);
    for (const t of (threads ?? []) as { intent: string | null; interest_level: string | null }[]) {
      if (t.intent === "interested") interested++;
      if (t.intent === "meeting_requested") meetings++;
      const positive = t.intent === "interested" || t.intent === "meeting_requested"
        || t.interest_level === "high" || t.interest_level === "very_high";
      if (positive) positiveReplies++;
    }
    pipeline = appCount ?? 0;
  }

  return NextResponse.json({
    data: {
      totals: {
        enrolled,
        sent: totalSent,
        replied: totalReplied,
        reply_rate: totalSent ? Math.round((totalReplied / totalSent) * 100) : 0,
      },
      outcomes: {
        positive_replies: positiveReplies,
        interested,
        meetings,
        pipeline,
        positive_reply_rate: totalReplied ? Math.round((positiveReplies / totalReplied) * 100) : 0,
        meeting_rate: enrolled ? Math.round((meetings / enrolled) * 100) : 0,
        pipeline_rate: enrolled ? Math.round((pipeline / enrolled) * 100) : 0,
      },
      breakdown,
      per_step: perStep,
      enrollments: enrollments ?? [],
    },
  });
}
