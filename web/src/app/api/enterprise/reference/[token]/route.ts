import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;

let _ai: OpenAI | null = null;
const ai = () => _ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function normRec(raw: unknown): "strong_yes" | "yes" | "maybe" | "no" | null {
  if (typeof raw !== "string") return null;
  const s = raw.toLowerCase();
  if (s.includes("strong")) return "strong_yes";
  if (s.includes("no")) return "no";
  if (s.includes("maybe")) return "maybe";
  if (s.includes("yes")) return "yes";
  return null;
}

// Public: load the reference form by token
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: ref } = await supabaseAdmin
    .from("enterprise_references")
    .select("id, referee_name, relationship, status, questions, app:enterprise_applications(candidate_name)")
    .eq("token", token).maybeSingle();

  if (!ref) return NextResponse.json({ error: "Reference not found." }, { status: 404 });
  if (ref.status === "completed") return NextResponse.json({ error: "This reference has already been submitted." }, { status: 409 });

  return NextResponse.json({ data: {
    referee_name: ref.referee_name,
    candidate_name: (ref.app as unknown as { candidate_name: string } | null)?.candidate_name,
    questions: ref.questions,
  } });
}

// Public: submit the reference
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const responses: { question: string; answer: string }[] = body.responses ?? [];

  const { data: ref } = await supabaseAdmin.from("enterprise_references").select("*").eq("token", token).maybeSingle();
  if (!ref || ref.status === "completed") return NextResponse.json({ error: "Invalid or already submitted." }, { status: 400 });

  let ai_summary = null, ai_sentiment = null, ai_recommendation = null;
  try {
    const text = responses.map((r) => `Q: ${r.question}\nA: ${r.answer}`).join("\n\n");
    const completion = await ai().chat.completions.create({
      model: "gpt-4o-mini", max_tokens: 500, response_format: { type: "json_object" },
      messages: [{ role: "user", content: `Summarize this reference from ${ref.referee_name}.\n${text}\nReturn JSON: {summary, sentiment:"positive|mixed|negative", recommendation:"strong_yes|yes|maybe|no"}` }],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    ai_summary = parsed.summary ?? null;
    ai_sentiment = ["positive", "mixed", "negative"].includes(parsed.sentiment) ? parsed.sentiment : null;
    ai_recommendation = normRec(parsed.recommendation);
  } catch { /* ignore */ }

  await supabaseAdmin.from("enterprise_references").update({
    responses, ai_summary, ai_sentiment, ai_recommendation,
    status: "completed", completed_at: new Date().toISOString(),
  }).eq("id", ref.id);

  return NextResponse.json({ ok: true });
}
