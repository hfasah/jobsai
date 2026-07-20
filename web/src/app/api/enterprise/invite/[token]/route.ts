import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET — validate token and show invite info
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data, error } = await supabaseAdmin
    .from("enterprise_invitations")
    .select("*, org:enterprise_orgs(name)")
    .eq("token", token)
    .maybeSingle();
  if (error) {
    console.error("[invite] lookup failed:", error.message);
    return NextResponse.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }

  if (!data) return NextResponse.json({ error: "Invalid invitation link." }, { status: 404 });
  // Already used → they have an account; point them at sign-in instead of a
  // dead-end "invalid" message.
  if (data.accepted_at) {
    return NextResponse.json({ error: "This invitation was already used. Sign in to your workspace instead.", already_accepted: true }, { status: 410 });
  }
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This invitation has expired — ask your contact to re-send it.", expired: true }, { status: 410 });
  }
  return NextResponse.json({ data });
}

// POST — accept invitation
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in first to accept this invitation." }, { status: 401 });
  const { token } = await params;

  const { data: inv } = await supabaseAdmin
    .from("enterprise_invitations")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!inv) return NextResponse.json({ error: "Invalid or expired invitation." }, { status: 404 });

  // Only the invited email may accept — prevents the wrong account claiming the workspace
  if (inv.email) {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const emails = user.emailAddresses.map((e) => e.emailAddress.toLowerCase());
    if (!emails.includes(inv.email.toLowerCase())) {
      return NextResponse.json({ error: `This invitation was sent to ${inv.email}. Please sign in with that email to accept.` }, { status: 403 });
    }
  }

  // Check not already a member
  const { data: existing } = await supabaseAdmin
    .from("enterprise_members")
    .select("id")
    .eq("org_id", inv.org_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    await supabaseAdmin.from("enterprise_members").insert({ org_id: inv.org_id, user_id: userId, role: inv.role });
  }

  await supabaseAdmin.from("enterprise_invitations").update({ accepted_at: new Date().toISOString() }).eq("id", inv.id);
  return NextResponse.json({ org_id: inv.org_id });
}
