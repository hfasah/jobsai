import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { assignToPool } from "@/lib/enterprise-pools";
import type { ScreenResult } from "@/types/enterprise";

export const maxDuration = 30;

let _ai: OpenAI | null = null;
const ai = () => _ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Ctx = { params: Promise<{ jobId: string; appId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const isAutoScreen = req.headers.get("x-internal-auto-screen") === "1";
  const { jobId, appId } = await params;

  let orgId: string | null = null;

  if (isAutoScreen) {
    // Internal call — look up org_id directly from the application
    const { data: appLookup } = await supabaseAdmin
      .from("enterprise_applications")
      .select("org_id")
      .eq("id", appId)
      .maybeSingle();
    orgId = appLookup?.org_id ?? null;
    if (!orgId) return NextResponse.json({ error: "App not found." }, { status: 404 });
  } else {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getMyOrg(userId);
    if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
    orgId = org.id;
  }

  // Load application + job
  const [{ data: app }, { data: job }] = await Promise.all([
    supabaseAdmin.from("enterprise_applications").select("*").eq("id", appId).eq("org_id", orgId).maybeSingle(),
    supabaseAdmin.from("enterprise_jobs").select("*").eq("id", jobId).eq("org_id", orgId).maybeSingle(),
  ]);

  if (!app) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const resumeText = app.resume_text ?? `Name: ${app.candidate_name}\nEmail: ${app.candidate_email}${app.cover_letter ? `\nCover letter: ${app.cover_letter}` : ""}`;

  const jobKeywords = [
    job.description?.slice(0, 600),
    job.qualifications?.slice(0, 600),
    job.responsibilities?.slice(0, 400),
    job.nice_to_have?.slice(0, 300),
  ].filter(Boolean).join("\n");

  const prompt = `You are a senior recruiter AND an ATS (Applicant Tracking System) keyword analyzer. Evaluate this candidate for the job below on two axes.

JOB: ${job.title}
${jobKeywords}

CANDIDATE:
${resumeText.slice(0, 1800)}

Return JSON with:
{
  "match_score": 0-100 overall holistic fit (judgement, soft factors included),
  "skills_score": 0-100 technical/skills match,
  "experience_score": 0-100 experience level match,
  "culture_score": 0-100 communication & culture indicators,
  "risk_flags": ["array of concerns, or empty"],
  "ai_summary": "2-3 sentence summary of the candidate's fit",
  "ai_recommendation": "strong_yes" | "yes" | "maybe" | "no",

  "ats_score": 0-100 strict ATS keyword + requirement coverage (how well the candidate's text literally matches the role's required skills/keywords, the way an automated ATS filter would score it),
  "ats_keywords_matched": ["required keywords/skills found in the candidate text"],
  "ats_keywords_missing": ["required keywords/skills the job needs but the candidate is missing"],
  "ats_summary": "1 sentence on ATS keyword coverage"
}`;

  try {
    const completion = await ai().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const result: ScreenResult & {
      ats_score?: number; ats_keywords_matched?: string[];
      ats_keywords_missing?: string[]; ats_summary?: string;
    } = JSON.parse(completion.choices[0]?.message?.content ?? "{}");

    const { data: updated, error } = await supabaseAdmin
      .from("enterprise_applications")
      .update({
        match_score: result.match_score,
        skills_score: result.skills_score,
        experience_score: result.experience_score,
        culture_score: result.culture_score,
        risk_flags: result.risk_flags ?? [],
        ai_summary: result.ai_summary,
        ai_recommendation: result.ai_recommendation,
        ats_score: result.ats_score ?? null,
        ats_keywords_matched: result.ats_keywords_matched ?? [],
        ats_keywords_missing: result.ats_keywords_missing ?? [],
        ats_summary: result.ats_summary ?? null,
        screened_at: new Date().toISOString(),
        stage: app.stage === "applied" ? "screened" : app.stage,
      })
      .eq("id", appId)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-triage into the matching pool (removes from inbox)
    const triageScore = result.ats_score ?? result.match_score ?? 0;
    await assignToPool(orgId, jobId, appId, triageScore);

    const { data: finalApp } = await supabaseAdmin
      .from("enterprise_applications").select("*").eq("id", appId).maybeSingle();

    return NextResponse.json({ data: finalApp ?? updated });
  } catch (err) {
    console.error("Screening error:", err);
    return NextResponse.json({ error: "AI screening failed." }, { status: 500 });
  }
}
