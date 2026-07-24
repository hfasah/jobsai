export type LocationType = "remote" | "hybrid" | "onsite" | "any";
export type EmploymentType = "full-time" | "part-time" | "contract" | "internship";
export type SeniorityLevel = "entry" | "mid" | "senior" | "lead" | "principal";

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  remote:  "Remote",
  hybrid:  "Hybrid",
  onsite:  "On-site",
  any:     "Any",
};

export const EMPLOYMENT_TYPE_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: "full-time",   label: "Full-time" },
  { value: "part-time",   label: "Part-time" },
  { value: "contract",    label: "Contract" },
  { value: "internship",  label: "Internship" },
];

export const SENIORITY_OPTIONS: { value: SeniorityLevel; label: string }[] = [
  { value: "entry",     label: "Entry level" },
  { value: "mid",       label: "Mid level" },
  { value: "senior",    label: "Senior" },
  { value: "lead",      label: "Lead" },
  { value: "principal", label: "Principal / Staff" },
];

export const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "CAD", "AUD", "SGD", "INR"];

export interface UserPreferences {
  id: string;
  user_id: string;
  job_titles: string[];
  primary_title: string | null;
  keywords: string[];
  location_type: LocationType;
  locations: string[];
  min_salary: number | null;
  salary_currency: string;
  employment_types: EmploymentType[];
  seniority_levels: SeniorityLevel[];
  excluded_companies: string[];
  blocked_domains: string[];
  auto_apply_enabled: boolean;
  auto_apply_mode: "auto" | "hybrid" | "review";
  auto_apply_threshold: number;
  require_approval: boolean;
  // Inbox: also CC the user (or another address) on application/inbox emails.
  cc_email_enabled: boolean;
  cc_email: string | null;
  // Lifecycle/alert emails (daily job-discovery summary). Opt-out, default true.
  alert_emails_enabled: boolean;
  last_discovery_at: string | null;
  last_discovery_count: number;
  created_at: string;
  updated_at: string;
}

export type PreferencesUpdate = Omit<UserPreferences, "id" | "user_id" | "created_at" | "updated_at">;

export const DEFAULT_PREFERENCES: PreferencesUpdate = {
  job_titles: [],
  primary_title: null,
  keywords: [],
  location_type: "any",
  locations: [],
  min_salary: null,
  salary_currency: "USD",
  employment_types: [],
  seniority_levels: [],
  excluded_companies: [],
  blocked_domains: [],
  auto_apply_enabled: false,
  auto_apply_mode: "hybrid" as const,
  auto_apply_threshold: 60,
  require_approval: false,
  cc_email_enabled: false,
  cc_email: null,
  alert_emails_enabled: true,
  last_discovery_at: null,
  last_discovery_count: 0,
};
