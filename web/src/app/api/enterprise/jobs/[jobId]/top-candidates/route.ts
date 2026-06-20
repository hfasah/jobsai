import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export const maxDuration = 30;

let _ai: OpenAI | null = null;
const ai = () => _ai ??= getAIClient(AI_TIERS.fast.provider);

type Ctx = { params: Promise<{ jobId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { jobId } = await params;

  const [jobRes, appsRes] = await Promise.all([
    supabaseAdmin.from("enterprise_jobs").select("id,title,description,department,location").eq("id", jobId).eq("org_id", org.id).maybeSingle(),
    supabaseAdmin.from("enterprise_applications")
      .select("id,candidate_name,candidate_email,stage,match_score,skills_score,experience_score,ai_recommendation,ai_summary,source,tags,risk_flags,created_at")
      .eq("job_id", jobId)
      .eq("org_id", org.id)
      .not("stage", "eq", "rejected")
      .order("match_score", { ascending: false })
      .limit(100),
  ]);

  if (!jobRes.data) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const job = jobRes.data;
  const apps = appsRes.data ?? [];

  if (apps.length === 0) {
    return NextResponse.json({ picks: [], message: "No active candidates for this role yet." });
  }

  // Build compact candidate summaries for GPT
  const candidateSummaries = apps.map((a, i) => (
    `[${i + 1}] ${a.candidate_name} | Score: ${a.match_score ?? "?"}% | Skills: ${a.skills_score ?? "?"}% | Exp: ${a.experience_score ?? "?"}% | Stage: ${a.stage} | Rec: ${a.ai_recommendation ?? "—"} | Source: ${a.source}${a.ai_summary ? ` | AI summary: ${a.ai_summary.slice(0, 80)}` : ""}${a.tags?.length ? ` | Tags: ${a.tags.join(",")}` : ""}${a.risk_flags?.length ? ` | Risks: ${a.risk_flags.join(",")}` : ""}`
  )).join("\n");

  const prompt = `You are a senior recruiter reviewing ${apps.length} candidates for the role: ${job.title}${job.department ? ` (${job.department})` : ""}.

CANDIDATES:
${candidateSummaries}

Select the top 5 candidates to prioritize RIGHT NOW. For each, give:
1. A clear 1-sentence reason WHY they stand out (specific, not generic)
2. A recommended next action (one of: "Schedule interview", "Send offer", "Phone screen", "Request CV", "Review in depth")

Return ONLY a JSON array, no other text:
[{"index": 1, "name": "...", "reason": "...", "next_action": "..."}]

Prioritize candidates with high match scores, strong AI recommendations, and no risk flags. If candidates are in early stages with high scores, recommend moving them forward.`;

  try {
    const completion = await ai().chat.completions.create({
      model: AI_TIERS.fast.model,
      max_tokens: 600,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { index: number; name: string; reason: string; next_action: string }[];

    try {
      const obj = JSON.parse(raw);
      parsed = Array.isArray(obj) ? obj : (obj.picks ?? obj.candidates ?? obj.results ?? []);
    } catch {
      parsed = [];
    }

    // Enrich with application data
    const picks = parsed.slice(0, 5).map((pick) => {
      const app = apps[pick.index - 1] ?? apps.find((a) => a.candidate_name === pick.name);
      return {
        application_id: app?.id,
        candidate_name: pick.name,
        candidate_email: app?.candidate_email,
        stage: app?.stage,
        match_score: app?.match_score,
        ai_recommendation: app?.ai_recommendation,
        reason: pick.reason,
        next_action: pick.next_action,
      };
    }).filter((p) => p.application_id);

    // Fallback: if GPT returned garbage, just return top 5 by score
    if (picks.length === 0) {
      const fallback = apps.slice(0, 5).map((a) => ({
        application_id: a.id,
        candidate_name: a.candidate_name,
        candidate_email: a.candidate_email,
        stage: a.stage,
        match_score: a.match_score,
        ai_recommendation: a.ai_recommendation,
        reason: `Ranked #${apps.indexOf(a) + 1} by match score`,
        next_action: a.stage === "applied" ? "Screen with AI" : "Review",
      }));
      return NextResponse.json({ picks: fallback });
    }

    return NextResponse.json({ picks });
  } catch {
    // Score-based fallback
    const fallback = apps.slice(0, 5).map((a) => ({
      application_id: a.id,
      candidate_name: a.candidate_name,
      candidate_email: a.candidate_email,
      stage: a.stage,
      match_score: a.match_score,
      ai_recommendation: a.ai_recommendation,
      reason: a.match_score != null && a.match_score >= 75 ? "Strong match score, ready to advance" : "Top-ranked candidate by ATS score",
      next_action: a.stage === "applied" ? "Screen with AI" : "Review",
    }));
    return NextResponse.json({ picks: fallback });
  }
}
