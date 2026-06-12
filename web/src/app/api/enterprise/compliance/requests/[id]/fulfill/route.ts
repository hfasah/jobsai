import { auth } from "@clerk/nextjs/server";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "compliance_gdpr");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const { data: request } = await supabaseAdmin
    .from("enterprise_compliance_requests")
    .select("*")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();

  if (!request) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (request.status === "completed") return NextResponse.json({ error: "Already fulfilled." }, { status: 400 });

  const email = request.candidate_email as string;

  // ── Access / Portability: export candidate data ───────────────────────────
  if (request.request_type === "access" || request.request_type === "portability") {
    const [appsRes, interviewsRes, offersRes] = await Promise.all([
      supabaseAdmin
        .from("enterprise_applications")
        .select("id,job_id,stage,source,match_score,ai_summary,ai_recommendation,risk_flags,tags,notes,created_at,screened_at")
        .eq("org_id", org.id)
        .eq("candidate_email", email),
      supabaseAdmin
        .from("enterprise_interviews")
        .select("id,application_id,status,overall_score,ai_summary,completed_at")
        .eq("org_id", org.id),
      supabaseAdmin
        .from("enterprise_offer_letters")
        .select("id,job_title,salary,start_date,status,created_at,signed_at")
        .eq("org_id", org.id)
        .eq("candidate_email", email),
    ]);

    const appIds = (appsRes.data ?? []).map((a) => a.id);
    const interviews = (interviewsRes.data ?? []).filter((i) => appIds.includes(i.application_id));

    const exportData = {
      generated_at: new Date().toISOString(),
      org: org.name,
      candidate_email: email,
      applications: appsRes.data ?? [],
      interviews,
      offers: offersRes.data ?? [],
    };

    // Mark request completed
    await supabaseAdmin
      .from("enterprise_compliance_requests")
      .update({ status: "completed", resolved_at: new Date().toISOString(), resolved_by: userId })
      .eq("id", id);

    void supabaseAdmin.from("enterprise_audit_logs").insert({
      org_id: org.id, user_id: userId,
      action: "compliance.access_fulfilled",
      resource_type: "compliance_request", resource_id: id,
      metadata: { candidate_email: email, records_exported: appIds.length },
    });

    return NextResponse.json({ data: exportData });
  }

  // ── Erasure: anonymize all candidate records ──────────────────────────────
  if (request.request_type === "erasure") {
    const { data: apps } = await supabaseAdmin
      .from("enterprise_applications")
      .select("id,legal_hold")
      .eq("org_id", org.id)
      .eq("candidate_email", email);

    const onHold = (apps ?? []).filter((a) => a.legal_hold);
    if (onHold.length > 0) {
      return NextResponse.json({
        error: `${onHold.length} application(s) are under legal hold and cannot be erased.`,
      }, { status: 409 });
    }

    const appIds = (apps ?? []).map((a) => a.id);

    // Anonymize application PII
    await supabaseAdmin
      .from("enterprise_applications")
      .update({
        candidate_name: "[deleted]",
        candidate_email: `deleted-${id.slice(0, 8)}@erased.invalid`,
        candidate_phone: null,
        resume_text: null,
        resume_url: null,
        cover_letter: null,
        linkedin_url: null,
        portfolio_url: null,
        notes: null,
        ai_summary: null,
      })
      .eq("org_id", org.id)
      .eq("candidate_email", email);

    // Anonymize offer letters
    await supabaseAdmin
      .from("enterprise_offer_letters")
      .update({
        candidate_name: "[deleted]",
        candidate_email: `deleted-${id.slice(0, 8)}@erased.invalid`,
        content: "[Content erased per data erasure request]",
      })
      .eq("org_id", org.id)
      .eq("candidate_email", email);

    // Mark request completed
    await supabaseAdmin
      .from("enterprise_compliance_requests")
      .update({ status: "completed", resolved_at: new Date().toISOString(), resolved_by: userId })
      .eq("id", id);

    void supabaseAdmin.from("enterprise_audit_logs").insert({
      org_id: org.id, user_id: userId,
      action: "compliance.erasure_fulfilled",
      resource_type: "compliance_request", resource_id: id,
      metadata: { candidate_email: email, apps_anonymized: appIds.length },
    });

    return NextResponse.json({ ok: true, apps_anonymized: appIds.length });
  }

  return NextResponse.json({ error: "Unsupported request type." }, { status: 400 });
}
