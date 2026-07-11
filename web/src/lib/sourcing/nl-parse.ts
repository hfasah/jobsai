// Natural language -> SourcingFilters. One fast-tier call, json_object output,
// then a hard pass through sanitizeFilters so nothing the model invents (or a
// user smuggles) reaches a provider. SERVER-ONLY.
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { recordUsage } from "@/lib/llm-usage";
import { sanitizeFilters } from "./filters";
import type { SourcingFilters } from "./types";

const SYSTEM_PROMPT = `You convert a recruiter's plain-English talent search into structured filters.

Return ONLY a JSON object with these keys (omit none; use [] / null / false when absent):
{
  "titles": ["job titles to match"],
  "title_operator": "is_any_of",
  "titles_exclude": [],
  "skills_any": ["skills where any match counts"],
  "skills_all": ["skills that are explicitly ALL required"],
  "skills_exclude": [],
  "locations": [{"country": "canada", "locality": "toronto"}],
  "locations_exclude": [],
  "experience_years_min": null,
  "experience_years_max": null,
  "industries": [],
  "industries_exclude": [],
  "companies_include": ["current/previous employers to require"],
  "companies_exclude": [],
  "education_levels": [],
  "schools": [],
  "languages": [],
  "contact_required": {"email": false, "phone": false},
  "include_unknown": {"experience": true, "location": false},
  "keywords": ["fallback free-text terms if nothing structured fits"],
  "dropped_criteria": ["criteria you refused, with a short reason"]
}

Rules:
- Expand common synonyms into titles/skills (e.g. "K8s" -> "Kubernetes"; "SRE" adds "Site Reliability Engineer").
- Seniority words ("senior", "lead") belong inside titles, and may set experience_years_min (senior ~5, lead/staff ~7) only when the query implies it.
- Countries/cities in lowercase English names.
- NEVER filter or infer race, ethnicity, religion, gender, age (beyond years of professional experience), disability, health, sexual orientation, political views, or any other protected trait. If asked, put the request in dropped_criteria and continue without it.
- Do not invent criteria the recruiter didn't state.`;

export interface ParsedQuery {
  filters: SourcingFilters;
  dropped_criteria: string[];
}

export async function parseQueryToFilters(
  query: string,
  ctx: { orgId: string; userId: string },
): Promise<ParsedQuery> {
  const client = getAIClient(AI_TIERS.fast.provider);
  const completion = await client.chat.completions.create({
    model: AI_TIERS.fast.model,
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 700,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: query.slice(0, 1000) },
    ],
  });
  recordUsage({
    orgId: ctx.orgId,
    userId: ctx.userId,
    feature: "sourcing_ai_parse",
    model: AI_TIERS.fast.model,
    usage: completion.usage,
  });

  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
  } catch {
    raw = {};
  }
  const dropped = Array.isArray(raw.dropped_criteria)
    ? raw.dropped_criteria.filter((d): d is string => typeof d === "string").slice(0, 10)
    : [];
  return { filters: sanitizeFilters(raw), dropped_criteria: dropped };
}
