import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { getRecruiterIdentity } from "@/lib/sourcing-email";
import { CAMPAIGN_FEATURE_KEY, renderTemplate, cumulativeOffsetDays } from "@/lib/campaigns";
import { greetingName } from "@/lib/sourcing-email";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/enterprise/campaigns/[id]/preview?enrollmentId=…
// Renders every step of the sequence with a real enrolled candidate's values —
// the exact email that candidate would receive — so a recruiter can eyeball it
// before launch. Falls back to a sample candidate when none are enrolled yet.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const { data: campaign } = await supabaseAdmin
    .from("enterprise_campaigns")
    .select("id, name, created_by, role_title")
    .eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const camp = campaign as { created_by: string; role_title: string | null };

  const [{ data: steps }, { data: enrollments }] = await Promise.all([
    supabaseAdmin.from("enterprise_campaign_steps")
      .select("step_order, delay_days, subject, body")
      .eq("campaign_id", id).order("step_order", { ascending: true }),
    supabaseAdmin.from("enterprise_campaign_enrollments")
      .select("id, candidate_name, candidate_email, job_id")
      .eq("campaign_id", id).eq("org_id", org.id)
      .order("enrolled_at", { ascending: false }).limit(50),
  ]);

  const enrollList = (enrollments ?? []) as { id: string; candidate_name: string; candidate_email: string; job_id: string | null }[];
  const wantId = req.nextUrl.searchParams.get("enrollmentId");
  const chosen = (wantId && enrollList.find((e) => e.id === wantId)) || enrollList[0] || null;

  // Resolve the sample candidate's variable values.
  const candidateName = chosen?.candidate_name || "Jordan Rivera";
  let jobTitle = camp.role_title || "the role";
  if (chosen?.job_id) {
    const { data: job } = await supabaseAdmin
      .from("enterprise_jobs").select("title").eq("id", chosen.job_id).eq("org_id", org.id).maybeSingle();
    if (job?.title) jobTitle = job.title as string;
  }
  const recruiter = await getRecruiterIdentity(camp.created_by);

  const vars = {
    candidate_name: greetingName(candidateName) === "there" ? "there" : candidateName,
    first_name: greetingName(candidateName),
    job_title: jobTitle,
    org_name: org.name,
    sender_name: recruiter.name,
  };

  const stepRows = (steps ?? []) as { step_order: number; delay_days: number; subject: string; body: string }[];
  const rendered = stepRows.map((s) => ({
    step_order: s.step_order,
    delay_days: s.delay_days,
    day: cumulativeOffsetDays(stepRows, s.step_order),
    subject: renderTemplate(s.subject, vars),
    body: renderTemplate(s.body, vars),
  }));

  return NextResponse.json({
    data: {
      candidate: chosen ? { id: chosen.id, name: candidateName, email: chosen.candidate_email } : { id: null, name: candidateName, email: "sample@example.com" },
      is_sample: !chosen,
      job_title: jobTitle,
      sender_name: recruiter.name,
      enrollments: enrollList.map((e) => ({ id: e.id, name: e.candidate_name, email: e.candidate_email })),
      steps: rendered,
    },
  });
}
