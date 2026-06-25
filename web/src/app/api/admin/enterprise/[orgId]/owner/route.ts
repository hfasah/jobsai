import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import { inviteToken } from "@/lib/enterprise";
import { resend } from "@/lib/resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";
type Ctx = { params: Promise<{ orgId: string }> };

// POST /api/admin/enterprise/[orgId]/owner — assign / (re)invite the owner email
// on an EXISTING org and provision their login. They join this same workspace on
// first sign-in via claimPendingInvites — no data is recreated. Use to set the
// owner, change the owner, or simply re-send the login invite.
export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { orgId } = await params;
  const body = await req.json().catch(() => ({}));
  const email = (body.email as string | undefined)?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid owner email is required." }, { status: 400 });
  }

  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("id, name, slug")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return NextResponse.json({ error: "Org not found." }, { status: 404 });

  // Record as the org's owner/primary contact.
  await supabaseAdmin.from("enterprise_orgs").update({ contact_email: email }).eq("id", orgId);

  // Reuse a pending invite for this org+email, else create one.
  const { data: existing } = await supabaseAdmin
    .from("enterprise_invitations")
    .select("token")
    .eq("org_id", orgId)
    .eq("email", email)
    .is("accepted_at", null)
    .maybeSingle();
  let token = existing?.token as string | undefined;
  if (!token) {
    token = inviteToken(org.slug);
    await supabaseAdmin.from("enterprise_invitations").insert({
      org_id: orgId,
      email,
      role: "owner",
      invited_by: admin.userId,
      token,
      expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    });
  }
  const inviteUrl = `${APP_URL}/enterprise/invite/${token}`;

  // Clerk invitation → email is recognized + native "set your password" flow.
  let clerkInvited = true;
  try {
    const client = await clerkClient();
    await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${APP_URL}/e/${org.slug}`,
      publicMetadata: { enterprise_org_id: orgId, role: "owner" },
      ignoreExisting: true,
    });
  } catch (e) {
    // Most common reason: the email already has a JobsAI account — they can just
    // sign in (claimPendingInvites then joins them). Not an error for the admin.
    clerkInvited = false;
    console.warn("[admin/owner] Clerk invitation skipped:", e instanceof Error ? e.message : e);
  }

  // Branded invite email with the workspace link.
  if (resend) {
    await resend.emails.send({
      from: "JobsAI <support@jobsai.work>",
      to: email,
      subject: `Your ${org.name} workspace on JobsAI is ready`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#2563eb">Welcome to JobsAI Enterprise</h2>
        <p>You've been set up as the owner of the <strong>${org.name}</strong> recruiting workspace. Click below to sign in (create your password on first use) and take ownership.</p>
        <div style="margin:24px 0"><a href="${inviteUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Open your workspace →</a></div>
        <p style="color:#888;font-size:13px">If a button doesn't work, paste this link: ${inviteUrl}</p>
      </div>`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, invite_url: inviteUrl, clerk_invited: clerkInvited });
}
