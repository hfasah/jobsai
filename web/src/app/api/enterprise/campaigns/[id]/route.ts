import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { CAMPAIGN_FEATURE_KEY, validateSteps, type CampaignStepInput } from "@/lib/campaigns";

type Ctx = { params: Promise<{ id: string }> };

async function authedOrg() {
  const { userId } = await auth();
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return { error: gate };
  const org = await getMyOrg(userId);
  if (!org) return { error: NextResponse.json({ error: "No organization." }, { status: 404 }) };
  return { userId, org };
}

// GET — full campaign with ordered steps.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const a = await authedOrg();
  if (a.error) return a.error;
  const { id } = await params;

  const { data: campaign } = await supabaseAdmin
    .from("enterprise_campaigns")
    .select("*")
    .eq("id", id)
    .eq("org_id", a.org.id)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: steps } = await supabaseAdmin
    .from("enterprise_campaign_steps")
    .select("*")
    .eq("campaign_id", id)
    .order("step_order", { ascending: true });

  return NextResponse.json({ data: { ...campaign, steps: steps ?? [] } });
}

// PATCH — update name/description/status and/or replace the step list.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const a = await authedOrg();
  if (a.error) return a.error;
  const { id } = await params;

  const { data: campaign } = await supabaseAdmin
    .from("enterprise_campaigns")
    .select("id")
    .eq("id", id)
    .eq("org_id", a.org.id)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { name, description, status, steps } = body as {
    name?: string; description?: string; status?: string; steps?: CampaignStepInput[];
  };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof name === "string") {
    if (!name.trim()) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    update.name = name.trim();
  }
  if (typeof description === "string") update.description = description.trim() || null;
  if (typeof status === "string") {
    if (!["draft", "active", "paused", "archived"].includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    update.status = status;
  }

  await supabaseAdmin.from("enterprise_campaigns").update(update).eq("id", id);

  // Replacing steps is destructive — only when the client explicitly sends them.
  if (Array.isArray(steps)) {
    const stepErr = validateSteps(steps);
    if (stepErr) return NextResponse.json({ error: stepErr }, { status: 400 });
    await supabaseAdmin.from("enterprise_campaign_steps").delete().eq("campaign_id", id);
    const rows = steps.map((s, i) => ({
      campaign_id: id,
      step_order: i,
      delay_days: Math.max(0, Math.min(60, Math.round(s.delay_days || 0))),
      subject: s.subject.trim(),
      body: s.body.trim(),
      ai_personalize: !!s.ai_personalize,
      ai_prompt: s.ai_prompt?.trim() || null,
    }));
    const { error } = await supabaseAdmin.from("enterprise_campaign_steps").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE — remove the campaign (cascades steps/enrollments/sends).
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const a = await authedOrg();
  if (a.error) return a.error;
  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("enterprise_campaigns")
    .delete()
    .eq("id", id)
    .eq("org_id", a.org.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
