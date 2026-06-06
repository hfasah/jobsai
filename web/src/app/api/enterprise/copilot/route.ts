import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export const maxDuration = 30;

let _ai: OpenAI | null = null;
const ai = () => _ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Simple rate limiter per user
const rl = new Map<string, { count: number; reset: number }>();
function checkRate(id: string) {
  const now = Date.now();
  const e = rl.get(id);
  if (!e || now > e.reset) { rl.set(id, { count: 1, reset: now + 60_000 }); return true; }
  if (e.count >= 15) return false;
  e.count++; return true;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!checkRate(userId)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const query: string = body.query ?? "";
  const history: Array<{ role: string; content: string }> = body.history ?? [];

  if (!query.trim()) return NextResponse.json({ error: "Query required." }, { status: 400 });

  // Load all candidates as context
  const [appsRes, jobsRes, poolRes] = await Promise.all([
    supabaseAdmin.from("enterprise_applications")
      .select("id,candidate_name,candidate_email,stage,match_score,skills_score,experience_score,ai_recommendation,ai_summary,source,tags,risk_flags,created_at, job:enterprise_jobs(title)")
      .eq("org_id", org.id)
      .order("match_score", { ascending: false })
      .limit(100),
    supabaseAdmin.from("enterprise_jobs")
      .select("id,title,department,status,created_at")
      .eq("org_id", org.id)
      .limit(20),
    supabaseAdmin.from("enterprise_talent_pool")
      .select("candidate_name,candidate_email,match_score,source_job_title,status,skills_tags")
      .eq("org_id", org.id)
      .limit(50),
  ]);

  const apps = appsRes.data ?? [];
  const jobs = jobsRes.data ?? [];
  const pool = poolRes.data ?? [];

  // Build a compact data summary for the AI
  const dataSummary = `
ORGANIZATION: ${org.name}

ACTIVE JOBS (${jobs.filter((j) => j.status === "active").length}):
${jobs.map((j) => `- ${j.title} (${j.status})`).join("\n")}

ALL CANDIDATES (${apps.length} total):
${apps.slice(0, 50).map((a) => `- ${a.candidate_name} | ${(a.job as unknown as { title: string } | null)?.title ?? "?"} | Stage: ${a.stage} | Score: ${a.match_score ?? "?"}% | Rec: ${a.ai_recommendation ?? "?"} | Source: ${a.source}${a.tags?.length ? ` | Tags: ${a.tags.join(",")}` : ""}${a.risk_flags?.length ? ` | Risks: ${a.risk_flags.join(",")}` : ""}`).join("\n")}

TALENT POOL (${pool.length} candidates):
${pool.slice(0, 20).map((p) => `- ${p.candidate_name} | ${p.source_job_title ?? "?"} | Score: ${p.match_score ?? "?"}% | Status: ${p.status}`).join("\n")}
`;

  const system = `You are a Recruiter Copilot AI for ${org.name}. You have access to real-time candidate data.

${dataSummary}

Answer recruiter questions conversationally. You can:
- Search/filter candidates ("find DevOps candidates with > 70 score")
- Compare candidates ("compare Jane and John")
- Analyse pipeline health ("how is our interview conversion rate?")
- Give hiring recommendations ("who should we advance?")
- Generate insights ("which source gives the best candidates?")

Be concise and specific. Use candidate names. Format tables with | separators when comparing multiple candidates. Keep answers under 200 words unless a full list is needed.`;

  const messages = [
    { role: "system" as const, content: system },
    ...history.slice(-8).map((m) => ({ role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: query },
  ];

  const completion = await ai().chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 500,
    messages,
  });

  return NextResponse.json({ reply: completion.choices[0]?.message?.content?.trim() ?? "I couldn't find an answer for that." });
}
