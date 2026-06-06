import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { authApiKey, rateLimit } from "@/lib/enterprise-api-auth";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type" };
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

export async function OPTIONS() { return new NextResponse(null, { headers: cors }); }

type Ctx = { params: Promise<{ jobId: string }> };

// GET — list applications for a job (with scores)
export async function GET(req: NextRequest, { params }: Ctx) {
  const org = await authApiKey(req);
  if (!org) return NextResponse.json({ error: "Invalid API key." }, { status: 401, headers: cors });
  if (!rateLimit(org.id)) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429, headers: cors });
  const { jobId } = await params;

  const { data, error } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id, candidate_name, candidate_email, stage, match_score, ats_score, ai_recommendation, source, created_at")
    .eq("org_id", org.id).eq("job_id", jobId)
    .order("match_score", { ascending: false, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: cors });
  return NextResponse.json({ data }, { headers: cors });
}

// POST — push a candidate into a job (auto-screens in the background)
export async function POST(req: NextRequest, { params }: Ctx) {
  const org = await authApiKey(req);
  if (!org) return NextResponse.json({ error: "Invalid API key." }, { status: 401, headers: cors });
  if (!rateLimit(org.id)) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429, headers: cors });
  const { jobId } = await params;

  const { data: job } = await supabaseAdmin.from("enterprise_jobs").select("id").eq("id", jobId).eq("org_id", org.id).maybeSingle();
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404, headers: cors });

  const body = await req.json().catch(() => ({}));
  if (!body.candidate_name?.trim() || !body.candidate_email?.trim()) {
    return NextResponse.json({ error: "candidate_name and candidate_email are required." }, { status: 400, headers: cors });
  }

  const email = body.candidate_email.trim().toLowerCase();
  const { data: existing } = await supabaseAdmin.from("enterprise_applications")
    .select("id").eq("job_id", jobId).eq("candidate_email", email).maybeSingle();
  if (existing) return NextResponse.json({ error: "Candidate already applied to this job.", id: existing.id }, { status: 409, headers: cors });

  const { data: app, error } = await supabaseAdmin.from("enterprise_applications").insert({
    job_id: jobId, org_id: org.id,
    candidate_name: body.candidate_name.trim(), candidate_email: email,
    candidate_phone: body.candidate_phone ?? null, resume_text: body.resume_text ?? null,
    cover_letter: body.cover_letter ?? null, linkedin_url: body.linkedin_url ?? null,
    portfolio_url: body.portfolio_url ?? null, source: body.source ?? "api",
  }).select("id, candidate_name, stage").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: cors });

  // Fire-and-forget auto-screen
  fetch(`${APP_URL}/api/enterprise/jobs/${jobId}/applications/${app.id}/screen`, {
    method: "POST", headers: { "x-internal-auto-screen": "1" },
  }).catch(() => {});

  return NextResponse.json({ data: app }, { status: 201, headers: cors });
}
