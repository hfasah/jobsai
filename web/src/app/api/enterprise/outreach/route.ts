import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export const maxDuration = 20;

let _ai: OpenAI | null = null;
const ai = () => _ai ??= getAIClient(AI_TIERS.fast.provider);

const TEMPLATES: Record<string, string> = {
  offer_letter:       "Generate a professional offer letter. Include role, compensation, start date placeholder, and next steps.",
  rejection:          "Generate a warm, empathetic rejection email. Acknowledge the candidate's effort, be specific but kind, leave the door open for future roles.",
  interview_invite:   "Generate an interview invitation email. Include logistics placeholders, what to expect, and express genuine enthusiasm.",
  reference_request:  "Generate a professional reference request email from the candidate to their referee.",
  outreach:          "Generate a proactive candidate outreach email. Highlight the opportunity and why this person is a great fit.",
  counter_offer:     "Generate a counter-offer response email. Professional, firm but respectful, focused on total compensation and growth.",
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { type, candidate_name, job_title, extra_context, application_id } = body;

  if (!type || !TEMPLATES[type]) {
    return NextResponse.json({ error: "Invalid type. Use: " + Object.keys(TEMPLATES).join(", ") }, { status: 400 });
  }

  let appContext = "";
  if (application_id) {
    const { data: app } = await supabaseAdmin
      .from("enterprise_applications")
      .select("candidate_name,candidate_email,match_score,ai_summary")
      .eq("id", application_id).eq("org_id", org.id).maybeSingle();
    if (app) appContext = `Candidate: ${app.candidate_name}\nAI summary: ${app.ai_summary ?? "N/A"}\nMatch score: ${app.match_score ?? "N/A"}%`;
  }

  const prompt = `${TEMPLATES[type]}

Company: ${org.name}
${candidate_name ? `Candidate name: ${candidate_name}` : ""}
${job_title ? `Role: ${job_title}` : ""}
${appContext}
${extra_context ? `Additional context: ${extra_context}` : ""}

Return JSON: {"subject": "email subject line", "body": "full email body with clear paragraphs"}`;

  const completion = await ai().chat.completions.create({
    model: AI_TIERS.fast.model,
    max_tokens: 600,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const result = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
  return NextResponse.json({ data: result });
}
