import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";
import { createResendDomain } from "@/lib/outreach/resend-domains";

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
const RESERVED = ["jobsai.work"]; // never let a tenant claim the platform domain

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "outreach_campaigns");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("sending_domains")
    .select("id, domain, status, region, records, last_checked_at, verified_at, created_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });
  return NextResponse.json({ data: data ?? [] });
}

// POST { domain: "talent.acme.com" } — registers the domain with Resend and
// returns the DNS records to configure.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "outreach_campaigns");
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_manage_settings");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const domain = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : "";
  if (!DOMAIN_RE.test(domain)) {
    return NextResponse.json({ error: "Enter a valid domain, e.g. talent.yourcompany.com" }, { status: 400 });
  }
  if (RESERVED.some((r) => domain === r || domain.endsWith(`.${r}`))) {
    return NextResponse.json({ error: "That domain is reserved." }, { status: 400 });
  }

  // Global uniqueness: one org per domain.
  const { data: existing } = await supabaseAdmin
    .from("sending_domains")
    .select("id, org_id")
    .eq("domain", domain)
    .maybeSingle();
  if (existing) {
    const mine = (existing as { org_id: string }).org_id === org.id;
    return NextResponse.json(
      { error: mine ? "You've already added this domain." : "This domain is already registered." },
      { status: 409 },
    );
  }

  let created;
  try {
    created = await createResendDomain(domain);
  } catch (e) {
    console.error("[outreach] resend domain create failed", e);
    return NextResponse.json({ error: "Could not register the domain with the email provider." }, { status: 502 });
  }

  const { data: row, error } = await supabaseAdmin
    .from("sending_domains")
    .insert({
      org_id: org.id,
      domain,
      resend_domain_id: created.id,
      region: created.region ?? null,
      status: created.status,
      records: created.records,
      created_by: userId,
    })
    .select("id, domain, status, records, created_at")
    .single();
  if (error || !row) return NextResponse.json({ error: "Could not save the domain." }, { status: 500 });

  after(() => {
    audit({
      org_id: org.id,
      user_id: userId,
      action: "outreach.domain_added",
      resource_type: "sending_domain",
      resource_id: (row as { id: string }).id,
      metadata: { domain },
    });
  });

  return NextResponse.json({ data: row });
}
