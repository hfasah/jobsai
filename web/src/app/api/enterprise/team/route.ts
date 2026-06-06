import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, getMyMembership } from "@/lib/enterprise";
import { resend } from "@/lib/resend";
import { audit } from "@/lib/enterprise-audit";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data: members } = await supabaseAdmin
    .from("enterprise_members")
    .select("*")
    .eq("org_id", org.id)
    .order("created_at");

  const { data: invitations } = await supabaseAdmin
    .from("enterprise_invitations")
    .select("*")
    .eq("org_id", org.id)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  // Enrich members with Clerk user data
  const client = await clerkClient();
  const enriched = await Promise.all(
    (members ?? []).map(async (m) => {
      try {
        const user = await client.users.getUser(m.user_id);
        return {
          ...m,
          name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Unknown",
          email: user.emailAddresses[0]?.emailAddress ?? "",
          image_url: user.imageUrl,
        };
      } catch {
        return { ...m, name: "Unknown", email: "", image_url: null };
      }
    })
  );

  const myRole = (members ?? []).find((m) => m.user_id === userId)?.role ?? "recruiter";
  return NextResponse.json({ data: { members: enriched, invitations: invitations ?? [], my_role: myRole, my_user_id: userId } });
}

// POST — invite a new team member
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getMyMembership(userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Only owners and admins can invite members." }, { status: 403 });
  }

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const email = (body.email as string | undefined)?.trim().toLowerCase();
  const role: string = body.role ?? "recruiter";

  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

  const { data: invitation, error } = await supabaseAdmin
    .from("enterprise_invitations")
    .insert({ org_id: org.id, email, role, invited_by: userId })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const acceptUrl = `${APP_URL}/enterprise/invite/${invitation.token}`;

  await resend.emails.send({
    from: `${org.name} Recruiting <support@jobsai.work>`,
    to: email,
    subject: `You've been invited to join ${org.name} on JobsAI Enterprise`,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#2563eb">Team invitation</h2>
      <p>You've been invited to join <strong>${org.name}</strong> as a ${role} on JobsAI Enterprise.</p>
      <div style="margin:24px 0">
        <a href="${acceptUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Accept invitation →
        </a>
      </div>
      <p style="color:#888;font-size:13px">This link expires in 7 days. If you didn't expect this, ignore this email.</p>
    </div>`,
  }).catch(console.error);

  await audit({ org_id: org.id, user_id: userId, action: "member.invited", resource_type: "invitation", resource_id: invitation.id, metadata: { email, role } });

  return NextResponse.json({ data: invitation }, { status: 201 });
}
