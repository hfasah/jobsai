import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";

const MAX_CAP = 500;

// PATCH { action: 'pause'|'resume' } | { daily_limit_cap } | { restart_ramp: true }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "outreach_campaigns");
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_manage_settings");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await ctx.params;
  const { data } = await supabaseAdmin
    .from("sending_mailboxes")
    .select("id, address, status, paused_reason")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  const row = data as { id: string; address: string; status: string; paused_reason: string | null } | null;
  if (!row) return NextResponse.json({ error: "Mailbox not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let auditAction: "outreach.mailbox_paused" | "outreach.mailbox_resumed" | null = null;

  if (body.action === "pause") {
    patch.status = "paused";
    patch.paused_reason = "manual";
    patch.paused_at = new Date().toISOString();
    auditAction = "outreach.mailbox_paused";
  } else if (body.action === "resume") {
    patch.status = "active";
    patch.paused_reason = null;
    patch.paused_at = null;
    auditAction = "outreach.mailbox_resumed";
    // Resuming after an auto-pause restarts the ramp — a mailbox that tripped
    // bounce thresholds must re-earn its volume.
    if (row.paused_reason === "bounce_rate" || row.paused_reason === "complaint_rate") {
      patch.ramp_started_at = new Date().toISOString();
    }
  }
  if (typeof body.daily_limit_cap === "number" && body.daily_limit_cap >= 10 && body.daily_limit_cap <= MAX_CAP) {
    patch.daily_limit_cap = Math.floor(body.daily_limit_cap);
  }
  if (body.restart_ramp === true) {
    patch.ramp_started_at = new Date().toISOString();
  }
  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await supabaseAdmin.from("sending_mailboxes").update(patch).eq("id", row.id).eq("org_id", org.id);

  if (auditAction) {
    after(() => {
      audit({
        org_id: org.id,
        user_id: userId,
        action: auditAction!,
        resource_type: "sending_mailbox",
        resource_id: row.id,
        metadata: { address: row.address, manual: true },
      });
    });
  }

  return NextResponse.json({ data: { updated: true } });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "outreach_campaigns");
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_manage_settings");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await ctx.params;
  await supabaseAdmin.from("sending_mailboxes").delete().eq("id", id).eq("org_id", org.id);
  return NextResponse.json({ data: { deleted: true } });
}
