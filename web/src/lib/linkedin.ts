import OpenAI from "openai";
import type { ParsedJson } from "@/types/resume";
import type {
  LinkedInProfileResult,
  LinkedInPostResult,
  LinkedInPostTone,
  LinkedInPostFormat,
} from "@/types/linkedin";
import { recordUsage } from "@/lib/llm-usage";

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const MODEL = "gpt-4o";

// Slim the resume to the fields the LinkedIn prompts actually use — keeps the
// token bill down and the model focused (mirrors ai-content.resumeSlim).
function resumeSlim(resume: ParsedJson) {
  return {
    name: resume.name,
    headline: resume.headline,
    summary: resume.summary,
    location: resume.location,
    years_experience: resume.years_experience,
    skills: resume.skills?.map((s) => s.skill) ?? [],
    experience: resume.experience?.map((e) => ({
      title: e.title,
      company: e.company,
      start_date: e.start_date,
      end_date: e.end_date,
      is_current: e.is_current,
      description: e.description,
    })) ?? [],
    education: resume.education?.map((ed) => ({ school: ed.school, degree: ed.degree })) ?? [],
  };
}

// ─── Profile optimizer ─────────────────────────────────────────────────────────

const PROFILE_SYSTEM = `You are a top-tier LinkedIn profile strategist and personal-branding expert.
Using the candidate's resume data, produce an optimized LinkedIn profile and an honest
assessment of their current profile strength. Return ONLY valid JSON — no markdown.

Write in the candidate's voice: first person, warm but credible, specific, never generic.
Avoid empty buzzwords ("results-driven", "team player", "passionate professional") unless
backed by concrete evidence. Favor quantified impact and real keywords recruiters search.

Schema:
{
  "headline": "<=220 chars. Punchy, keyword-rich, role + value + specialty. Not just a job title.",
  "about": "First-person About section, 3-5 short paragraphs separated by \\n\\n. Hook in line 1, what they do + proof, what they're known for, and a soft close. Scannable.",
  "experience_rewrites": [
    {
      "title": "exact role title from resume",
      "company": "exact company from resume",
      "rewrite": "2-3 sentence first-person summary of the role and its scope/impact",
      "bullets": ["3-5 achievement bullets, each starting with a strong verb and quantified where possible"]
    }
  ],
  "skills": ["12-20 recommended LinkedIn skills, ordered by relevance to their target field — prioritize ones recruiters filter on"],
  "score": <0-100 honest strength of the CURRENT profile inferred from the resume's completeness, specificity, and keyword density>,
  "suggestions": [
    { "area": "Headline|About|Experience|Skills|Featured|Banner|Activity", "issue": "what's weak or missing now", "action": "concrete, specific fix", "severity": "low|medium|high" }
  ]
}

Rules:
- Include one experience_rewrites entry per role in the resume (most recent first), max 6.
- Sort suggestions by severity (high first). Be specific and critical, not flattering.
- Never invent employers, titles, dates, or metrics that aren't supported by the resume.`;

export async function optimizeLinkedInProfile(
  resume: ParsedJson,
  userId: string
): Promise<LinkedInProfileResult> {
  const res = await getOpenAI().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: PROFILE_SYSTEM },
      { role: "user", content: JSON.stringify(resumeSlim(resume)) },
    ],
    temperature: 0.5,
    response_format: { type: "json_object" },
  });

  recordUsage({ userId, feature: "linkedin_optimize", model: MODEL, usage: res.usage });

  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");
  return JSON.parse(content) as LinkedInProfileResult;
}

// ─── Content studio (writeups) ─────────────────────────────────────────────────

const TONE_GUIDE: Record<LinkedInPostTone, string> = {
  professional: "polished and authoritative, like a respected practitioner sharing an insight",
  story: "a personal narrative with a clear arc — a moment, a turn, and a lesson",
  contrarian: "a confident, well-reasoned take that challenges a common assumption (without being edgy for its own sake)",
  educational: "a teaching post that breaks a concept into clear, usable steps",
  celebratory: "warm and human, marking a win or milestone while staying gracious and specific",
};

const FORMAT_GUIDE: Record<LinkedInPostFormat, string> = {
  short: "~60-90 words. One sharp idea. 2-4 short lines.",
  standard: "~130-220 words. A scroll-stopping first line, short punchy paragraphs with line breaks between them, and a closing question or CTA.",
  article: "~400-600 words structured like a mini-article: a hook, 3-4 subsections with concrete points, and a takeaway. Use line breaks generously.",
};

const POST_SYSTEM = `You are an elite LinkedIn ghostwriter who writes posts that get read, saved, and reshared.
Return ONLY valid JSON — no markdown.

Craft a LinkedIn post on the requested topic. Rules:
- Open with a strong hook on its own line — no "I'm excited to share" preambles.
- Use short lines and white space (LinkedIn rewards scannable posts). No markdown symbols (*, #, >) inside the body.
- Be specific and credible; avoid empty motivational filler and generic AI phrasing.
- Sound like a real person in the field, not a brand account.
- End with a light call to engage (a question or invitation) unless it's a celebratory post.

Schema:
{
  "body": "the full post text with \\n line breaks",
  "hashtags": ["5-8 relevant, specific hashtags WITHOUT the # symbol"]
}`;

export async function generateLinkedInPost(opts: {
  topic: string;
  tone: LinkedInPostTone;
  format: LinkedInPostFormat;
  field?: string | null;
  userId: string;
}): Promise<LinkedInPostResult> {
  const { topic, tone, format, field, userId } = opts;

  const user = [
    `Topic: ${topic}`,
    field ? `Author's field / headline: ${field}` : null,
    `Tone: ${TONE_GUIDE[tone]}`,
    `Length & structure: ${FORMAT_GUIDE[format]}`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await getOpenAI().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: POST_SYSTEM },
      { role: "user", content: user },
    ],
    temperature: 0.8,
    response_format: { type: "json_object" },
  });

  recordUsage({ userId, feature: "linkedin_post", model: MODEL, usage: res.usage });

  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");
  const parsed = JSON.parse(content) as LinkedInPostResult;
  // Normalize hashtags — strip stray '#' the model sometimes adds.
  parsed.hashtags = (parsed.hashtags ?? []).map((h) => h.replace(/^#/, "").trim()).filter(Boolean);
  return parsed;
}
