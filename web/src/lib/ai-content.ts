import OpenAI from "openai";
import { INTERVIEW_TOOL_GUARDRAILS } from "@/lib/avatar";
import { experienceKey } from "@/lib/elicitation";
import type { ParsedJson } from "@/types/resume";
import type { ParsedJobJson } from "@/types/job";
import type {
  AtsBreakdown, AtsWeakness, AtsFormattingIssue, AtsBuzzword,
  AtsKeywordCoverage, AtsFix, TailoredJson, TailorChange,
  CoverTone, CoverLength, InterviewQuestion,
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
      // User-confirmed specifics from the intake interview. Omitted (undefined,
      // dropped by JSON.stringify) when the user has none — identical payload.
      candidate_facts: e.candidate_facts,
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
  summary?: string;
  breakdown: AtsBreakdown;
  weaknesses: AtsWeakness[];
  formatting_issues: AtsFormattingIssue[];
  buzzwords: AtsBuzzword[];
  keyword_coverage: AtsKeywordCoverage;
  fixes: AtsFix[];
  ats_risks: string[];
}

const ATS_SYSTEM = `You are an expert ATS (Applicant Tracking System) resume analyzer.
Evaluate the resume against the target job and return ONLY valid JSON — no markdown.

Scoring (components, 0-100 total):
- keyword_alignment: 0-40 (match rate between resume keywords and required/preferred job skills)
- experience_relevance: 0-25 (how directly the work history maps to the role's responsibilities)
- formatting: 0-20 (ATS-parseable structure, standard section headings, no tables/columns/graphics)
- readability: 0-10 (clarity, concision, quantified achievements, active verbs)
- buzzwords_penalty: -5 to 0 (deduct for vague buzzwords unsupported by evidence)

Schema:
{
  "score": <sum of all components, floor 0, ceil 100>,
  "summary": "2-sentence overall verdict: what is strong and the single most important thing to fix",
  "breakdown": {
    "keyword_alignment": n,
    "keyword_alignment_reason": "1-sentence reason for this score",
    "experience_relevance": n,
    "experience_relevance_reason": "1-sentence reason",
    "formatting": n,
    "formatting_reason": "1-sentence reason",
    "readability": n,
    "readability_reason": "1-sentence reason",
    "buzzwords_penalty": n,
    "buzzwords_penalty_reason": "1-sentence reason or null if penalty is 0"
  },
  "keyword_coverage": {
    "required": ["job's key required skills"],
    "missing": ["required skills absent from resume"],
    "matched": ["skills present in both resume and job"]
  },
  "weaknesses": [{ "section": "experience|skills|summary|education", "issue": "specific issue", "severity": "low|medium|high" }],
  "formatting_issues": [{ "type": "tables|columns|headers|graphics|length|other", "detail": "specific" }],
  "buzzwords": [{ "phrase": "the buzzword used", "suggestion": "replace with specific quantified outcome" }],
  "fixes": [{ "section": "...", "suggestion": "concrete, actionable 1-2 sentence fix", "severity": "low|medium|high" }],
  "ats_risks": ["specific risk that could cause ATS rejection or downranking"]
}

Sort fixes by severity (high first). Be specific, honest, and critical. Avoid generic advice.`;

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
An experience entry may include "candidate_facts" — specifics the candidate confirmed in an intake interview. Treat these as TRUE (same trust level as the resume) and weave the relevant ones naturally into that entry's bullets; you may rephrase them but must NOT exaggerate beyond what a fact states. The resume and candidate_facts are the ONLY sources you may draw facts from.
For the "skills" change, "before" and "after" MUST be human-readable comma-separated lists (e.g. "Python, AWS, Docker, Kubernetes") — never run together without separators.
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

// ─── Resume Builder (optimize against target skills, no specific job) ──────────
export interface SkillBuildResult {
  headline: string;
  summary: string;
  tailored_json: TailoredJson;
  changes: TailorChange[];
  skill_coverage: { covered: string[]; missing: string[] };
}

