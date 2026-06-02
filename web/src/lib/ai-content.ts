import OpenAI from "openai";
import type { ParsedJson } from "@/types/resume";
import type { ParsedJobJson } from "@/types/job";
import type {
  AtsBreakdown, AtsWeakness, AtsFormattingIssue, AtsBuzzword,
  AtsKeywordCoverage, AtsFix, TailoredJson, TailorChange,
  CoverTone, CoverLength,
} from "@/types/phase3";

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

function resumeSlim(resume: ParsedJson) {
  return {
    headline: resume.headline,
    summary: resume.summary,
    years_experience: resume.years_experience,
    skills: resume.skills?.map((s) => s.skill) ?? [],
    experience: resume.experience?.map((e) => ({
      title: e.title, company: e.company,
      start_date: e.start_date, end_date: e.end_date, is_current: e.is_current,
      description: e.description,
    })) ?? [],
    education: resume.education?.map((ed) => ({ school: ed.school, degree: ed.degree })) ?? [],
  };
}

function jobSlim(job: ParsedJobJson) {
  return {
    title: job.title, company: job.company, seniority: job.seniority,
    skills: job.skills ?? [], requirements: job.requirements ?? [],
    responsibilities: job.responsibilities ?? [],
  };
}

// ─── ATS Scan ────────────────────────────────────────────────────────────────
export interface AtsResult {
  score: number;
  breakdown: AtsBreakdown;
  weaknesses: AtsWeakness[];
  formatting_issues: AtsFormattingIssue[];
  buzzwords: AtsBuzzword[];
  keyword_coverage: AtsKeywordCoverage;
  fixes: AtsFix[];
  ats_risks: string[];
}

const ATS_SYSTEM = `You are an ATS (Applicant Tracking System) resume analyzer.
Evaluate the resume against the target job and return ONLY valid JSON — no markdown.

Scoring (components sum to the total, 0-100):
- keyword_alignment: 0-40 (how well resume keywords match required job skills)
- experience_relevance: 0-25 (relevance of work history to the role)
- formatting: 0-20 (ATS-parseable structure, clear sections, standard headings)
- readability: 0-10 (clarity, concision, quantified impact)
- buzzwords_penalty: -5 to 0 (deduct for empty buzzwords without evidence)

Schema:
{
  "score": <sum of components, floor 0>,
  "breakdown": { "keyword_alignment": n, "experience_relevance": n, "formatting": n, "readability": n, "buzzwords_penalty": n },
  "keyword_coverage": { "required": ["job's key skills"], "missing": ["required but absent in resume"], "matched": ["present in both"] },
  "weaknesses": [{ "section": "experience|skills|summary|education", "issue": "specific", "severity": "low|medium|high" }],
  "formatting_issues": [{ "type": "tables|columns|headers|graphics|length", "detail": "specific" }],
  "buzzwords": [{ "phrase": "results-driven", "suggestion": "replace with quantified outcome" }],
  "fixes": [{ "section": "...", "suggestion": "concrete actionable fix", "severity": "low|medium|high" }],
  "ats_risks": ["high-level risks to ATS parsing"]
}

Be specific and honest. Prioritize the most impactful fixes.`;

export async function scanATS(resume: ParsedJson, job: ParsedJobJson, rawResumeText?: string): Promise<AtsResult> {
  const payload = {
    resume: resumeSlim(resume),
    resume_raw_text: rawResumeText?.slice(0, 8000),
    job: jobSlim(job),
  };
  const res = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: ATS_SYSTEM },
      { role: "user", content: JSON.stringify(payload) },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("Empty ATS response");
  const parsed = JSON.parse(content) as AtsResult;
  parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score ?? 0)));
  return parsed;
}

// ─── Resume Tailoring ────────────────────────────────────────────────────────
export interface TailorResult {
  headline: string;
  summary: string;
  tailored_json: TailoredJson;
  changes: TailorChange[];
  keywords_added: string[];
}

const TAILOR_SYSTEM = `You are an expert resume writer. Rewrite the candidate's resume to target the specific job,
truthfully — never invent experience, employers, titles, dates, or credentials the candidate doesn't have.
You may rephrase, reorder, emphasize relevant work, surface real skills, and align wording with the job's
language to improve ATS keyword coverage. Return ONLY valid JSON — no markdown.

Schema:
{
  "headline": "tailored professional headline for this role",
  "summary": "2-3 sentence summary aligned to the job (truthful)",
  "tailored_json": {
    "headline": "...",
    "summary": "...",
    "experience": [{ "title": "<keep real title>", "company": "<keep real company>", "start_date": "<keep real start_date exactly>", "end_date": "<keep real end_date, or null>", "is_current": <keep real boolean>, "bullets": ["impact-focused, keyword-aligned bullets drawn from real experience"] }],
    "skills": ["reordered/surfaced real skills most relevant to the job first"]
  },
  "changes": [{ "section": "summary|experience|skills", "before": "original text", "after": "tailored text", "reason": "why this helps for THIS job" }],
  "keywords_added": ["job keywords now surfaced in the resume that were missing or buried"]
}

Rules: Keep all employers, titles, start_date, end_date, and is_current EXACTLY as in the source — copy them verbatim into each experience entry. Only the framing/wording of bullets changes.
Limit changes[] to the 4-6 most impactful edits.`;

export async function tailorResume(resume: ParsedJson, job: ParsedJobJson): Promise<TailorResult> {
  const payload = { resume: resumeSlim(resume), job: jobSlim(job) };
  const res = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: TAILOR_SYSTEM },
      { role: "user", content: JSON.stringify(payload) },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("Empty tailoring response");
  return JSON.parse(content) as TailorResult;
}

// ─── Cover Letter ────────────────────────────────────────────────────────────
const LENGTH_GUIDE: Record<CoverLength, string> = {
  short: "around 150 words, 2 short paragraphs",
  medium: "around 250 words, 3 paragraphs",
  long: "around 380 words, 4 paragraphs",
};

const TONE_GUIDE: Record<CoverTone, string> = {
  professional: "polished and professional",
  enthusiastic: "warm and genuinely enthusiastic",
  confident: "confident and direct, leading with strengths",
  warm: "personable and warm, human",
  concise: "tight and concise, no filler",
};

export async function generateCoverLetter(
  resume: ParsedJson,
  job: ParsedJobJson,
  tone: CoverTone,
  length: CoverLength
): Promise<string> {
  const system = `You are an expert cover letter writer. Write a tailored cover letter for this candidate and job.
Be truthful — only use the candidate's real experience and skills. Tone: ${TONE_GUIDE[tone]}. Length: ${LENGTH_GUIDE[length]}.
Open with a specific hook tied to the role/company, connect 2-3 of the candidate's most relevant achievements to
the job's needs, and close with a confident call to action. Use the candidate's real name if available.
Do NOT include the date or physical addresses. Return ONLY the letter body as plain text (no JSON, no markdown).`;

  const payload = { resume: resumeSlim(resume), job: jobSlim(job) };
  const res = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload) },
    ],
    temperature: 0.6,
  });
  const content = res.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty cover letter response");
  return content;
}
