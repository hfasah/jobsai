import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { INTAKE_DOMAIN, intakeHandle, intakeAddress } from "@/lib/enterprise-intake-inbox";

// GET — the org's candidate intake email address + current handle.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  return NextResponse.json({
    data: { address: intakeAddress(org), handle: intakeHandle(org), domain: INTAKE_DOMAIN },
  });
}

// PATCH { handle } — customise the mailbox local-part (e.g. "acme-jobs").
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { handle } = await req.json().catch(() => ({}));
  const clean = String(handle ?? "").trim().toLowerCase();
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

  const { error } = await supabaseAdmin
    .from("enterprise_orgs")
    .update({ intake_email_handle: clean })
    .eq("id", org.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { address: `${clean}@${INTAKE_DOMAIN}`, handle: clean, domain: INTAKE_DOMAIN } });
}