const SKILL_BUILD_SYSTEM = `You are an expert resume writer. Optimize the candidate's resume to best surface a
set of TARGET SKILLS (and an optional target role), truthfully — never invent experience, employers, titles,
dates, skills, or credentials the candidate doesn't have. You may rephrase, reorder, emphasize relevant work,
and align wording so genuinely-held target skills are prominent and ATS-friendly. Return ONLY valid JSON — no markdown.

Schema:
{
  "headline": "professional headline emphasizing the target skills / role (truthful)",
  "summary": "2-3 sentence summary foregrounding the target skills the candidate genuinely has",
  "tailored_json": {
    "headline": "...",
    "summary": "...",
    "experience": [{ "title": "<keep real title>", "company": "<keep real company>", "start_date": "<keep real start_date exactly>", "end_date": "<keep real end_date, or null>", "is_current": <keep real boolean>, "bullets": ["impact-focused bullets that surface the target skills where genuinely applicable"] }],
    "skills": ["target + real skills, most relevant first"]
  },
  "changes": [{ "section": "summary|experience|skills", "before": "original", "after": "optimized", "reason": "why this surfaces a target skill" }],
  "skill_coverage": { "covered": ["target skills genuinely evidenced in the resume"], "missing": ["target skills NOT evidenced — be honest, do not fabricate"] }
}

Rules: Keep all employers, titles, start_date, end_date, and is_current EXACTLY as in the source. Only reframe wording.
An experience entry may include "candidate_facts" — specifics the candidate confirmed in an intake interview. Treat these as TRUE (same trust level as the resume) and surface the relevant ones in that entry's bullets; rephrase if needed but never exaggerate beyond what a fact states. The resume and candidate_facts are the ONLY sources of fact.
A target skill belongs in "covered" only if the resume genuinely supports it; otherwise put it in "missing". Limit changes[] to 4-6 edits.`;

export async function buildSkillResume(
  resume: ParsedJson,
  targetSkills: string[],
  targetRole?: string
): Promise<SkillBuildResult> {
  const payload = {
    resume: resumeSlim(resume),
    target_skills: targetSkills,
    target_role: targetRole || undefined,
  };
  const res = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SKILL_BUILD_SYSTEM },
      { role: "user", content: JSON.stringify(payload) },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("Empty resume-build response");
  return JSON.parse(content) as SkillBuildResult;
}

// ─── Resume intake: gap detection (elicitation) ───────────────────────────────
// Finds bullets that assert activity without evidence and asks the candidate ONE
// specific question that would surface a real number/outcome/ownership. The
// answers (collected later) become `candidate_facts` that enrich every future
// tailoring — see src/lib/elicitation.ts. This does NOT write a resume.
export type GapType = "missing_metric" | "missing_outcome" | "missing_ownership" | "missing_scope";

export interface ElicitQuestion {
  experience_key: string;     // stable key matching enrichProfile() (computed server-side)
  experience_label: string;   // "Title @ Company" for display
  original_bullet: string;    // the weak phrasing this question targets
  gap_type: GapType;
  question: string;           // recruiter-style, answerable in 1-2 sentences
  why_it_matters: string;     // short note on what a strong answer signals
}

export interface ElicitResult {
  questions: ElicitQuestion[];
}

interface RawGapQuestion {
  experience_index: number;
  original_bullet?: string;
  gap_type?: GapType;
  question?: string;
  why_it_matters?: string;
}

