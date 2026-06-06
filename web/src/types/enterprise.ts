export type OrgSize = "1-10" | "11-50" | "51-200" | "201-500" | "500+";
export type MemberRole = "owner" | "admin" | "recruiter";
export type JobStatus = "draft" | "active" | "paused" | "closed";
export type EmploymentType = "full-time" | "part-time" | "contract" | "internship";
export type AppStage = "applied" | "screened" | "interview" | "offer" | "hired" | "rejected";
export type AIRecommendation = "strong_yes" | "yes" | "maybe" | "no";

export interface EnterpriseOrg {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  industry: string | null;
  size: OrgSize | null;
  website: string | null;
  created_by: string;
  created_at: string;
}

export interface EnterpriseMember {
  id: string;
  org_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
}

export interface EnterpriseJob {
  id: string;
  org_id: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: EmploymentType;
  description: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  nice_to_have: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  status: JobStatus;
  created_by: string;
  created_at: string;
  published_at: string | null;
  closes_at: string | null;
  // computed
  application_count?: number;
}

export interface EnterpriseApplication {
  id: string;
  job_id: string;
  org_id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string | null;
  resume_url: string | null;
  resume_text: string | null;
  cover_letter: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  source: string;
  stage: AppStage;
  match_score: number | null;
  skills_score: number | null;
  experience_score: number | null;
  culture_score: number | null;
  ats_score: number | null;
  ats_keywords_matched: string[];
  ats_keywords_missing: string[];
  ats_summary: string | null;
  risk_flags: string[];
  ai_summary: string | null;
  ai_recommendation: AIRecommendation | null;
  tags: string[];
  notes: string | null;
  duplicate_of: string | null;
  is_duplicate: boolean;
  screened_at: string | null;
  stage_updated_at: string;
  status_email_sent: boolean;
  pool_id: string | null;
  triaged: boolean;
  created_at: string;
}

export interface PoolQuestion {
  id: string;
  type: string;
  question: string;
}

export interface EnterprisePool {
  id: string;
  org_id: string;
  job_id: string | null;
  name: string;
  description: string | null;
  type: "auto_top" | "auto_strong" | "auto_possible" | "auto_low" | "custom";
  color: string;
  criteria: string | null;
  question_set: PoolQuestion[];
  additional_context: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const POOL_COLORS: Record<string, string> = {
  green:  "border-green-500/30 bg-green-500/5 text-green-400",
  cyan:   "border-cyan-500/30 bg-cyan-500/5 text-cyan-400",
  amber:  "border-amber-500/30 bg-amber-500/5 text-amber-400",
  red:    "border-red-500/30 bg-red-500/5 text-red-400",
  purple: "border-purple-500/30 bg-purple-500/5 text-purple-400",
  slate:  "border-border bg-muted/20 text-muted-foreground",
};

export interface GenerateJDInput {
  title: string;
  department?: string;
  location?: string;
  employment_type?: string;
  company_name?: string;
  extra_context?: string;
}

export interface ScreenResult {
  match_score: number;
  skills_score: number;
  experience_score: number;
  culture_score: number;
  risk_flags: string[];
  ai_summary: string;
  ai_recommendation: AIRecommendation;
}

export const STAGES: AppStage[] = ["applied", "screened", "interview", "offer", "hired", "rejected"];

export const STAGE_LABELS: Record<AppStage, string> = {
  applied:   "Applied",
  screened:  "Screened",
  interview: "Interview",
  offer:     "Offer",
  hired:     "Hired",
  rejected:  "Rejected",
};

export const STAGE_COLORS: Record<AppStage, string> = {
  applied:   "bg-blue-500/15 text-blue-400 border-blue-500/30",
  screened:  "bg-purple-500/15 text-purple-400 border-purple-500/30",
  interview: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  offer:     "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  hired:     "bg-green-500/15 text-green-400 border-green-500/30",
  rejected:  "bg-red-500/15 text-red-400 border-red-500/30",
};

// ── ATS score tiers ───────────────────────────────────────────────────────────
export type AtsTier = "top" | "strong" | "possible" | "low" | "unscored";

export interface AtsTierMeta {
  id: AtsTier;
  label: string;
  range: string;
  color: string;        // badge classes
  dot: string;          // dot/bar bg
  min: number;
  max: number;
}

export const ATS_TIERS: AtsTierMeta[] = [
  { id: "top",      label: "Top Match",  range: "85-100", color: "bg-green-500/15 text-green-400 border-green-500/30",  dot: "bg-green-500",  min: 85, max: 100 },
  { id: "strong",   label: "Strong",     range: "70-84",  color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",      dot: "bg-cyan-500",   min: 70, max: 84 },
  { id: "possible", label: "Possible",   range: "50-69",  color: "bg-amber-500/15 text-amber-400 border-amber-500/30",   dot: "bg-amber-500",  min: 50, max: 69 },
  { id: "low",      label: "Low Match",  range: "0-49",   color: "bg-red-500/15 text-red-400 border-red-500/30",         dot: "bg-red-500",    min: 0,  max: 49 },
];

export function atsTier(score: number | null | undefined): AtsTierMeta | null {
  if (score === null || score === undefined) return null;
  return ATS_TIERS.find((t) => score >= t.min && score <= t.max) ?? ATS_TIERS[ATS_TIERS.length - 1];
}
