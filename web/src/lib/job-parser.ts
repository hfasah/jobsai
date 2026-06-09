import OpenAI from "openai";
import type { ParsedJobJson, MatchScoreJson } from "@/types/job";
import type { ParsedJson } from "@/types/resume";

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const PARSE_SYSTEM = `You are a job posting parser. Extract structured data from the job description provided.
Return ONLY a valid JSON object matching this exact schema — no markdown, no explanation:

{
  "title": "string or null",
  "company": "string or null",
  "location": "string or null",
  "employment_type": "full-time|part-time|contract|internship|temporary or null",
  "seniority": "intern|entry|mid|senior|lead|principal|executive or null",
  "compensation": "string or null (salary range if stated)",
  "posting_url": "string or null (if a URL appears in the text)",
  "summary": "string (2-3 sentence summary of the role)",
  "skills": ["required and preferred skills, technologies, tools"],
  "responsibilities": ["key responsibilities"],
  "requirements": ["required qualifications, experience, education"],
  "detected_language": "ISO 639-1 code, e.g. en"
}

Rules:
- Extract skills as individual, normalized terms (e.g. "React", "Python", "AWS")
- If a field is not present, return null or an empty array
- Keep responsibilities and requirements concise (one line each)`;

export async function parseJobText(text: string): Promise<ParsedJobJson> {
  const truncated = text.slice(0, 40000);
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: PARSE_SYSTEM },
      { role: "user", content: truncated },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");
  return JSON.parse(content) as ParsedJobJson;
}

const MATCH_SYSTEM = `You are a supportive career coach helping a job seeker understand their fit for a role. Your tone is warm, encouraging, and personal — like a trusted mentor who wants them to succeed and not give up.

Return ONLY a valid JSON object matching this exact schema — no markdown, no explanation:

{
  "match_score": 0-100,
  "matched_keywords": ["skills/terms present in BOTH resume and job"],
  "missing_keywords": ["important skills/terms in the job but NOT in the resume"],
  "strengths": ["2-4 specific, enthusiastic reasons the candidate is a strong fit — name actual skills/experience, be specific and energising"],
  "gaps": ["2-3 growth areas framed as opportunities to prepare, not failures — e.g. 'Brushing up on X could make you an even stronger candidate'"],
  "explanation": "2-3 sentence encouraging summary written directly TO the candidate (use 'you'/'your'). Acknowledge their real strengths, explain why they have a genuine shot at an interview, and end on a motivating note.",
  "coach_note": "1-2 sentence personalised pep talk. Reference their specific background. Remind them that hiring is not purely about perfect keyword match — attitude, transferable skills, and potential matter. Keep it human and sincere.",
  "interview_tip": "1 sentence on the single strongest talking point they should lead with in an interview for this role.",
  "breakdown": {
    "skills": 0-100,
    "experience": 0-100,
    "title": 0-100,
    "keywords": 0-100
  }
}

Scoring guidance:
- skills: overlap between candidate skills and job-required skills
- experience: does seniority/years align with the role
- title: how closely past titles match the target role
- keywords: ATS keyword coverage
- match_score: weighted overall (skills 35%, experience 30%, title 15%, keywords 20%)
- Be accurate with scores but frame every output from the candidate's perspective: celebrate what they bring, and frame gaps as prep opportunities — never as disqualifiers.
- Even a 60% match can land an interview. Reflect this optimism accurately.`;

export async function scoreMatch(
  resumeProfile: ParsedJson,
  jobParsed: ParsedJobJson
): Promise<MatchScoreJson> {
  const payload = {
    resume: {
      headline: resumeProfile.headline,
      summary: resumeProfile.summary,
      years_experience: resumeProfile.years_experience,
      skills: resumeProfile.skills?.map((s) => s.skill) ?? [],
      experience: resumeProfile.experience?.map((e) => ({
        title: e.title,
        company: e.company,
        is_current: e.is_current,
      })) ?? [],
    },
    job: {
      title: jobParsed.title,
      seniority: jobParsed.seniority,
      skills: jobParsed.skills ?? [],
      requirements: jobParsed.requirements ?? [],
      responsibilities: jobParsed.responsibilities ?? [],
    },
  };

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: MATCH_SYSTEM },
      { role: "user", content: JSON.stringify(payload) },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");
  return JSON.parse(content) as MatchScoreJson;
}
