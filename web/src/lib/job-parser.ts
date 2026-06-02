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

const MATCH_SYSTEM = `You are a job-match analyst. Compare a candidate's resume against a job posting and score the fit.
Return ONLY a valid JSON object matching this exact schema — no markdown, no explanation:

{
  "match_score": 0-100,
  "matched_keywords": ["skills/terms present in BOTH resume and job"],
  "missing_keywords": ["important skills/terms in the job but NOT in the resume"],
  "strengths": ["2-4 specific reasons the candidate is a strong fit"],
  "gaps": ["2-4 specific gaps or concerns"],
  "explanation": "2-3 sentence plain-English summary of the match",
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
- Be honest and specific. Missing keywords should be genuinely important to the role.`;

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
