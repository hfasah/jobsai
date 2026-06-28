import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getMyOrg } from "@/lib/enterprise";
import { requirePermission } from "@/lib/enterprise-permissions";
import { supabaseAdmin } from "@/lib/supabase";
import { resend } from "@/lib/resend";
import { wrapEmail, emailFromName } from "@/lib/email-utils";

export const maxDuration = 30;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://app.jobsai.work").replace(/\/$/, "");

type Ctx = { params: Promise<{ jobId: string; appId: string }> };

// POST { hiring_manager_id } — assign a candidate to an internal hiring manager
// (team member) and notify them. They review it in their Workspace.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(userId, "can_move_stages");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { appId } = await params;

  const { hiring_manager_id } = await req.json().catch(() => ({}));
  if (!hiring_manager_id) return NextResponse.json({ error: "hiring_manager_id required." }, { status: 400 });

  // Must be a member of this org.
  const { data: member } = await supabaseAdmin
    .from("enterprise_members").select("user_id").eq("org_id", org.id).eq("user_id", hiring_manager_id).maybeSingle();
  if (!member) return NextResponse.json({ error: "That hiring manager isn't on your team." }, { status: 400 });

  const { data: app, error } = await supabaseAdmin
    .from("enterprise_applications")
    .update({ assigned_to: hiring_manager_id, updated_at: new Date().toISOString() })
    .eq("id", appId).eq("org_id", org.id)
    .select("candidate_name, job:enterprise_jobs(title)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the hiring manager (best-effort — assignment still succeeds if email fails).
  try {
    const o = org as unknown as Record<string, unknown>;
    const hm = await (await clerkClient()).users.getUser(hiring_manager_id);
    const to = hm.emailAddresses.find((e) => e.id === hm.primaryEmailAddressId)?.emailAddress ?? hm.emailAddresses[0]?.emailAddress;
    if (to) {
      const jobTitle = (app.job as { title?: string } | null)?.title;
      await resend.emails.send({
        from: `${emailFromName(org.name, (o.white_label_email_from as string) ?? null)} <support@jobsai.work>`,
        to,
        subject: `Candidate assigned for your review: ${app.candidate_name}`,
        html: wrapEmail(
          `<p>Hi,</p><p><strong>${app.candidate_name}</strong>${jobTitle ? ` (for <strong>${jobTitle}</strong>)` : ""} has been assigned to you for review.</p><p>Open your <a href="${APP_URL}/enterprise/hiring-manager">Workspace</a> to view the résumé and make a decision.</p>`,
          (o.show_powered_by as boolean) ?? true,
        ),
      });
    }
  } catch { /* notification is best-effort */ }

  return NextResponse.json({ data: { assigned_to: hiring_manager_id } });
}
