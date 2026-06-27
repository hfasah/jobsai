import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, getMyMembership } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { audit } from "@/lib/enterprise-audit";
import { verifyPipedrive, pipedriveSyncCounts } from "@/lib/pipedrive";

// Guard: signed-in owner/admin of an org with the CRM feature. Pipedrive sync
// pushes CRM data, so it's gated like the rest of the CRM module.
async function guard() {
  const { userId } = await auth();
  if (!userId) return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const gate = await requireFeature(userId, "crm");
  if (gate) return { ok: false as const, res: gate };
  const org = await getMyOrg(userId);
  if (!org) return { ok: false as const, res: NextResponse.json({ error: "No organization." }, { status: 404 }) };
  const membership = await getMyMembership(userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { ok: false as const, res: NextResponse.json({ error: "Only owners and admins can manage integrations." }, { status: 403 }) };
  }
  return { ok: true as const, userId, org };
}

// GET — connection status for the Settings card.
export async function GET() {
  const g = await guard();
  if (!g.ok) return g.res;

  const { data: integ } = await supabaseAdmin
    .from("enterprise_integrations")
    .select("subdomain, enabled, last_sync, config")
    .eq("org_id", g.org.id)
    .eq("provider", "pipedrive")
    .maybeSingle();

  if (!integ) return NextResponse.json({ data: { connected: false } });

  const counts = await pipedriveSyncCounts(g.org.id);
  return NextResponse.json({
    data: {
      connected: !!integ.enabled,
      domain: integ.subdomain ?? null,
      company_name: (integ.config as { company_name?: string } | null)?.company_name ?? null,
      last_sync: integ.last_sync ?? null,
      companies: counts.companies,
      synced: counts.synced,
      contacts: counts.contacts,
      syncedContacts: counts.syncedContacts,
    },
  });
}

// POST { api_token, company_domain } — validate the token then store it.
export async function POST(req: NextRequest) {
  const g = await guard();
  if (!g.ok) return g.res;

  const body = await req.json().catch(() => ({}));
  const token = (body.api_token as string | undefined)?.trim();
  const domain = (body.company_domain as string | undefined)?.trim()
    .replace(/^https?:\/\//, "").replace(/\.pipedrive\.com.*$/i, "") || null;
  if (!token) return NextResponse.json({ error: "Pipedrive API token is required." }, { status: 400 });

  // Validate before saving so a bad token fails fast in the UI.
  const check = await verifyPipedrive({ api_key: token, subdomain: domain, enabled: true });
  if (!check.ok) {
    return NextResponse.json({ error: `Couldn't connect to Pipedrive: ${check.error ?? "invalid token"}` }, { status: 400 });
  }
  const companyName = check.data?.company_name ?? null;

  const { error } = await supabaseAdmin
    .from("enterprise_integrations")
    .upsert(
      { org_id: g.org.id, provider: "pipedrive", api_key: token, subdomain: domain, enabled: true, config: { company_name: companyName } },
      { onConflict: "org_id,provider" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await audit({ org_id: g.org.id, user_id: g.userId, action: "integration.connected", resource_type: "integration", metadata: { provider: "pipedrive" } });
  const counts = await pipedriveSyncCounts(g.org.id);
  return NextResponse.json({ data: { connected: true, domain, company_name: companyName, last_sync: null, companies: counts.companies, synced: counts.synced, contacts: counts.contacts, syncedContacts: counts.syncedContacts } }, { status: 201 });
}

// DELETE — disconnect. Keeps crm_pipedrive_links so reconnecting still updates
// (rather than duplicating) the previously-pushed organizations.
export async function DELETE() {
  const g = await guard();
  if (!g.ok) return g.res;
  await supabaseAdmin.from("enterprise_integrations").delete().eq("org_id", g.org.id).eq("provider", "pipedrive");
  await audit({ org_id: g.org.id, user_id: g.userId, action: "integration.disconnected", resource_type: "integration", metadata: { provider: "pipedrive" } });
  return NextResponse.json({ ok: true });
}
