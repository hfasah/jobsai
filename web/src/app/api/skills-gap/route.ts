import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getModel, logModelUsage } from "@/lib/ai-models";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

export interface SkillGap {
  skill: string;
  frequency: number;
  priority: "high" | "medium" | "low";
  reason: string;
  learn_how: string[];
}

export interface SkillCategory {
  name: string;
  matched: string[];
  missing: string[];
  score: number;
}

export interface QuickWin {
  skill: string;
  reason: string;
  learn_how: string[];
}

export interface SkillsGapResult {
  summary: string;
  match_percent: number;
  job_count: number;
  your_skills: string[];
  top_gaps: SkillGap[];
  categories: SkillCategory[];
  quick_wins: QuickWin[];
  analyzed_at: string;
}

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// GET /api/skills-gap — return cached result
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("skills_gap_analysis")
    .select("result_json, job_count, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  return NextResponse.json({ data: data?.result_json ?? null, job_count: data?.job_count ?? 0 });
}

// POST /api/skills-gap — generate analysis
export async function POST(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load user's resume skills
  const { data: primaryDoc } = await supabaseAdmin
    .from("resume_documents")
    .select("active_version_id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .eq("is_archived", false)
    .maybeSingle();

  if (!primaryDoc?.active_version_id) {
    return NextResponse.json(
      { error: "No primary resume found. Upload a resume first." },
      { status: 409 }
    );
  }

  const { data: profile } = await supabaseAdmin
    .from("resume_parsed_profile")
    .select("parsed_json")
    .eq("version_id", primaryDoc.active_version_id)
    .maybeSingle();

  const resumeParsed = profile?.parsed_json as {
    skills?: { skill: string; category?: string }[];
    experience?: { title: string }[];
    headline?: string;
  } | null;

  if (!resumeParsed) {
    return NextResponse.json({
      error: "Your resume is still being analyzed. Please wait a moment and try again.",
      reason: "resume_not_ready",
    }, { status: 409 });
  }

  // Load all jobs for this user (last 100)
  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!jobs || jobs.length === 0) {
    return NextResponse.json(
      { error: "No jobs imported yet. Import some jobs first." },
      { status: 409 }
    );
  }

  const jobIds = jobs.map((j) => j.id);

  const { data: parsedJobs } = await supabaseAdmin
    .from("job_parsed")
    .select("parsed_json")
    .in("job_id", jobIds);

  const allJobSkills: string[] = [];
  const skillFreq: Record<string, number> = {};

  for (const pj of parsedJobs ?? []) {
    const pjData = pj.parsed_json as { skills?: string[]; title?: string } | null;
    const skills = pjData?.skills ?? [];
    for (const s of skills) {
      const key = s.toLowerCase();
      skillFreq[key] = (skillFreq[key] ?? 0) + 1;
      if (!allJobSkills.includes(s)) allJobSkills.push(s);
    }
  }

  const resumeSkills = (resumeParsed.skills ?? []).map((s) => s.skill);
  const resumeSkillsLower = new Set(resumeSkills.map((s) => s.toLowerCase()));

  // Top job skills the user lacks
  const missingSkills = Object.entries(skillFreq)
    .filter(([key]) => !resumeSkillsLower.has(key))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 30)
    .map(([key, freq]) => {
      const original = allJobSkills.find((s) => s.toLowerCase() === key) ?? key;
      return { skill: original, frequency: freq };
    });

  const systemPrompt = `You are a career coach analyzing a candidate's skills against their target job market.
Return ONLY a valid JSON object matching this schema exactly:
{
  "summary": "2–3 sentence overview of the gap analysis and main priority",
  "match_percent": <integer 0-100>,
  "your_skills": [<top 12 resume skills as strings>],
  "top_gaps": [
    {
      "skill": "<skill name>",
      "frequency": <number of jobs mentioning it>,
      "priority": "<high|medium|low>",
      "reason": "<one sentence why this matters for their target roles>",
      "learn_how": ["<resource 1>", "<resource 2>", "<resource 3>"]
    }
  ],
  "categories": [
    {
      "name": "<category e.g. Frontend, Backend, Cloud, Data, DevOps, Soft Skills>",
      "matched": [<skills user HAS in this category>],
      "missing": [<skills user LACKS in this category>],
      "score": <integer 0-100 representing coverage>
    }
  ],
  "quick_wins": [
    {
      "skill": "<skill>",
      "reason": "<why it's a quick win given their background>",
      "learn_how": ["<resource 1>", "<resource 2>"]
    }
  ]
}
Rules:
- top_gaps: 6–10 items, sorted by priority then frequency
- categories: 3–5 relevant categories only
- quick_wins: 3–4 items — skills that are EASY to learn given their existing stack
- learn_how: specific resource names (docs, courses, platforms) not generic advice
- Do not repeat skills across top_gaps and quick_wins`;

  const jobCount = parsedJobs?.length ?? 0;

  const userPrompt = `Candidate's current skills: ${resumeSkills.slice(0, 20).join(", ") || "none listed"}
Candidate's background: ${resumeParsed.headline ?? "not specified"}

Top ${Math.min(missingSkills.length, 20)} missing skills from their ${jobCount} target jobs (format: skill — frequency):
${missingSkills
  .slice(0, 20)
  .map((s) => `${s.skill} — ${s.frequency} jobs`)
  .join("\n")}

Total jobs analyzed: ${jobCount}
Total unique skills found across jobs: ${allJobSkills.length}
Total resume skills: ${resumeSkills.length}

Analyze the gap and fill the schema.`;

  try {
    const model = getModel("skillsGap");
    logModelUsage("skillsGap");

    const response = await getOpenAI().chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response");

    const raw = JSON.parse(content) as Omit<SkillsGapResult, "job_count" | "analyzed_at">;
    const result: SkillsGapResult = {
      ...raw,
      job_count: jobCount,
      analyzed_at: new Date().toISOString(),
    };

    await supabaseAdmin.from("skills_gap_analysis").upsert(
      { user_id: userId, result_json: result, job_count: jobCount, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("Skills gap analysis error:", err);
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
  }
}
