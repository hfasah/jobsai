import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export const maxDuration = 45;

let _ai: OpenAI | null = null;
const ai = () => _ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Ctx = { params: Promise<{ jobId: string; appId: string }> };

// Coerce any AI output to one of the four valid recommendation enums
function normalizeRec(raw: unknown): "strong_yes" | "yes" | "maybe" | "no" | null {
  if (typeof raw !== "string") return null;
  const s = raw.toLowerCase();
  if (s.includes("strong")) return "strong_yes";
  if (s.includes("no") && !s.includes("now")) return "no";
  if (s.includes("maybe")) return "maybe";
  if (s.includes("yes") || s.includes("recommend") || s.includes("proceed") || s.includes("advance")) return "yes";
  return null;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { appId } = await params;

  const { data } = await supabaseAdmin
    .from("enterprise_interview_reports")
    .select("*")
    .eq("application_id", appId)
    .eq("org_id", org.id)
    .order("generated_at", { ascending: false });

  return NextResponse.json({ data: data ?? [] });
}

// POST — generate a report.
// body: { report_type: "pre_interview" | "post_interview", round_name?, transcript? }
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId, appId } = await params;
  const body = await req.json().catch(() => ({}));
  const reportType: string = body.report_type ?? "post_interview";

  const [{ data: app }, { data: job }, { data: framework }] = await Promise.all([
    supabaseAdmin.from("enterprise_applications").select("*").eq("id", appId).eq("org_id", org.id).maybeSingle(),
    supabaseAdmin.from("enterprise_jobs").select("*").eq("id", jobId).eq("org_id", org.id).maybeSingle(),
    supabaseAdmin.from("enterprise_competency_frameworks").select("*").eq("job_id", jobId).maybeSingle(),
  ]);

  if (!app) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  if (!framework) return NextResponse.json({ error: "Generate the competency framework for this job first." }, { status: 400 });

  const competencies = (framework.competencies as Array<{ name: string; weight: number; what_to_look_for: string }>) ?? [];
  const compList = competencies.map((c) => `- ${c.name} (${c.weight}%): ${c.what_to_look_for}`).join("\n");

  try {
    if (reportType === "pre_interview") {
      // HR → Hiring Manager memo: why this candidate is worth interviewing
      const resumeText = app.resume_text ?? `${app.candidate_name}\n${app.cover_letter ?? ""}`;
      const prompt = `You are an HR recruiter writing a briefing memo TO THE HIRING MANAGER, recommending why this candidate is worth interviewing for the role. Be concise and decision-useful — the manager is busy.

ROLE: ${job.title} at ${org.name}
${job.qualifications ? `Requirements: ${job.qualifications.slice(0, 500)}` : ""}

SCORECARD COMPETENCIES:
${compList}

CANDIDATE:
${resumeText.slice(0, 1800)}
${app.match_score ? `AI match score: ${app.match_score}%` : ""}
${app.ai_summary ? `Screening summary: ${app.ai_summary}` : ""}

Return ONLY valid JSON:
{
  "overall_score": 0-100 (how strong this candidate is to interview, weighted across competencies based on resume evidence),
  "competency_scores": [{ "name": "exact competency name", "weight": <weight>, "score": 0-100, "evidence": "what in their background supports this (or 'limited evidence on resume')" }],
  "strengths": ["3-4 specific strengths that make them worth the manager's time"],
  "concerns": ["1-3 gaps or things to probe in the interview"],
  "recommendation": "strong_yes | yes | maybe | no",
  "summary": "3-4 sentence memo to the hiring manager: who this candidate is, why they're worth interviewing, and what to focus on."
}
Include one competency_scores entry per competency above, using the SAME names and weights.`;

      const completion = await ai().chat.completions.create({
        model: "gpt-4o-mini", max_tokens: 1400, response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      });
      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");

      const { data, error } = await supabaseAdmin.from("enterprise_interview_reports").insert({
        application_id: appId, job_id: jobId, org_id: org.id,
        report_type: "pre_interview",
        round_name: body.round_name ?? "Pre-interview briefing",
        overall_score: parsed.overall_score ?? null,
        competency_scores: parsed.competency_scores ?? [],
        strengths: parsed.strengths ?? [],
        concerns: parsed.concerns ?? [],
        recommendation: normalizeRec(parsed.recommendation),
        summary: parsed.summary ?? null,
        generated_by: userId,
      }).select("*").single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    // POST-INTERVIEW: score the transcript against the framework
    const transcript: string = (body.transcript ?? "").trim();
    if (!transcript) return NextResponse.json({ error: "Transcript is required for a post-interview report." }, { status: 400 });

    const prompt = `You are an expert interview assessor. Score this interview transcript against the weighted competency scorecard. Use ONLY evidence from the transcript.

ROLE: ${job.title} at ${org.name}

SCORECARD (score each competency 0-100, then the overall is the weighted average):
${compList}

INTERVIEW TRANSCRIPT:
${transcript.slice(0, 9000)}

Return ONLY valid JSON:
{
  "overall_score": <weighted average of competency scores, 0-100>,
  "competency_scores": [{ "name": "exact name", "weight": <weight>, "score": 0-100, "evidence": "specific quote or paraphrase from the transcript supporting this score" }],
  "strengths": ["3-4 specific strengths demonstrated in the interview"],
  "concerns": ["2-4 concerns, red flags, or unaddressed areas"],
  "recommendation": "strong_yes | yes | maybe | no",
  "summary": "4-5 sentence hiring decision summary: how they performed, standout moments, and the recommendation rationale."
}
One competency_scores entry per competency, SAME names and weights. Be specific and cite the transcript.`;

    const completion = await ai().chat.completions.create({
      model: "gpt-4o-mini", max_tokens: 1800, response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");

    const { data, error } = await supabaseAdmin.from("enterprise_interview_reports").insert({
      application_id: appId, job_id: jobId, org_id: org.id,
      report_type: "post_interview",
      round_name: body.round_name ?? "Interview",
      transcript,
      overall_score: parsed.overall_score ?? null,
      competency_scores: parsed.competency_scores ?? [],
      strengths: parsed.strengths ?? [],
      concerns: parsed.concerns ?? [],
      recommendation: normalizeRec(parsed.recommendation),
      summary: parsed.summary ?? null,
      generated_by: userId,
    }).select("*").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update the candidate's overall match score from interview performance if higher
    if (parsed.overall_score && (!app.match_score || parsed.overall_score > app.match_score)) {
      await supabaseAdmin.from("enterprise_applications")
        .update({ match_score: parsed.overall_score, ai_recommendation: normalizeRec(parsed.recommendation) ?? app.ai_recommendation })
        .eq("id", appId);
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Report generation error:", err);
    return NextResponse.json({ error: "Failed to generate report." }, { status: 500 });
  }
}
