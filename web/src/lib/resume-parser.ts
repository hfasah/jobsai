import { getAIClient } from "@/lib/ai-client";
import { getModel, logModelUsage, resumeParseProvider } from "@/lib/ai-models";
import type { ParsedJson } from "@/types/resume";

// Client follows the parse provider (RESUME_PARSE_PROVIDER) so parsing can run
// on DeepSeek etc. independently of the rest of the app.
const getParseClient = () => getAIClient(resumeParseProvider());

const SYSTEM_PROMPT = `You are a resume parser. Extract structured data from the resume text provided.
Return ONLY a valid JSON object matching this exact schema — no markdown, no explanation:

{
  "name": "string",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "headline": "string or null",
  "summary": "string or null",
  "links": { "linkedin": "url", "github": "url", "portfolio": "url" },
  "years_experience": number or null,
  "experience": [
    {
      "title": "string",
      "company": "string",
      "employment_type": "full-time|part-time|contract|internship|freelance or null",
      "location": "string or null",
      "start_date": "YYYY-MM or null",
      "end_date": "YYYY-MM or null",
      "is_current": boolean,
      "description": "string or null"
    }
  ],
  "education": [
    {
      "school": "string",
      "degree": "string or null",
      "field_of_study": "string or null",
      "start_date": "YYYY-MM or null",
      "end_date": "YYYY-MM or null",
      "grade": "string or null",
      "description": "string or null"
    }
  ],
  "skills": [
    { "skill": "string", "category": "technical|soft|language|tool|framework|other", "confidence": 0-100 }
  ],
  "certifications": ["string"],
  "languages": ["string"],
  "confidence": {
    "contact": 0-1,
    "experience": 0-1,
    "education": 0-1,
    "skills": 0-1
  },
  "warnings": ["string"]
}

Rules:
- Normalize dates to YYYY-MM format; use null if unknown
- Set is_current=true if the role has no end date and appears to be ongoing
- Estimate years_experience from work history if not stated
- If a section is missing entirely, return an empty array [] or null
- Add warnings for: missing contact info, image-only content, unreadable sections`;

export async function parseResumeText(text: string): Promise<ParsedJson> {
  // Truncate to ~12k tokens worth of chars to stay within context limits
  const truncated = text.slice(0, 48000);

  const model = getModel("resumeParse");
  logModelUsage("resumeParse");

  const response = await getParseClient().chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: truncated },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  }, { timeout: 30 * 1000 }); // 30s timeout (was set on the client)

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  return JSON.parse(content) as ParsedJson;
}
