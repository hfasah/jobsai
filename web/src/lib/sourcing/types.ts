// TalentSource shared types. Client-safe: no server-only imports here.

export type SourcingMode = "external" | "internal" | "combined";

export type FilterOperator = "is_any_of" | "is_all_of" | "is_not_any_of" | "contains";

export interface SourcingLocation {
  country: string;
  locality?: string | null;
}

// The structured filter object produced by NL parsing and edited by the
// recruiter. Validated server-side by filters.ts before every search —
// unknown keys are dropped (this whitelist doubles as the compliance guard
// against sensitive-trait filtering).
export interface SourcingFilters {
  titles: string[];
  title_operator: FilterOperator;
  titles_exclude: string[];
  skills_any: string[];
  skills_all: string[];
  skills_exclude: string[];
  locations: SourcingLocation[];
  locations_exclude: SourcingLocation[];
  experience_years_min: number | null;
  experience_years_max: number | null;
  industries: string[];
  industries_exclude: string[];
  companies_include: string[];
  companies_exclude: string[];
  company_sizes: string[]; // headcount buckets (PDL job_company_size values)
  education_levels: string[];
  schools: string[];
  languages: string[];
  contact_required: { email: boolean; phone: boolean };
  include_unknown: { experience: boolean; location: boolean };
  keywords: string[];
}

// Normalized external candidate — shaped to insert straight into
// sourcing_external_candidates (minus org_id, added by the caller).
export interface ExternalCandidate {
  provider_key: string;
  provider_record_id: string;
  source_type: string;
  permitted_use: string | null;
  confidence: number | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  company: string | null;
  company_size?: string | null; // headcount bucket, when the provider reports it
  location_country: string | null;
  location_locality: string | null;
  skills: string[];
  experience_years: number | null;
  industries: string[];
  education: { school?: string; degree?: string; field?: string; end_year?: number }[];
  languages: string[];
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  has_email: boolean | null;
  has_phone: boolean | null;
  raw?: Record<string, unknown> | null;
}

export interface ProviderSearchResult {
  candidates: ExternalCandidate[];
  total: number | null; // provider-reported total matches (for estimates), null if unknown
  error?: string;
}

export interface RevealResult {
  found: boolean;
  value: string | null;
  extra?: string[]; // additional emails/phones beyond the primary
  confidence?: number | null;
  // full enrich payload when the reveal came from an enrich call — cached on
  // the candidate row so subsequent reveals don't re-bill the provider
  enriched?: ExternalCandidate | null;
  error?: string;
}

export type EmailVerificationStatus = "valid" | "invalid" | "risky" | "unknown";

export interface VerifyResult {
  status: EmailVerificationStatus;
  raw?: unknown;
}

// Scoring
export interface ScoreWeights {
  skills: number;
  title: number;
  experience: number;
  location: number;
  industry: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  skills: 35,
  title: 25,
  experience: 15,
  location: 15,
  industry: 10,
};

export interface ScoreCategory {
  score: number; // 0..weight (already weighted)
  weight: number;
  matched: string[];
  missing: string[];
  note?: string;
}

export interface ScoreBreakdown {
  skills: ScoreCategory;
  title: ScoreCategory;
  experience: ScoreCategory;
  location: ScoreCategory;
  industry: ScoreCategory;
}

// Dedup
export type DedupStatus = "new" | "possible_duplicate" | "existing" | "imported" | "previously_contacted";

export interface DedupMatch {
  type: "application" | "talent_pool" | "import" | "outreach";
  id: string;
  matched_on: "email" | "linkedin" | "name_company";
  label?: string; // e.g. candidate name / job title for the UI
}

export interface DedupVerdict {
  status: DedupStatus;
  matches: DedupMatch[];
}

// Company headcount buckets — canonical values match PDL's job_company_size.
export const COMPANY_SIZES: { value: string; label: string }[] = [
  { value: "1-10", label: "1–10" },
  { value: "11-50", label: "11–50" },
  { value: "51-200", label: "51–200" },
  { value: "201-500", label: "201–500" },
  { value: "501-1000", label: "501–1,000" },
  { value: "1001-5000", label: "1,001–5,000" },
  { value: "5001-10000", label: "5,001–10,000" },
  { value: "10001+", label: "10,001+" },
];
export const COMPANY_SIZE_VALUES = COMPANY_SIZES.map((s) => s.value);

// Credits
export type CreditAction = "search" | "unlock_profile" | "reveal_email" | "reveal_phone" | "enrich";
