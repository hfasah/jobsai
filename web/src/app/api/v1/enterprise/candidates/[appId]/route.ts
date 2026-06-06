import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { authApiKey, rateLimit } from "@/lib/enterprise-api-auth";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type" };

export async function OPTIONS() { return new NextResponse(null, { headers: cors }); }

// GET — full candidate record with AI scores
export async function GET(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const org = await authApiKey(req);
  if (!org) return NextResponse.json({ error: "Invalid API key." }, { status: 401, headers: cors });
  if (!rateLimit(org.id)) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429, headers: cors });
  const { appId } = await params;

  const { data, error } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id, job_id, candidate_name, candidate_email, candidate_phone, linkedin_url, portfolio_url, stage, source, match_score, ats_score, skills_score, experience_score, culture_score, ai_summary, ai_recommendation, ats_keywords_matched, ats_keywords_missing, risk_flags, tags, created_at")
    .eq("id", appId).eq("org_id", org.id).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: cors });
  if (!data) return NextResponse.json({ error: "Candidate not found." }, { status: 404, headers: cors });
  return NextResponse.json({ data }, { headers: cors });
}

// PATCH — update a candidate's stage via API
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const org = await authApiKey(req);
  if (!org) return NextResponse.json({ error: "Invalid API key." }, { status: 401, headers: cors });
  if (!rateLimit(org.id)) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429, headers: cors });
  const { appId } = await params;
  const body = await req.json().catch(() => ({}));

  const valid = ["applied", "screened", "interview", "offer", "hired", "rejected"];
  if (!body.stage || !valid.includes(body.stage)) {
    return NextResponse.json({ error: `stage must be one of: ${valid.join(", ")}` }, { status: 400, headers: cors });
  }

  const { data, error } = await supabaseAdmin.from("enterprise_applications")
    .update({ stage: body.stage, stage_updated_at: new Date().toISOString() })
    .eq("id", appId).eq("org_id", org.id).select("id, stage").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: cors });
  return NextResponse.json({ data }, { headers: cors });
}
