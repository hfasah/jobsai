import type { AIRecommendation } from "@/types/enterprise";

export type OnboardingStatus = "not_started" | "in_progress" | "cleared" | "on_hold" | "completed";
export type ReferenceStatus = "pending" | "sent" | "completed" | "declined";
export type BgCheckStatus = "pending" | "in_progress" | "clear" | "flagged" | "failed" | "na";
export type BgCheckType =
  | "identity" | "right_to_work" | "criminal" | "employment"
  | "education" | "credit" | "license" | "drug" | "reference";

export interface OnboardingRecord {
  id: string;
  application_id: string;
  org_id: string;
  job_id: string;
  start_date: string | null;
  status: OnboardingStatus;
  offer_accepted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReferenceCheck {
  id: string;
  application_id: string;
  referee_name: string;
  referee_email: string | null;
  referee_phone: string | null;
  relationship: string | null;
  company: string | null;
  token: string;
  status: ReferenceStatus;
  questions: { id: string; question: string }[];
  responses: { question: string; answer: string }[];
  ai_summary: string | null;
  ai_sentiment: "positive" | "mixed" | "negative" | null;
  ai_recommendation: AIRecommendation | null;
  sent_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface BackgroundCheck {
  id: string;
  application_id: string;
  check_type: BgCheckType;
  label: string;
  status: BgCheckStatus;
  provider: string | null;
  reference_id: string | null;
  notes: string | null;
  result_summary: string | null;
  completed_at: string | null;
  created_at: string;
}

export const ONBOARDING_STATUS_META: Record<OnboardingStatus, { label: string; color: string }> = {
  not_started: { label: "Not started", color: "bg-muted text-muted-foreground border-border" },
  in_progress: { label: "In progress", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  cleared:     { label: "Cleared to start", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  on_hold:     { label: "On hold", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  completed:   { label: "Completed", color: "bg-green-500/15 text-green-400 border-green-500/30" },
};

export const BG_STATUS_META: Record<BgCheckStatus, { label: string; color: string }> = {
  pending:     { label: "Pending",     color: "bg-muted text-muted-foreground border-border" },
  in_progress: { label: "In progress", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  clear:       { label: "Clear",       color: "bg-green-500/15 text-green-400 border-green-500/30" },
  flagged:     { label: "Flagged",     color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  failed:      { label: "Failed",      color: "bg-red-500/15 text-red-400 border-red-500/30" },
  na:          { label: "N/A",         color: "bg-muted text-muted-foreground border-border" },
};

export const REFERENCE_STATUS_META: Record<ReferenceStatus, { label: string; color: string }> = {
  pending:   { label: "Not sent",  color: "bg-muted text-muted-foreground border-border" },
  sent:      { label: "Awaiting",  color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  completed: { label: "Completed", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  declined:  { label: "Declined",  color: "bg-red-500/15 text-red-400 border-red-500/30" },
};

// Standard background-check set HR can instantiate with one click
export const STANDARD_CHECKS: { type: BgCheckType; label: string }[] = [
  { type: "identity",      label: "Identity verification" },
  { type: "right_to_work", label: "Right to work / work authorization" },
  { type: "employment",    label: "Employment history verification" },
  { type: "education",     label: "Education verification" },
  { type: "criminal",      label: "Criminal record check" },
];

// Optional role-dependent checks
export const OPTIONAL_CHECKS: { type: BgCheckType; label: string }[] = [
  { type: "credit",  label: "Credit check (finance roles)" },
  { type: "license", label: "Professional license verification" },
  { type: "drug",    label: "Drug screening" },
];
