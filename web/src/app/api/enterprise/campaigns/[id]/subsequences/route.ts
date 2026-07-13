import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { CAMPAIGN_FEATURE_KEY } from "@/lib/campaigns";

type Ctx = { params: Promise<{ id: string }> };
const TRIGGERS = ["reply_category", "sequence_completed"];
const ACTION_TYPES = ["notify_recruiter", "move_to_pipeline", "add_to_campaign", "send_email", "add_tag"];

async function guard(id: string) {
  const { userId } = await auth();
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return { error: gate };
  const org = await getMyOrg(userId);
  if (!org) return { error: NextResponse.json({ error: "No organization." }, { status: 404 }) };
  const { data: campaign } = await supabaseAdmin.from("enterprise_campaigns").select("id").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!campaign) return { error: NextResponse.json({ error: "Campaign not found." }, { status: 404 }) };
  return { userId, org };
}

// GET — the campaign's subsequence rules.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const g = await guard(id);
  if (g.error) return g.error;
  const { data } = await supabaseAdmin
    .from("enterprise_campaign_subsequences")
    .select("id, name, trigger_type, trigger_config, actions, enabled, created_at")
    .eq("org_id", g.org.id).eq("campaign_id", id).order("created_at", { ascending: true });
  return NextResponse.json({ data: data ?? [] });
}

// POST — create a rule { name, trigger_type, trigger_config?, actions[] }
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const g = await guard(id);
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return NextResponse.json({ error: "Give the rule a name." }, { status: 400 });
  if (!TRIGGERS.includes(body.trigger_type)) return NextResponse.json({ error: "Invalid trigger." }, { status: 400 });
  type RawAction = { type?: string; config?: { campaign_id?: string; subject?: string; body?: string; tag?: string } };
  const raw: RawAction[] = Array.isArray(body.actions)
    ? body.actions.filter((a: RawAction) => a && ACTION_TYPES.includes(a.type ?? "")).slice(0, 6)
    : [];
  // Config-completeness check: an action that needs config but lacks it is dropped.
  const actions = raw.filter((a) => {
    if (a.type === "add_to_campaign") return !!a.config?.campaign_id;
    if (a.type === "send_email") return !!(a.config?.subject?.trim() && a.config?.body?.trim());
    if (a.type === "add_tag") return !!a.config?.tag?.trim();
    return true;
  }).map((a) => {
    if (a.type === "send_email") return { type: a.type, config: { subject: a.config!.subject!.trim().slice(0, 200), body: a.config!.body!.trim().slice(0, 4000) } };
    if (a.type === "add_tag") return { type: a.type, config: { tag: a.config!.tag!.trim().slice(0, 60) } };
    if (a.type === "add_to_campaign") return { type: a.type, config: { campaign_id: a.config!.campaign_id } };
    return { type: a.type };
  });
  if (actions.length === 0) return NextResponse.json({ error: "Add at least one complete action." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("enterprise_campaign_subsequences")
    .insert({
      org_id: g.org.id, campaign_id: id, name,
      trigger_type: body.trigger_type,
      trigger_config: body.trigger_config && typeof body.trigger_config === "object" ? body.trigger_config : {},
      actions,
      created_by: g.userId,
    })
    .select("id, name, trigger_type, trigger_config, actions, enabled, created_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE — remove a rule: ?subId=…
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const g = await guard(id);
  if (g.error) return g.error;
  const subId = req.nextUrl.searchParams.get("subId");
  if (!subId) return NextResponse.json({ error: "subId is required." }, { status: 400 });
  await supabaseAdmin.from("enterprise_campaign_subsequences").delete().eq("id", subId).eq("campaign_id", id).eq("org_id", g.org.id);
  return NextResponse.json({ ok: true });
}
