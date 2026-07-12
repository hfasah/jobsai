import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { CAMPAIGN_FEATURE_KEY, validateSteps, type CampaignStepInput } from "@/lib/campaigns";

// GET — list this org's campaigns with rollup stats (enrolled / replied).
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data: campaigns } = await supabaseAdmin
    .from("enterprise_campaigns")
    .select("id, name, description, status, created_at, updated_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  const list = campaigns ?? [];
  if (list.length === 0) return NextResponse.json({ data: [] });

  const ids = list.map((c) => c.id);
  const [{ data: enrollments }, { data: steps }] = await Promise.all([
    supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .select("campaign_id, status")
      .in("campaign_id", ids),
    supabaseAdmin
      .from("enterprise_campaign_steps")
      .select("campaign_id")
      .in("campaign_id", ids),
  ]);

  const stats = new Map<string, { enrolled: number; replied: number; active: number; steps: number }>();
  for (const id of ids) stats.set(id, { enrolled: 0, replied: 0, active: 0, steps: 0 });
  for (const e of enrollments ?? []) {
    const s = stats.get(e.campaign_id)!;
    s.enrolled++;
    if (e.status === "replied") s.replied++;
    if (e.status === "active") s.active++;
  }
  for (const st of steps ?? []) stats.get(st.campaign_id)!.steps++;

  return NextResponse.json({
    data: list.map((c) => ({ ...c, stats: stats.get(c.id) })),
  });
}

// POST — create a campaign with its steps.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { name, description, status, steps, objective, send_window } = body as {
    name?: string; description?: string; status?: string; steps?: CampaignStepInput[];
    objective?: string;
    send_window?: { start?: number | null; end?: number | null; timezone?: string | null; business_days_only?: boolean };
  };

  if (!name?.trim()) return NextResponse.json({ error: "Campaign name is required." }, { status: 400 });
  const stepErr = validateSteps(steps ?? []);
  if (stepErr) return NextResponse.json({ error: stepErr }, { status: 400 });

  const sw = send_window ?? null;
  const { data: campaign, error } = await supabaseAdmin
    .from("enterprise_campaigns")
    .insert({
      org_id: org.id,
      name: name.trim(),
      description: description?.trim() || null,
      status: status === "active" ? "active" : "draft",
      objective: ["source", "re_engage", "promote", "pipeline"].includes(objective ?? "") ? objective : null,
      created_by: userId,
      ...(sw
        ? {
            send_window_start: typeof sw.start === "number" && sw.start >= 0 && sw.start <= 23 ? Math.floor(sw.start) : null,
            send_window_end: typeof sw.end === "number" && sw.end >= 1 && sw.end <= 24 ? Math.floor(sw.end) : null,
            send_timezone: typeof sw.timezone === "string" && sw.timezone.trim() ? sw.timezone.trim() : null,
            business_days_only: sw.business_days_only === true,
          }
        : {}),
    })
    .select("id")
    .single();
  if (error || !campaign) {
    return NextResponse.json({ error: error?.message ?? "Could not create campaign." }, { status: 500 });
  }

  const stepRows = (steps ?? []).map((s, i) => ({
    campaign_id: campaign.id,
    step_order: i,
    delay_days: Math.max(0, Math.min(60, Math.round(s.delay_days || 0))),
    subject: s.subject.trim(),
    body: s.body.trim(),
    ai_personalize: !!s.ai_personalize,
    ai_prompt: s.ai_prompt?.trim() || null,
    ab_subject: s.ab_subject?.trim() || null,
    ab_body: s.ab_body?.trim() || null,
  }));
  const { error: stepErr2 } = await supabaseAdmin.from("enterprise_campaign_steps").insert(stepRows);
  if (stepErr2) {
    await supabaseAdmin.from("enterprise_campaigns").delete().eq("id", campaign.id);
    return NextResponse.json({ error: stepErr2.message }, { status: 500 });
  }

  return NextResponse.json({ data: { id: campaign.id } });
}
