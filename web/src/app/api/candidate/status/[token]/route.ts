import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const STAGE_LABELS: Record<string, string> = {
  applied:   "Application Received",
  screening: "Under Review",
  interview: "Interview Stage",
  offer:     "Offer Extended",
  hired:     "Hired",
  rejected:  "Not Moving Forward",
};

const STAGE_MESSAGES: Record<string, string> = {
  applied:   "We've received your application and our team will review it carefully.",
  screening: "Your application is currently being reviewed by our hiring team.",
  interview: "Great news! You've been selected for an interview. Our team will be in touch with scheduling details.",
  offer:     "We're excited to move forward with you. Our team will be reaching out with offer details shortly.",
  hired:     "Congratulations! We're thrilled to have you join the team.",
  rejected:  "After careful consideration, we've decided to move forward with other candidates at this time. We appreciate your interest and encourage you to apply for future openings.",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: app } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id, stage, stage_updated_at, candidate_name, created_at, job:enterprise_jobs(title, org_id), portal_view_count")
    .eq("status_token", token)
    .maybeSingle();

  if (!app) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  const job = app.job as unknown as { title: string; org_id: string } | null;
  const orgId = job?.org_id;

  const { data: org } = orgId
    ? await supabaseAdmin.from("enterprise_orgs").select("name, logo_url, show_powered_by").eq("id", orgId).maybeSingle()
    : { data: null };

  // Increment view count in background (fire-and-forget)
  void supabaseAdmin
    .from("enterprise_applications")
    .update({
      portal_view_count: (app.portal_view_count ?? 0) + 1,
      portal_viewed_at: new Date().toISOString(),
    })
    .eq("status_token", token);

  const stage = (app.stage as string) ?? "applied";

  return NextResponse.json({
    data: {
      candidate_name: app.candidate_name,
      job_title: job?.title ?? "the role",
      org_name: org?.name ?? "the company",
      org_logo: org?.logo_url ?? null,
      show_powered_by: org?.show_powered_by ?? true,
      stage,
      stage_label: STAGE_LABELS[stage] ?? stage,
      stage_message: STAGE_MESSAGES[stage] ?? "",
      applied_at: app.created_at,
      stage_updated_at: app.stage_updated_at ?? app.created_at,
    },
  });
}
