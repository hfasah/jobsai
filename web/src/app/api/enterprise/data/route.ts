import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, getMyMembership } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";

// GET — export all org data (GDPR / SOC2)
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getMyMembership(userId);
  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only owners can export data." }, { status: 403 });
  }
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const [jobs, apps, members, pool, interviews] = await Promise.all([
    supabaseAdmin.from("enterprise_jobs").select("*").eq("org_id", org.id),
    supabaseAdmin.from("enterprise_applications").select("*").eq("org_id", org.id),
    supabaseAdmin.from("enterprise_members").select("*").eq("org_id", org.id),
    supabaseAdmin.from("enterprise_talent_pool").select("*").eq("org_id", org.id),
    supabaseAdmin.from("enterprise_interviews").select("*").eq("org_id", org.id),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    organization: org,
    members: members.data ?? [],
    jobs: jobs.data ?? [],
    applications: apps.data ?? [],
    talent_pool: pool.data ?? [],
    interviews: interviews.data ?? [],
  };

  await audit({ org_id: org.id, user_id: userId, action: "data.exported" });

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="jobsai-enterprise-export-${org.slug}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

// DELETE — delete a candidate's data (GDPR right to erasure)
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getMyMembership(userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { candidate_email } = await req.json().catch(() => ({}));
  if (!candidate_email) return NextResponse.json({ error: "candidate_email required." }, { status: 400 });

  // Anonymise rather than hard-delete (preserves pipeline integrity)
  const anon = { candidate_name: "[Deleted]", candidate_email: `deleted-${Date.now()}@deleted.invalid`, candidate_phone: null, resume_text: null, cover_letter: null, linkedin_url: null, portfolio_url: null };

  await Promise.all([
    supabaseAdmin.from("enterprise_applications").update(anon).eq("org_id", org.id).eq("candidate_email", candidate_email),
    supabaseAdmin.from("enterprise_talent_pool").delete().eq("org_id", org.id).eq("candidate_email", candidate_email),
  ]);

  await audit({ org_id: org.id, user_id: userId, action: "data.deleted", metadata: { candidate_email } });
  return NextResponse.json({ ok: true, message: "Candidate data anonymised." });
}
