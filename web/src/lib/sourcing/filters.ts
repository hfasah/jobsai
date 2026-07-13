// Server-side validation/normalization of SourcingFilters. The whitelist here
// is a compliance control, not just hygiene: anything outside the known keys
// (including any sensitive-trait criterion an LLM or client might smuggle in)
// is silently dropped before a provider ever sees it.
import { dedupeStrings } from "./normalize";
import { COMPANY_SIZE_VALUES, SENIORITY_VALUES, JOB_FUNCTION_VALUES } from "./types";
import type { FilterOperator, SourcingFilters, SourcingLocation } from "./types";

// Enum-whitelist a list against a set of allowed values (lowercased).
function enumList(v: unknown, allowed: string[]): string[] {
  if (!Array.isArray(v)) return [];
  const set = new Set(allowed);
  return [...new Set(v.filter((x): x is string => typeof x === "string").map((s) => s.trim().toLowerCase()).filter((s) => set.has(s)))];
}

const OPERATORS: FilterOperator[] = ["is_any_of", "is_all_of", "is_not_any_of", "contains"];
const MAX_LIST = 25;
const MAX_TERM_LEN = 80;

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return dedupeStrings(
    v.filter((x): x is string => typeof x === "string").map((s) => s.slice(0, MAX_TERM_LEN)),
  ).slice(0, MAX_LIST);
}

function locList(v: unknown): SourcingLocation[] {
  if (!Array.isArray(v)) return [];
  const out: SourcingLocation[] = [];
  for (const item of v.slice(0, MAX_LIST)) {
    if (typeof item === "string" && item.trim()) {
      out.push({ country: item.trim().slice(0, MAX_TERM_LEN) });
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const country = typeof o.country === "string" ? o.country.trim().slice(0, MAX_TERM_LEN) : "";
      const locality = typeof o.locality === "string" ? o.locality.trim().slice(0, MAX_TERM_LEN) : null;
      if (country) out.push({ country, locality: locality || null });
    }
  }
  return out;
}

function years(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 60) return null;
  return Math.round(n);
}

export function emptyFilters(): SourcingFilters {
  return {
    titles: [],
    title_operator: "is_any_of",
    titles_exclude: [],
    skills_any: [],
    skills_all: [],
    skills_exclude: [],
    locations: [],
    locations_exclude: [],
    experience_years_min: null,
    experience_years_max: null,
    industries: [],
    industries_exclude: [],
    companies_include: [],
    companies_exclude: [],
    company_sizes: [],
    seniority: [],
    job_functions: [],
    education_levels: [],
    schools: [],
    languages: [],
    contact_required: { email: false, phone: false },
    include_unknown: { experience: true, location: false },
    keywords: [],
  };
}

// Accepts anything (client payload, LLM output) and returns a safe, complete
// SourcingFilters. Unknown keys never survive.
export function sanitizeFilters(input: unknown): SourcingFilters {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const f = emptyFilters();

  f.titles = strList(raw.titles);
  f.title_operator = OPERATORS.includes(raw.title_operator as FilterOperator)
    ? (raw.title_operator as FilterOperator)
    : "is_any_of";
  f.titles_exclude = strList(raw.titles_exclude);
  f.skills_any = strList(raw.skills_any);
  f.skills_all = strList(raw.skills_all);
  f.skills_exclude = strList(raw.skills_exclude);
  f.locations = locList(raw.locations);
  f.locations_exclude = locList(raw.locations_exclude);
  f.experience_years_min = years(raw.experience_years_min);
  f.experience_years_max = years(raw.experience_years_max);
  if (
    f.experience_years_min !== null &&
    f.experience_years_max !== null &&
    f.experience_years_max < f.experience_years_min
  ) {
    f.experience_years_max = null;
  }
  f.industries = strList(raw.industries);
  f.industries_exclude = strList(raw.industries_exclude);
  f.companies_include = strList(raw.companies_include);
  f.companies_exclude = strList(raw.companies_exclude);
  // Only accept known headcount buckets (drops anything an LLM/client invents).
  f.company_sizes = strList(raw.company_sizes).filter((s) => COMPANY_SIZE_VALUES.includes(s));
  f.seniority = enumList(raw.seniority, SENIORITY_VALUES);
  f.job_functions = enumList(raw.job_functions, JOB_FUNCTION_VALUES);
  f.education_levels = strList(raw.education_levels);
  f.schools = strList(raw.schools);
  f.languages = strList(raw.languages);

  const cr = (raw.contact_required ?? {}) as Record<string, unknown>;
  f.contact_required = { email: cr.email === true, phone: cr.phone === true };
  const iu = (raw.include_unknown ?? {}) as Record<string, unknown>;
  f.include_unknown = {
    experience: iu.experience !== false,
    location: iu.location === true,
  };
  f.keywords = strList(raw.keywords);

  return f;
}

// A search with no positive criteria would page through the provider's entire
// dataset — refuse it.
export function hasSearchableCriteria(f: SourcingFilters): boolean {
  return (
    f.titles.length > 0 ||
    f.skills_any.length > 0 ||
    f.skills_all.length > 0 ||
    f.locations.length > 0 ||
    f.industries.length > 0 ||
    f.companies_include.length > 0 ||
    f.keywords.length > 0
  );
}
