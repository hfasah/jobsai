import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";
import { getResendDomain, verifyResendDomain, removeResendDomain, isUsableStatus } from "@/lib/outreach/resend-domains";

async function loadDomain(orgId: string, id: string) {
  const { data } = await supabaseAdmin
    .from("sending_domains")
    .select("id, domain, resend_domain_id, status, records, verified_at")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  return data as { id: string; domain: string; resend_domain_id: string | null; status: string; records: unknown[]; verified_at: string | null } | null;
}

// GET — refresh status/records from Resend and persist.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "outreach_campaigns");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await ctx.params;
  const row = await loadDomain(org.id, id);
  if (!row) return NextResponse.json({ error: "Domain not found." }, { status: 404 });

  if (row.resend_domain_id) {
    try {
      const remote = await getResendDomain(row.resend_domain_id);
      const becameUsable = isUsableStatus(remote.status) && !isUsableStatus(row.status);
      await supabaseAdmin
        .from("sending_domains")
        .update({
          status: remote.status,
          records: remote.records,
          last_checked_at: new Date().toISOString(),
          verified_at: isUsableStatus(remote.status) ? row.verified_at ?? new Date().toISOString() : row.verified_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("org_id", org.id);
      if (becameUsable) {
        audit({ org_id: org.id, user_id: userId, action: "outreach.domain_verified", resource_type: "sending_domain", resource_id: row.id, metadata: { domain: row.domain } });
      }
      return NextResponse.json({ data: { ...row, status: remote.status, records: remote.records } });
    } catch (e) {
      console.error("[outreach] domain refresh failed", e);
    }
  }
  return NextResponse.json({ data: row });
}

// POST — trigger async verification.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "outreach_campaigns");
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_manage_settings");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await ctx.params;
  const row = await loadDomain(org.id, id);
  if (!row?.resend_domain_id) return NextResponse.json({ error: "Domain not found." }, { status: 404 });

  try {
    await verifyResendDomain(row.resend_domain_id);
  } catch (e) {
    console.error("[outreach] domain verify failed", e);
    return NextResponse.json({ error: "Verification could not be started — check the DNS records first." }, { status: 502 });
  }
  await supabaseAdmin
    .from("sending_domains")
    .update({ status: "pending", last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("org_id", org.id);
  return NextResponse.json({ data: { verifying: true } });
}

// DELETE — remove from Resend + delete (cascades to that domain's mailboxes).
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
  const row = await loadDomain(org.id, id);
  if (!row) return NextResponse.json({ error: "Domain not found." }, { status: 404 });

  if (row.resend_domain_id) {
    try {
      await removeResendDomain(row.resend_domain_id);
    } catch (e) {
      console.error("[outreach] resend domain remove failed (continuing)", e);
    }
  }
  await supabaseAdmin.from("sending_domains").delete().eq("id", row.id).eq("org_id", org.id);

  after(() => {
    audit({
      org_id: org.id,
      user_id: userId,
      action: "outreach.domain_removed",
      resource_type: "sending_domain",
      resource_id: row.id,
      metadata: { domain: row.domain },
    });
  });

  return NextResponse.json({ data: { deleted: true } });
}
