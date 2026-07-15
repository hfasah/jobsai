import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { audit } from "@/lib/enterprise-audit";
import { unsuppressEmail } from "@/lib/outreach/suppression";

type Ctx = { params: Promise<{ id: string }> };

// POST — undo a wrong unsubscribe on this thread's contact (e.g. the intent
// classifier misread the quoted footer as an opt-out). Reverses everything the
// unsubscribe auto-action did: the org-wide Do-Not-Contact row, campaign
// enrollment status, sourcing-outreach opt-out, and the thread intent.
export async function POST(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "outreach_campaigns");
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_send_emails");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const { data: thread } = await supabaseAdmin
    .from("inbox_threads")
    .select("id, candidate_email, intent")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  const t = thread as { id: string; candidate_email: string; intent: string | null } | null;
  if (!t) return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  const email = t.candidate_email.toLowerCase();
  const now = new Date().toISOString();

  // 1. Do-Not-Contact row (the org-wide block on every send/enroll path).
  const removed = await unsuppressEmail(org.id, email);

  // 2. Campaign enrollments flipped to 'unsubscribed' → back to 'replied'
  //    (they DID reply; sequences stay paused — no send is re-scheduled).
  const { data: enr, error: enrErr } = await supabaseAdmin
    .from("enterprise_campaign_enrollments")
    .update({ status: "replied", updated_at: now })
    .eq("org_id", org.id)
    .ilike("candidate_email", email)
    .eq("status", "unsubscribed")
    .select("id");
  if (enrErr) return NextResponse.json({ error: `Could not restore enrollments: ${enrErr.message}` }, { status: 500 });

  // 3. Sourcing outreach opt-out flag.
  await supabaseAdmin
    .from("enterprise_sourcing_outreach")
    .update({ unsubscribed: false })
    .eq("org_id", org.id)
    .ilike("candidate_email", email)
    .eq("unsubscribed", true);

  // 4. Thread intent: clear the opt-out so replying/drafting unblocks. Marked
  //    as a question (they replied with one, typically) — the recruiter can
  //    override in the UI.
  if (t.intent === "unsubscribe") {
    await supabaseAdmin
      .from("inbox_threads")
      .update({ intent: "question", updated_at: now })
      .eq("id", t.id)
      .eq("org_id", org.id);
  }

  audit({
    org_id: org.id,
    user_id: userId,
    action: "outreach.contact_reactivated",
    resource_type: "inbox_thread",
    resource_id: t.id,
    metadata: { email, suppressions_removed: removed, enrollments_restored: (enr ?? []).length },
  });

  return NextResponse.json({
    data: { ok: true, suppressions_removed: removed, enrollments_restored: (enr ?? []).length },
  });
}
