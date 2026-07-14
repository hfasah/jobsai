import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";

const MAILBOX_COLS = "id, org_id, kind, address, display_name, domain_id, status, paused_reason, paused_at, ramp_started_at, daily_limit_cap, created_at";

// GET — which of the current user's connected mailboxes (Gmail/Outlook) can be
// used as a campaign sender, and whether each is already registered.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "outreach_campaigns");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data: accounts } = await supabaseAdmin
    .from("enterprise_oauth_accounts")
    .select("provider, email")
    .eq("user_id", userId)
    .in("provider", ["google", "microsoft"]);
  const { data: mailboxes } = await supabaseAdmin
    .from("sending_mailboxes")
    .select("address, kind, status")
    .eq("org_id", org.id)
    .in("kind", ["gmail", "microsoft"]);
  const registered = new Set(((mailboxes ?? []) as { address: string }[]).map((m) => m.address.toLowerCase()));

  const connectable = ((accounts ?? []) as { provider: string; email: string | null }[])
    .filter((a) => !!a.email)
    .map((a) => ({
      provider: a.provider,
      kind: a.provider === "google" ? "gmail" : "microsoft",
      email: (a.email as string).toLowerCase(),
      registered: registered.has((a.email as string).toLowerCase()),
    }));

  return NextResponse.json({ data: connectable });
}

// POST { provider: "google" | "microsoft" } — register the current user's
// connected mailbox as a campaign sender. No DNS: campaigns send from this
// inbox and replies thread back to it. The user's OAuth token (via created_by)
// does the sending. Idempotent per (org, address) — re-activates if paused.
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
  const provider = body.provider === "microsoft" ? "microsoft" : "google";
  const kind = provider === "google" ? "gmail" : "microsoft";

  const { data: acct } = await supabaseAdmin
    .from("enterprise_oauth_accounts")
    .select("email")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  const email = (acct?.email as string | null)?.toLowerCase() ?? null;
  if (!email) {
    return NextResponse.json(
      { error: `Connect your ${provider === "google" ? "Google" : "Microsoft"} account first (Settings → Integrations), then add it here.`, needs_connect: true },
      { status: 400 },
    );
  }

  // Idempotent: reactivate an existing row rather than erroring on the unique
  // (org_id, address) constraint.
  const { data: existing } = await supabaseAdmin
    .from("sending_mailboxes")
    .select("id")
    .eq("org_id", org.id)
    .eq("address", email)
    .maybeSingle();

  let row;
  if (existing) {
    const { data } = await supabaseAdmin
      .from("sending_mailboxes")
      .update({ status: "active", kind, created_by: userId, paused_reason: null, paused_at: null, updated_at: new Date().toISOString() })
      .eq("id", (existing as { id: string }).id)
      .eq("org_id", org.id)
      .select(MAILBOX_COLS)
      .single();
    row = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("sending_mailboxes")
      .insert({
        org_id: org.id,
        kind,
        address: email,
        domain_id: null,
        daily_limit_cap: 200, // connected inboxes cap themselves; keep conservative
        created_by: userId,
      })
      .select(MAILBOX_COLS)
      .single();
    if (error || !data) return NextResponse.json({ error: "Could not register the mailbox." }, { status: 500 });
    row = data;
  }

  after(() => {
    audit({
      org_id: org.id,
      user_id: userId,
      action: "outreach.mailbox_added",
      resource_type: "sending_mailbox",
      resource_id: (row as { id: string }).id,
      metadata: { address: email, kind, connected: true },
    });
  });

  return NextResponse.json({ data: row });
}
