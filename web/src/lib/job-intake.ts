import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import { recordUsage } from "@/lib/llm-usage";

// Shared job-intake helpers: AI-parse a job description (from pasted text, an
// uploaded PDF/Word file, or an inbound email) into structured fields, and
// create a draft enterprise_job from them. Used by the /jobs/parse route and the
// inbound email webhook.

let _ai: OpenAI | null = null;
const ai = () => (_ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

export const JOB_DEPARTMENTS = ["Engineering", "Product", "Design", "Marketing", "Sales", "Operations", "Finance", "HR", "Legal", "Customer Success", "Other"];
export const JOB_EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "internship"];

export interface ParsedJob {
  title?: string;
  department?: string;
  employment_type?: string;
  location?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  description?: string;
  responsibilities?: string;
  qualifications?: string;
  nice_to_have?: string;
}

export async function parseJobFromText(
  text: string, ctx?: { orgId?: string; userId?: string },
): Promise<ParsedJob> {
  const prompt = `Extract structured fields from this job posting or hiring-manager request. Use ONLY information present in the text — leave a field as "" or null if it isn't stated; do NOT invent details.

Return ONLY JSON with exactly these keys:
{
  "title": "string",
  "department": "one of: ${JOB_DEPARTMENTS.join(", ")} — or empty",
  "employment_type": "one of: ${JOB_EMPLOYMENT_TYPES.join(", ")}",
  "location": "string",
  "salary_min": number or null,
  "salary_max": number or null,
  "description": "2-3 paragraph overview of the role",
  "responsibilities": "key responsibilities, one per line starting with •",
  "qualifications": "required qualifications, one per line starting with •",
  "nice_to_have": "nice-to-have items, one per line starting with • — or empty"
}

Job text:
"""
${text.slice(0, 12000)}
"""`;

  const completion = await ai().chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1400,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  if (ctx?.orgId) {
    recordUsage({ orgId: ctx.orgId, userId: ctx.userId ?? "system", feature: "job_parse", model: "gpt-4o-mini", usage: completion.usage });
  }
  return JSON.parse(completion.choices[0]?.message?.content ?? "{}") as ParsedJob;
}

// Insert a DRAFT job from parsed fields. Returns the new job id, or null if the
// parse produced no usable title (so we don't create empty jobs from spam).
export async function createDraftJobFromParsed(
  orgId: string, parsed: ParsedJob, createdBy: string,
): Promise<string | null> {
  const title = (parsed.title ?? "").trim();
  if (!title) return null;
  const { data, error } = await supabaseAdmin
    .from("enterprise_jobs")
    .insert({
      org_id: orgId,
      title,
      department: JOB_DEPARTMENTS.includes(parsed.department ?? "") ? parsed.department : null,
      location: parsed.location?.trim() || null,
      employment_type: JOB_EMPLOYMENT_TYPES.includes(parsed.employment_type ?? "") ? parsed.employment_type : "full-time",
      description: parsed.description?.trim() || null,
      responsibilities: parsed.responsibilities?.trim() || null,
      qualifications: parsed.qualifications?.trim() || null,
      nice_to_have: parsed.nice_to_have?.trim() || null,
      salary_min: parsed.salary_min ?? null,
      salary_max: parsed.salary_max ?? null,
      status: "draft",
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[job-intake] draft job insert failed:", error.message);
    return null;
  }
  return data.id;
}
