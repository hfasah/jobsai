// Natural language -> SourcingFilters. Primary path is one fast-tier LLM call;
// if the provider is unavailable/misconfigured/slow, we fall back to a
// deterministic heuristic parse so search ALWAYS works (and stays reasonably
// smart) instead of erroring. Output is always run through sanitizeFilters.
// SERVER-ONLY.
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
  "company_sizes": ["headcount buckets; use ONLY these exact values: 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5001-10000, 10001+"],
  "seniority": ["management level; use ONLY these exact values: entry, senior, manager, director, vp, cxo, owner, partner"],
  "job_functions": ["department/function; use ONLY these exact values: legal, health, finance, sales, marketing, human_resources, operations, engineering, product, design, education, research, support, trade, manufacturing, analyst, advisory, public_service"],
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
- Map seniority words to the "seniority" field ("senior"->senior, "lead"/"principal"/"staff"->senior, "manager"->manager, "director"/"head of"->director, "VP"->vp, "C-level"/"CEO"/"CTO"/"chief"->cxo, "founder"/"owner"->owner). Keep the title itself clean (don't also stuff "Senior" into titles). May additionally set experience_years_min when clearly implied (senior ~5, lead/staff ~7).
- Map a stated field/department to "job_functions" (e.g. "legal"->legal, "nursing"/"clinical"->health, "accounting"->finance, "devs"/"software"->engineering) ONLY when the query names a function/department, not just a single specific title.
- Countries/cities in lowercase English names.
- NEVER filter or infer race, ethnicity, religion, gender, age (beyond years of professional experience), disability, health, sexual orientation, political views, or any other protected trait. If asked, put the request in dropped_criteria and continue without it.
- Do not invent criteria the recruiter didn't state.`;

export interface ParsedQuery {
  filters: SourcingFilters;
  dropped_criteria: string[];
  degraded?: boolean; // true when the LLM was unavailable and we used the heuristic
}

// ── Heuristic fallback dictionaries ──────────────────────────────────────────
const COUNTRIES = [
  "united states", "usa", "u.s.", "us", "united kingdom", "u.k.", "uk", "canada",
  "germany", "france", "spain", "italy", "netherlands", "ireland", "portugal",
  "poland", "sweden", "norway", "denmark", "switzerland", "belgium", "austria",
  "cameroon", "nigeria", "kenya", "ghana", "south africa", "egypt", "morocco",
  "india", "pakistan", "bangladesh", "singapore", "philippines", "indonesia",
  "australia", "new zealand", "japan", "china", "brazil", "mexico", "argentina",
  "colombia", "chile", "uae", "united arab emirates", "saudi arabia", "israel", "turkey",
];
const SKILLS = [
  "kubernetes", "k8s", "terraform", "aws", "gcp", "azure", "docker", "helm", "argocd",
  "ansible", "jenkins", "ci/cd", "cicd", "linux", "networking", "react", "next.js",
  "nextjs", "node", "node.js", "nodejs", "typescript", "javascript", "python", "django",
  "flask", "go", "golang", "rust", "java", "spring", "kotlin", "swift", "c++", "c#",
  ".net", "php", "laravel", "ruby", "rails", "graphql", "grpc", "postgres", "postgresql",
  "mysql", "mongodb", "redis", "kafka", "rabbitmq", "spark", "airflow", "snowflake", "dbt",
  "tableau", "power bi", "pytorch", "tensorflow", "mlops", "sagemaker", "salesforce", "hubspot",
];
const SENIORITY_MIN: Record<string, number> = { senior: 5, sr: 5, lead: 7, staff: 7, principal: 8, head: 8, director: 10, vp: 12, chief: 12 };
const STOP_AFTER = /\b(in|with|who|that|based|located|from|at|for|,)\b/i;

function extractLocations(lower: string): { country: string }[] {
  const found: { country: string }[] = [];
  for (const c of COUNTRIES) {
    const re = new RegExp(`(^|[^a-z])${c.replace(/[.+*?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i");
    if (re.test(lower)) found.push({ country: c });
  }
  // Dedup by first token so "us"/"usa"/"united states" don't triple up.
  const seen = new Set<string>();
  return found.filter((l) => {
    const key = l.country.split(" ")[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

function extractSkills(lower: string): string[] {
  const out: string[] = [];
  for (const s of SKILLS) {
    const re = new RegExp(`(^|[^a-z0-9])${s.replace(/[.+*?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i");
    if (re.test(lower)) out.push(s);
  }
  return [...new Set(out)].slice(0, 15);
}

// Deterministic parse used when the LLM is unavailable. Handles the dominant
// "<role> in <place> with <skills>" shape well enough to return real results.
export function heuristicParse(query: string): SourcingFilters {
  const lower = query.toLowerCase().trim();
  const locations = extractLocations(lower);
  const skills = extractSkills(lower);

  // Role phrase = text up to the first structural keyword ("in", "with", …).
  const cut = lower.search(STOP_AFTER);
  let rolePhrase = (cut > 0 ? lower.slice(0, cut) : lower).trim();
  // strip a leading count like "5 " and trailing plural
  rolePhrase = rolePhrase.replace(/^\d+\s+/, "").replace(/s\b/g, (m, i, str) => (i === str.length - 1 ? "" : m));
  const titles = rolePhrase && rolePhrase.length >= 2 ? [rolePhrase] : [];

  // Min years of experience from "5+ years" / "at least 5 years" / seniority word.
  let min: number | null = null;
  const yr = lower.match(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)/);
  if (yr) min = Math.min(40, parseInt(yr[1], 10));
  if (min === null) {
    for (const [word, years] of Object.entries(SENIORITY_MIN)) {
      if (new RegExp(`(^|[^a-z])${word}([^a-z]|$)`, "i").test(lower)) { min = years; break; }
    }
  }

  // Company size from common phrasing.
  const company_sizes: string[] = [];
  if (/\bstart[\s-]?ups?\b|\bearly[\s-]?stage\b/i.test(lower)) company_sizes.push("1-10", "11-50");
  if (/\b(enterprise|large compan|big compan|fortune|multinational)\b/i.test(lower)) company_sizes.push("1001-5000", "5001-10000", "10001+");
  if (/\b(smb|small business|small compan)\b/i.test(lower)) company_sizes.push("1-10", "11-50", "51-200");

  return sanitizeFilters({
    titles,
    skills_any: skills,
    locations,
    company_sizes,
    experience_years_min: min,
    // Keep the raw query as keywords so the provider still has signal even if
    // title/skill extraction was thin.
    keywords: titles.length || skills.length ? [] : lower.split(/\s+/).filter((w) => w.length > 2).slice(0, 8),
  });
}

export async function parseQueryToFilters(
  query: string,
  ctx: { orgId: string; userId: string },
): Promise<ParsedQuery> {
  // Everything from acquiring the client through the API call can throw
  // (missing/invalid key, provider 4xx/5xx, timeout). Any failure degrades to
  // the heuristic parse rather than erroring the whole request.
  try {
    const client = getAIClient(AI_TIERS.fast.provider);
    const completion = await client.chat.completions.create(
      {
        model: AI_TIERS.fast.model,
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 700,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query.slice(0, 1000) },
        ],
      },
      // Fall back to the heuristic well before the platform function timeout,
      // so a slow/hung provider never returns an empty 504 body to the client.
      { timeout: 12000, maxRetries: 1 },
    );
    recordUsage({
      orgId: ctx.orgId,
      userId: ctx.userId,
      feature: "sourcing_ai_parse",
      model: AI_TIERS.fast.model,
      usage: completion.usage,
    });

    const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as Record<string, unknown>;
    const dropped = Array.isArray(raw.dropped_criteria)
      ? raw.dropped_criteria.filter((d): d is string => typeof d === "string").slice(0, 10)
      : [];
    const filters = sanitizeFilters(raw);
    // If the model returned nothing usable, fall back so the search isn't empty.
    const hasCriteria =
      filters.titles.length || filters.skills_any.length || filters.locations.length ||
      filters.industries.length || filters.keywords.length;
    if (!hasCriteria) {
      return { filters: heuristicParse(query), dropped_criteria: dropped, degraded: true };
    }
    return { filters, dropped_criteria: dropped };
  } catch (e) {
    console.error("[sourcing] ai-parse LLM failed, using heuristic", e);
    return { filters: heuristicParse(query), dropped_criteria: [], degraded: true };
  }
}
