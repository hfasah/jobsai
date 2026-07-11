import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { CAMPAIGN_FEATURE_KEY, validateSteps, type CampaignStepInput } from "@/lib/campaigns";
import { preflightCampaign } from "@/lib/outreach/preflight";

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
  const { name, description, status, steps, send_window } = body as {
    name?: string; description?: string; status?: string; steps?: CampaignStepInput[];
    send_window?: { start?: number | null; end?: number | null; timezone?: string | null; business_days_only?: boolean };
  };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof name === "string") {
    if (!name.trim()) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    update.name = name.trim();
  }
  if (typeof description === "string") update.description = description.trim() || null;
  if (typeof status === "string" && !["draft", "active", "paused", "archived"].includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (send_window && typeof send_window === "object") {
    const start = send_window.start;
    const end = send_window.end;
    update.send_window_start = typeof start === "number" && start >= 0 && start <= 23 ? Math.floor(start) : null;
    update.send_window_end = typeof end === "number" && end >= 1 && end <= 24 ? Math.floor(end) : null;
    update.send_timezone = typeof send_window.timezone === "string" && send_window.timezone.trim() ? send_window.timezone.trim() : null;
    update.business_days_only = send_window.business_days_only === true;
  }

  // Replacing steps is destructive — only when the client explicitly sends them.
  // (Runs BEFORE the activation preflight so a single save-and-launch request
  // validates the steps it just wrote.)
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
      ab_subject: s.ab_subject?.trim() || null,
      ab_body: s.ab_body?.trim() || null,
    }));
    const { error } = await supabaseAdmin.from("enterprise_campaign_steps").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Apply content/settings edits first — they should survive a blocked launch.
  await supabaseAdmin.from("enterprise_campaigns").update(update).eq("id", id);

  // HARD LAUNCH GATE: activating a campaign requires a passing preflight
  // (steps and settings above are already saved, so the preflight sees the
  // exact state that would go live). Failures return 422 with the full check
  // list so the UI shows exactly what to fix; warns don't block.
  if (typeof status === "string") {
    if (status === "active") {
      const preflight = await preflightCampaign(a.org.id, id);
      if (!preflight.ok) {
        return NextResponse.json(
          { error: "Launch blocked — fix the failing checks first.", preflight },
          { status: 422 },
        );
      }
    }
    await supabaseAdmin
      .from("enterprise_campaigns")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", a.org.id);
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