const DETECT_GAPS_SYSTEM = `You are a sharp technical recruiter doing a resume intake interview. You do NOT write
anything — your job is to find the places where the candidate clearly DID something but the resume doesn't say
how much, how well, or what actually changed, then ask ONE specific question that would surface a real number,
an outcome, or their genuine ownership. Return ONLY valid JSON — no markdown.

A gap is exactly one of:
- missing_metric    : an action with no scale/number ("managed the data pipeline")
- missing_outcome   : a task with no result ("led the AWS migration" — and then what?)
- missing_ownership : passive/team framing that hides the candidate's own role ("was involved in")
- missing_scope     : no size signal (team size, budget, users, volume, revenue)

Input shape: { "experience": [ entries with title, company, description ], "job": {...} | undefined }.
The "experience" array is 0-indexed; reference entries by that index.

Rules:
- Ask ONLY about things the resume IMPLIES the candidate did. NEVER ask leading questions that invite invented
  numbers (e.g. do not ask "how much revenue did you drive?" unless revenue ownership is already implied).
- One question per gap, phrased like a real human recruiter — answerable in 1-2 sentences. Not a form field.
- Skip any bullet that already has a concrete number AND an outcome.
- If a target job is given, prioritize the gaps that matter most for THAT job; hardest-hitting first.
- Return at most 6 questions. Fewer is fine — quality over quantity.

Schema:
{
  "questions": [{
    "experience_index": <int, 0-based index into the input experience array>,
    "original_bullet": "<the weak phrasing, drawn from that entry's description>",
    "gap_type": "missing_metric|missing_outcome|missing_ownership|missing_scope",
    "question": "recruiter-style, one sentence",
    "why_it_matters": "<= 10 words: what a hiring manager infers from a strong answer"
  }]
}`;

/**
 * Detects evidence gaps in the resume and returns recruiter-style questions. The
 * caller is expected to ATS-gate this (only worth running on weaker resumes).
 * experience_key is computed server-side so it always matches enrichProfile().
 */
export async function detectGaps(resume: ParsedJson, job?: ParsedJobJson): Promise<ElicitResult> {
  const experiences = resume.experience ?? [];
  if (experiences.length === 0) return { questions: [] };

  const payload = {
    experience: resumeSlim(resume).experience,
    job: job ? jobSlim(job) : undefined,
  };
  const res = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: DETECT_GAPS_SYSTEM },
      { role: "user", content: JSON.stringify(payload) },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("Empty gap-detection response");

  const raw = JSON.parse(content) as { questions?: RawGapQuestion[] };
  const questions = (raw.questions ?? [])
    .map((q): ElicitQuestion | null => {
      const e = experiences[q.experience_index];
      if (!e || !q.question) return null;
      const label = [e.title, e.company].filter(Boolean).join(" @ ");
      return {
        experience_key: experienceKey(e),
        experience_label: label,
        original_bullet: String(q.original_bullet ?? "").trim(),
        gap_type: q.gap_type ?? "missing_metric",
        question: String(q.question).trim(),
        why_it_matters: String(q.why_it_matters ?? "").trim(),
      };
    })
    .filter((q): q is ElicitQuestion => q !== null && q.question.length > 0)
    .slice(0, 6);

  return { questions };
}

// ─── Interview-time extraction (for calendar) ─────────────────────────────────
export interface InterviewEvent {
  found: boolean;
  summary: string;
  startISO: string | null;   // ISO 8601, include the timezone offset when known
  endISO: string | null;
  timeZone: string | null;   // IANA zone if mentioned, else null
  location: string | null;   // video link / phone / address
  notes: string | null;
}

export async function extractInterviewEvent(
  subject: string,
  body: string,
  todayISO: string
): Promise<InterviewEvent> {
  const sys = `You extract a concrete interview/call time from a recruiter email so it can be added to a calendar. Return ONLY valid JSON.
Today is ${todayISO}. Resolve relative dates (e.g. "this Tuesday at 2pm ET") to a concrete ISO 8601 datetime WITH a timezone offset. If a timezone like ET/PT is given, use the correct offset for that date.
If no single concrete date AND time is stated, set found=false. If only a date with no time, found=false.
Default the meeting length to 45 minutes when an end time isn't given.
Schema:
{ "found": <bool>, "summary": "Interview — <company/role if known>", "startISO": "<ISO8601 with offset, or null>", "endISO": "<ISO8601 with offset, or null>", "timeZone": "<IANA zone or null>", "location": "<video link / phone / address, or null>", "notes": "<short context, or null>" }`;

  const res = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: `Subject: ${subject}\n\n${body.slice(0, 5000)}` },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) return { found: false, summary: "", startISO: null, endISO: null, timeZone: null, location: null, notes: null };
  return JSON.parse(content) as InterviewEvent;
}

