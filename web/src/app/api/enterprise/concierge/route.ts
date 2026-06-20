import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 20;

let _ai: OpenAI | null = null;
const ai = () => _ai ??= getAIClient(AI_TIERS.fast.provider);

// Simple IP rate limiter
const rl = new Map<string, { count: number; reset: number }>();
function checkRate(ip: string): boolean {
  const now = Date.now();
  const e = rl.get(ip);
  if (!e || now > e.reset) { rl.set(ip, { count: 1, reset: now + 60_000 }); return true; }
  if (e.count >= 10) return false;
  e.count++; return true;
}

// POST /api/enterprise/concierge — public, no auth
// body: { jobId, messages: [{role, content}] }
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (!checkRate(ip)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const { jobId, messages } = body;
  if (!jobId || !messages?.length) return NextResponse.json({ error: "jobId and messages required." }, { status: 400 });

  const { data: job } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("title, department, location, employment_type, description, responsibilities, qualifications, nice_to_have, salary_min, salary_max, salary_currency")
    .eq("id", jobId)
    .eq("status", "active")
    .maybeSingle();

  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("name, industry, website")
    .eq("id", (await supabaseAdmin.from("enterprise_jobs").select("org_id").eq("id", jobId).maybeSingle()).data?.org_id ?? "")
    .maybeSingle();

  const system = `You are the AI recruiting concierge for ${org?.name ?? "this company"}. Answer candidate questions about this job role accurately and warmly. Keep answers under 80 words.

Role: ${job.title}${job.department ? ` — ${job.department}` : ""}
Location: ${job.location ?? "Not specified"} · ${job.employment_type}
${job.salary_min && job.salary_max ? `Salary: $${job.salary_min.toLocaleString()}–$${job.salary_max.toLocaleString()} ${job.salary_currency}` : ""}
${job.description ? `About: ${job.description.slice(0, 400)}` : ""}
${job.qualifications ? `Requirements: ${job.qualifications.slice(0, 300)}` : ""}
${job.nice_to_have ? `Nice to have: ${job.nice_to_have.slice(0, 200)}` : ""}

If asked something you don't know, say the hiring team will follow up. Never invent information.`;

  const completion = await ai().chat.completions.create({
    model: AI_TIERS.fast.model,
    max_tokens: 200,
    messages: [
      { role: "system", content: system },
      ...messages.slice(-6).map((m: { role: string; content: string }) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      })),
    ],
  });

  return NextResponse.json({ reply: completion.choices[0]?.message?.content?.trim() ?? "I'm not sure — please reach out to our team directly." });
}
