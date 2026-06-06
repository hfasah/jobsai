import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { recordUsage } from "@/lib/llm-usage";

export const maxDuration = 45;

let _ai: OpenAI | null = null;
const ai = () => _ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// per-user rate limit
const rl = new Map<string, { count: number; reset: number }>();
function ok(id: string) {
  const now = Date.now(); const e = rl.get(id);
  if (!e || now > e.reset) { rl.set(id, { count: 1, reset: now + 60_000 }); return true; }
  if (e.count >= 20) return false; e.count++; return true;
}

// POST { request, context?, prompt_id? } → generated content
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ok(userId)) return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const request: string = (body.request ?? "").trim();
  const context: string = (body.context ?? "").trim();
  if (!request) return NextResponse.json({ error: "Type what you'd like the AI to write." }, { status: 400 });

  const system = `You are an expert recruiting & HR copywriter working inside ${org.name}'s hiring platform${org.industry ? ` (${org.industry})` : ""}. You help recruiters write anything they need: job descriptions, candidate emails (outreach, interview invites, rejections, offers), interview questions, scorecards, LinkedIn posts, boolean search strings, candidate summaries, and more.

Rules:
- Produce ready-to-use output — no preamble like "Sure, here's…", just the content.
- Match a professional, warm, inclusive tone unless told otherwise.
- If the request is an email, include a subject line.
- Keep it concise and well-structured (use short paragraphs / bullets where helpful).`;

  const userMsg = context
    ? `${request}\n\n--- Context to use ---\n${context.slice(0, 4000)}`
    : request;

  try {
    const completion = await ai().chat.completions.create({
      model: "gpt-4o-mini", max_tokens: 1200,
      messages: [{ role: "system", content: system }, { role: "user", content: userMsg }],
    });
    recordUsage({ orgId: org.id, userId, feature: "ask_ai", model: "gpt-4o-mini", usage: completion.usage });
    const output = completion.choices[0]?.message?.content?.trim() ?? "";

    // bump prompt usage if a saved template was used
    if (body.prompt_id) {
      supabaseAdmin.from("enterprise_ai_prompts").select("uses").eq("id", body.prompt_id).maybeSingle()
        .then(({ data }) => { if (data) supabaseAdmin.from("enterprise_ai_prompts").update({ uses: (data.uses ?? 0) + 1 }).eq("id", body.prompt_id).then(() => {}); });
    }

    return NextResponse.json({ output });
  } catch (err) {
    console.error("AI assistant error:", err);
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });
  }
}
