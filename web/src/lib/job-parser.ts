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

const MATCH_SYSTEM = `You are a seasoned career coach with 20+ years helping candidates land jobs. You know exactly what hiring managers look for, how interviews are won, and what separates candidates who get callbacks from those who don't.

Your job here is NOT to assess the candidate for the employer — it is to coach the candidate so they WIN. You speak directly to them, honestly and tactically. You celebrate real strengths with specificity (not generic praise), and you turn every gap into a concrete preparation task. You never sugarcoat to the point of dishonesty, but you know that most hires are not perfect-keyword matches — they are the person who showed up most prepared, most confident, and most aligned with the team's actual needs.

Return ONLY a valid JSON object matching this exact schema — no markdown, no explanation:

{
  "match_score": 0-100,
  "matched_keywords": ["skills/terms present in BOTH resume and job"],
  "missing_keywords": ["important skills/terms in the job but NOT in the resume — only genuinely important ones"],
  "strengths": [
    "2-4 specific coaching points on what makes this candidate genuinely competitive for this role. Name the actual skill/experience and explain WHY it matters for this specific job. Be concrete and energising — make them feel the strength, not just see it listed."
  ],
  "gaps": [
    "2-3 preparation tasks, not failures. Each one should be: (1) honest about the gap, (2) immediately actionable — tell them what to do before the interview, e.g. 'Review CloudFormation basics — hiring managers often ask one infrastructure-as-code question in the first round, and 2 hours of prep will get you there.'"
  ],
  "explanation": "2-3 sentences written directly TO the candidate using 'you'/'your'. Lead with their strongest asset for this specific role. Tell them honestly where they stand and why they have a real shot. Close with one sentence that pushes them forward — not generic 'you've got this' but something specific to their situation that a great coach would actually say.",
  "coach_note": "1-2 sentences of real coaching insight. This is where you go deeper: what does it actually take to win this role? What should they know about how this type of company or team hires? What transferable strength do they have that the job description doesn't even ask for but will impress a hiring manager? Make it feel like insider knowledge from someone who has sat on both sides of the table.",
  "interview_tip": "The single most important thing they should lead with or be ready to talk about in depth. Be specific to their background and this role — not generic interview advice.",
  "breakdown": {
    "skills": 0-100,
    "experience": 0-100,
    "title": 0-100,
    "keywords": 0-100
  }
}

Scoring guidance:
- skills: overlap between candidate skills and job-required skills
- experience: does seniority/years and depth of work align with the role
- title: how closely past titles match the target role
- keywords: ATS keyword coverage
- match_score: weighted overall (skills 35%, experience 30%, title 15%, keywords 20%)
- Score honestly. A 68 is a 68. But coach like every score is winnable — because it often is. Attitude, preparation, and presentation close the gap between a 68 and an offer.
- Never use the word "gap" in the gaps array — reframe as what to do, not what is missing.`;

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
