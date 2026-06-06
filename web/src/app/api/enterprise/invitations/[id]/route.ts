import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, getMyMembership } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";
import { resend } from "@/lib/resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

// DELETE — revoke a pending invitation
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getMyMembership(userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Only owners and admins can revoke invitations." }, { status: 403 });
  }
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  await supabaseAdmin.from("enterprise_invitations").delete().eq("id", id).eq("org_id", org.id);
  await audit({ org_id: org.id, user_id: userId, action: "member.invited", resource_type: "invitation", resource_id: id, metadata: { revoked: true } });
  return NextResponse.json({ ok: true });
}

// POST — resend a pending invitation email
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getMyMembership(userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const { data: inv } = await supabaseAdmin.from("enterprise_invitations").select("*").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!inv) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });

  const acceptUrl = `${APP_URL}/enterprise/invite/${inv.token}`;
  await resend.emails.send({
    from: `${org.name} Recruiting <support@jobsai.work>`,
    to: inv.email,
    subject: `Reminder: join ${org.name} on JobsAI Enterprise`,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#2563eb">Team invitation reminder</h2>
      <p>You've been invited to join <strong>${org.name}</strong> as a ${inv.role}.</p>
      <div style="margin:24px 0"><a href="${acceptUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Accept invitation →</a></div>
      <p style="color:#888;font-size:13px">This link expires in 7 days.</p>
    </div>`,
  }).catch(console.error);

  return NextResponse.json({ ok: true });
}
