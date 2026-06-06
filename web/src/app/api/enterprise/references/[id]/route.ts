import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { recordUsage } from "@/lib/llm-usage";
import { resend } from "@/lib/resend";

export const maxDuration = 30;

let _ai: OpenAI | null = null;
const ai = () => _ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

type Ctx = { params: Promise<{ id: string }> };

function normRec(raw: unknown): "strong_yes" | "yes" | "maybe" | "no" | null {
  if (typeof raw !== "string") return null;
  const s = raw.toLowerCase();
  if (s.includes("strong")) return "strong_yes";
  if (s.includes("no")) return "no";
  if (s.includes("maybe")) return "maybe";
  if (s.includes("yes")) return "yes";
  return null;
}

// PUT — save HR-entered responses, mark declined, or trigger AI summary
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const { data: ref } = await supabaseAdmin.from("enterprise_references").select("*").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!ref) return NextResponse.json({ error: "Reference not found." }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (body.responses !== undefined) update.responses = body.responses;
  if (body.status !== undefined) update.status = body.status;

  // Summarize when we have responses
  if (body.summarize) {
    const responses = (body.responses ?? ref.responses) as { question: string; answer: string }[];
    const text = responses.map((r) => `Q: ${r.question}\nA: ${r.answer}`).join("\n\n");
    try {
      const completion = await ai().chat.completions.create({
        model: "gpt-4o-mini", max_tokens: 500, response_format: { type: "json_object" },
        messages: [{ role: "user", content: `Summarize this reference check from ${ref.referee_name} (${ref.relationship ?? "reference"}).\n${text}\nReturn JSON: {summary: "3-4 sentences", sentiment: "positive|mixed|negative", recommendation: "strong_yes|yes|maybe|no"}` }],
      });
      recordUsage({ orgId: org.id, userId, feature: "references", model: "gpt-4o-mini", usage: completion.usage });
      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
      update.ai_summary = parsed.summary ?? null;
      update.ai_sentiment = ["positive", "mixed", "negative"].includes(parsed.sentiment) ? parsed.sentiment : null;
      update.ai_recommendation = normRec(parsed.recommendation);
      update.status = "completed";
      update.completed_at = new Date().toISOString();
    } catch { /* ignore */ }
  }

  const { data, error } = await supabaseAdmin.from("enterprise_references").update(update).eq("id", id).eq("org_id", org.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST — email the referee a self-service link
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const { data: ref } = await supabaseAdmin.from("enterprise_references").select("*, app:enterprise_applications(candidate_name)").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!ref) return NextResponse.json({ error: "Reference not found." }, { status: 404 });
  if (!ref.referee_email) return NextResponse.json({ error: "Add a referee email first." }, { status: 400 });

  const candidateName = (ref.app as { candidate_name: string } | null)?.candidate_name ?? "the candidate";
  const link = `${APP_URL}/enterprise/reference/${ref.token}`;

  await resend.emails.send({
    from: `${org.name} Recruiting <support@jobsai.work>`,
    to: ref.referee_email,
    subject: `Reference request for ${candidateName} — ${org.name}`,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#2563eb">Reference request</h2>
      <p>Hi ${ref.referee_name},</p>
      <p>${candidateName} has listed you as a reference for a role at ${org.name}. It takes about 3 minutes to complete.</p>
      <div style="margin:24px 0"><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Provide reference →</a></div>
      <p style="color:#888;font-size:13px">Thank you for your time.</p>
    </div>`,
  }).catch(console.error);

  const { data } = await supabaseAdmin.from("enterprise_references").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id).select("*").single();
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;
  await supabaseAdmin.from("enterprise_references").delete().eq("id", id).eq("org_id", org.id);
  return NextResponse.json({ ok: true });
}
