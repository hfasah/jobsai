import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";
import { getMailboxHealth, type MailboxRow } from "@/lib/outreach/deliverability";
import { isUsableStatus } from "@/lib/outreach/resend-domains";

const MAILBOX_COLS = "id, org_id, kind, address, display_name, domain_id, status, paused_reason, paused_at, ramp_started_at, daily_limit_cap, created_at";
const MAX_CAP = 500;

// GET — mailboxes with computed ramp/health.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "outreach_campaigns");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("sending_mailboxes")
    .select(MAILBOX_COLS)
    .eq("org_id", org.id)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as (MailboxRow & { display_name: string | null; domain_id: string | null; paused_at: string | null; created_at: string })[];

  const withHealth = await Promise.all(
    rows.map(async (m) => ({ ...m, health: await getMailboxHealth(m) })),
  );
  return NextResponse.json({ data: withHealth });
}

// POST { address, display_name?, daily_limit_cap? } — create a sending
// mailbox on one of the org's verified domains. (Gmail/Microsoft mailboxes
// are registered automatically when those accounts connect — later PR.)
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
  const address = typeof body.address === "string" ? body.address.trim().toLowerCase() : "";
  const at = address.split("@");
  if (at.length !== 2 || !at[0] || !at[1]) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // The address must live on one of the org's usable sending domains.
  const { data: domain } = await supabaseAdmin
    .from("sending_domains")
    .select("id, domain, status")
    .eq("org_id", org.id)
    .eq("domain", at[1])
    .maybeSingle();
  const domainRow = domain as { id: string; domain: string; status: string } | null;
  if (!domainRow) {
    return NextResponse.json({ error: `Add and verify the domain ${at[1]} first.` }, { status: 400 });
  }
  if (!isUsableStatus(domainRow.status)) {
    return NextResponse.json({ error: `The domain ${at[1]} isn't verified yet.` }, { status: 400 });
  }

  const cap = typeof body.daily_limit_cap === "number" && body.daily_limit_cap >= 10 && body.daily_limit_cap <= MAX_CAP
    ? Math.floor(body.daily_limit_cap)
    : 150;

  const { data: row, error } = await supabaseAdmin
    .from("sending_mailboxes")
    .insert({
      org_id: org.id,
      kind: "domain",
      address,
      display_name: typeof body.display_name === "string" ? body.display_name.trim().slice(0, 80) || null : null,
      domain_id: domainRow.id,
      daily_limit_cap: cap,
      created_by: userId,
    })
    .select(MAILBOX_COLS)
    .single();
  if (error || !row) {
    const dup = error?.message?.includes("duplicate") || error?.code === "23505";
    return NextResponse.json({ error: dup ? "That mailbox already exists." : "Could not create the mailbox." }, { status: dup ? 409 : 500 });
  }

  after(() => {
    audit({
      org_id: org.id,
      user_id: userId,
      action: "outreach.mailbox_added",
      resource_type: "sending_mailbox",
      resource_id: (row as { id: string }).id,
      metadata: { address, cap },
    });
  });

  return NextResponse.json({ data: row });
}