// ─── Inbox reply draft ────────────────────────────────────────────────────────
export async function draftInboxReply(
  incomingSubject: string,
  incomingBody: string,
  candidateName: string
): Promise<string> {
  const res = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You write a concise, warm, professional reply from a job candidate to a recruiter/employer email. 2-4 short sentences. Match the email's intent (thank them, confirm availability for an interview, provide a verification code politely declined if unknown, etc.). Sign off with the candidate's first name only. Output just the reply body — no subject line, no placeholders, no brackets." },
      { role: "user", content: `Candidate name: ${candidateName}\n\nSubject: ${incomingSubject}\n\nIncoming email:\n${incomingBody.slice(0, 4000)}\n\nWrite the candidate's reply.` },
    ],
    temperature: 0.5,
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
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

// ─── Interview Prep ──────────────────────────────────────────────────────────
export interface InterviewPrepResult {
  questions: InterviewQuestion[];
}

const INTERVIEW_SYSTEM = `You are an expert interview coach. Generate 10 highly likely interview questions
for this specific candidate applying to this specific role. Ground every question in the actual job requirements
and the candidate's real background — no generic filler. ${INTERVIEW_TOOL_GUARDRAILS} Return ONLY valid JSON — no markdown.

Categories to cover (distribute across all 10):
- behavioral: past-behaviour questions answered with the STAR method (4 questions minimum)
- technical: skill/domain knowledge tests specific to this role (2–3 questions)
- role: questions about fit, motivation, or approach to this specific job (2 questions)
- culture: team fit, working style, values alignment (1–2 questions)

Schema:
{
  "questions": [
    {
      "id": "q1",
      "category": "behavioral|technical|role|culture",
      "question": "The interview question as the interviewer would ask it",
      "why_asked": "1 sentence: what the interviewer is trying to assess",
      "talking_points": ["3–4 concise bullet points from the candidate's REAL experience that support their answer"],
      "sample_answer": "Full prose answer (3–5 sentences) using the candidate's actual background",
      "star": {
        "situation": "Specific context from the candidate's real experience — where, when, what was happening",
        "task": "The candidate's specific responsibility or challenge in that situation",
        "action": "Concrete steps the candidate took — the most detailed part, referencing real skills/tools they have",
        "result": "Measurable or tangible outcome — what changed, what was achieved, what was learned"
      }
    }
  ]
}

STAR rules:
- Include "star" ONLY on behavioral and role questions. Omit it entirely for technical and culture questions.
- Every STAR field must be grounded in the candidate's REAL employers, titles, and skills — never invent experience.
- "action" should be the longest field — at least 2 sentences of specific steps.
- "result" must be concrete: a number, a percentage, a shipped feature, a promotion, a saved cost, etc. If no metric is available, describe the qualitative impact specifically.

General rules: talking_points and sample_answer must also reference the candidate's real background.
Never invent experience. If a question can't be grounded in their background, choose a better one.`;

export async function generateInterviewPrep(
  resume: ParsedJson,
  job: ParsedJobJson
): Promise<InterviewPrepResult> {
  const payload = { resume: resumeSlim(resume), job: jobSlim(job) };
  const res = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: INTERVIEW_SYSTEM },
      { role: "user", content: JSON.stringify(payload) },
    ],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("Empty interview prep response");
  return JSON.parse(content) as InterviewPrepResult;
}

// ─── Cover Letter ────────────────────────────────────────────────────────────
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
