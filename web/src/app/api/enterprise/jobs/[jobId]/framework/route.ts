import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export const maxDuration = 30;

let _ai: OpenAI | null = null;
const ai = () => _ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId } = await params;

  const { data } = await supabaseAdmin
    .from("enterprise_competency_frameworks")
    .select("*")
    .eq("job_id", jobId)
    .eq("org_id", org.id)
    .maybeSingle();

  return NextResponse.json({ data });
}

const SYSTEM = `You are an expert HR competency architect. Given a job description, you:
1. Classify the role into ONE category: technical, sales, customer_service, management, healthcare, administrative, or general.
2. Build a CUSTOM weighted interview scorecard tailored to that exact role.

Category guidance:
- technical (Software/DevOps/Cloud/Data/Security): Technical Competency, Problem Solving, Communication, Leadership, Teamwork
- sales (AE/SDR/BDR/Agent): Communication, Persuasion, Relationship Building, Objection Handling, Drive & Motivation, Goal Orientation
- customer_service (Support/CSM/Call Center): Empathy, Listening, Patience, Conflict Resolution, Communication, Professionalism
- management (Director/VP/Lead/Manager): Leadership, Strategic Thinking, Decision Making, Accountability, Team Development, Executive Presence
- healthcare (Nurse/Caregiver/Medical): Compassion, Patient Care, Communication, Professional Ethics, Stress Management, Attention to Detail
- administrative (EA/Office Manager/Coordinator): Organization, Attention to Detail, Time Management, Communication, Reliability, Multi-tasking

ALWAYS weave in universal competencies where relevant (Communication, Culture Fit, Reliability, Motivation, Integrity).
Tailor competency NAMES and WEIGHTS to the specific seniority and focus of THIS job — do not just copy the template.

Return ONLY valid JSON:
{
  "role_type": "one of the 7 categories",
  "role_type_label": "human label e.g. 'Sales Role'",
  "competencies": [
    { "name": "Competency name", "weight": 25, "description": "what this measures for this role", "what_to_look_for": "concrete signals of a strong answer" }
  ]
}
Rules: 5-7 competencies. Weights are integers that sum to EXACTLY 100. Order by weight descending.`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId } = await params;

  const { data: job } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("title, department, description, qualifications, responsibilities")
    .eq("id", jobId).eq("org_id", org.id).maybeSingle();

  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const companyValues: string = body.company_values ?? "";

  const userPrompt = `Company: ${org.name}${org.industry ? ` (${org.industry})` : ""}
${companyValues ? `Company values: ${companyValues}` : ""}
Role: ${job.title}${job.department ? ` — ${job.department}` : ""}
${job.description ? `Overview: ${job.description.slice(0, 600)}` : ""}
${job.qualifications ? `Requirements: ${job.qualifications.slice(0, 600)}` : ""}
${job.responsibilities ? `Responsibilities: ${job.responsibilities.slice(0, 400)}` : ""}

Generate the custom weighted interview scorecard.`;

  try {
    const completion = await ai().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userPrompt }],
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");

    // Normalise weights to sum to 100
    const comps: Array<{ name: string; weight: number; description: string; what_to_look_for: string }> = parsed.competencies ?? [];
    const total = comps.reduce((s, c) => s + (c.weight ?? 0), 0) || 1;
    comps.forEach((c) => { c.weight = Math.round((c.weight / total) * 100); });

    const { data, error } = await supabaseAdmin
      .from("enterprise_competency_frameworks")
      .upsert({
        job_id: jobId,
        org_id: org.id,
        role_type: parsed.role_type ?? "general",
        role_type_label: parsed.role_type_label ?? "General Role",
        competencies: comps,
        company_values: companyValues || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "job_id" })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error("Framework generation error:", err);
    return NextResponse.json({ error: "Failed to generate framework." }, { status: 500 });
  }
}

// PUT — manually edit the framework (weights / competencies)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId } = await params;
  const body = await req.json().catch(() => ({}));

  const { data, error } = await supabaseAdmin
    .from("enterprise_competency_frameworks")
    .update({ competencies: body.competencies, company_values: body.company_values, updated_at: new Date().toISOString() })
    .eq("job_id", jobId).eq("org_id", org.id)
    .select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
