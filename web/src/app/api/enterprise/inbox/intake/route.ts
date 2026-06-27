import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { INTAKE_DOMAIN, intakeHandle, intakeAddress } from "@/lib/enterprise-intake-inbox";

type OrgRow = { slug: string; intake_email_handle?: string | null } & Record<string, unknown>;

// Shape the intake payload (address/handle + reply-to + any pending Google
// forwarding-confirmation) from the org row.
function intakePayload(org: OrgRow) {
  const code = (org.intake_forward_code as string) || "";
  const link = (org.intake_forward_link as string) || null;
  return {
    address: intakeAddress(org), handle: intakeHandle(org), domain: INTAKE_DOMAIN,
    reply_to_email: (org.reply_to_email as string) ?? "",
    // Surface the banner whenever there's a code OR a verify link (many hosts
    // use a link-only confirmation with no numeric code).
    forward_confirm: (code || link)
      ? {
          code,
          link,
          from: (org.intake_forward_from as string) || null,
          at: (org.intake_forward_at as string) || null,
        }
      : null,
  };
}

// GET — the org's candidate intake email address, reply-to, and any pending
// forwarding-confirmation request from Google.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  return NextResponse.json({ data: intakePayload(org as unknown as OrgRow) });
}

// PATCH — customise the mailbox local-part (`handle`), set the candidate
// `reply_to_email`, or dismiss a forwarding-confirmation (`clear_forward_confirm`).
// Not white-label gated: every org can point candidate replies at its own inbox.
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (body.handle !== undefined) {
    const clean = String(body.handle ?? "").trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(clean)) {
      return NextResponse.json({ error: "Use 3–40 letters, numbers, or hyphens." }, { status: 400 });
    }
    // Reject if another org already claims this handle (by custom handle or slug).
    const { data: clash } = await supabaseAdmin
      .from("enterprise_orgs")
      .select("id")
      .or(`intake_email_handle.eq.${clean},slug.eq.${clean}`)
      .neq("id", org.id)
      .limit(1);
    if (clash && clash.length) {
      return NextResponse.json({ error: "That address is taken — try another." }, { status: 409 });
    }
    update.intake_email_handle = clean;
  }

  if (body.reply_to_email !== undefined) {
    const email = String(body.reply_to_email ?? "").trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    update.reply_to_email = email || null;
  }

  if (body.clear_forward_confirm) {
    Object.assign(update, {
      intake_forward_code: null, intake_forward_link: null,
      intake_forward_from: null, intake_forward_at: null,
    });
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("enterprise_orgs")
    .update(update)
    .eq("id", org.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: intakePayload(data as unknown as OrgRow) });
}
