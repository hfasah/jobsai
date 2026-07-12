import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { CAMPAIGN_FEATURE_KEY } from "@/lib/campaigns";

type Ctx = { params: Promise<{ id: string }> };
interface ActivityEvent { at: string; type: string; text: string }

// GET — a recent activity feed for the campaign, derived from sends + enrollment
// lifecycle timestamps (no separate events table; this is the read-side rollup).
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const { data: campaign } = await supabaseAdmin
    .from("enterprise_campaigns").select("id, created_at").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const [{ data: sends }, { data: enrollments }] = await Promise.all([
    supabaseAdmin.from("enterprise_campaign_sends")
      .select("candidate_email, step_order, sent_at").eq("campaign_id", id).eq("org_id", org.id)
      .order("sent_at", { ascending: false }).limit(40),
    supabaseAdmin.from("enterprise_campaign_enrollments")
      .select("candidate_name, candidate_email, status, enrolled_at, replied_at, completed_at").eq("campaign_id", id).eq("org_id", org.id)
      .order("enrolled_at", { ascending: false }).limit(200),
  ]);

  const events: ActivityEvent[] = [];
  const who = (name: string | null, email: string) => name?.trim() || email;

  for (const s of (sends ?? []) as { candidate_email: string; step_order: number; sent_at: string }[]) {
    if (s.sent_at) events.push({ at: s.sent_at, type: "email_sent", text: `Email sent (step ${s.step_order + 1}) to ${s.candidate_email}` });
  }
  for (const e of (enrollments ?? []) as { candidate_name: string | null; candidate_email: string; status: string; enrolled_at: string; replied_at: string | null; completed_at: string | null }[]) {
    if (e.enrolled_at) events.push({ at: e.enrolled_at, type: "lead_added", text: `Lead added: ${who(e.candidate_name, e.candidate_email)}` });
    if (e.replied_at) events.push({ at: e.replied_at, type: "replied", text: `${who(e.candidate_name, e.candidate_email)} replied` });
    if (e.completed_at) events.push({ at: e.completed_at, type: e.status === "unsubscribed" ? "unsubscribed" : "completed", text: `${who(e.candidate_name, e.candidate_email)} ${e.status === "unsubscribed" ? "unsubscribed" : "finished the sequence"}` });
  }

  events.sort((a, b) => (a.at < b.at ? 1 : -1));
  return NextResponse.json({ data: { events: events.slice(0, 60) } });
}
