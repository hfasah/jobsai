import type { AIRecommendation } from "@/types/enterprise";

export type RoleType =
  | "technical" | "sales" | "customer_service"
  | "management" | "healthcare" | "administrative" | "general";

export const ROLE_TYPE_LABELS: Record<RoleType, string> = {
  technical:        "Technical Role",
  sales:            "Sales Role",
  customer_service: "Customer Service Role",
  management:       "Management Role",
  healthcare:       "Healthcare Role",
  administrative:   "Administrative Role",
  general:          "General Role",
};

export const ROLE_TYPE_COLORS: Record<RoleType, string> = {
  technical:        "bg-blue-500/15 text-blue-400 border-blue-500/30",
  sales:            "bg-amber-500/15 text-amber-400 border-amber-500/30",
  customer_service: "bg-green-500/15 text-green-400 border-green-500/30",
  management:       "bg-purple-500/15 text-purple-400 border-purple-500/30",
  healthcare:       "bg-rose-500/15 text-rose-400 border-rose-500/30",
  administrative:   "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  general:          "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export interface Competency {
  name: string;
  weight: number;          // percentage, all competencies sum to 100
  description: string;
  what_to_look_for: string;
}

export interface CompetencyFramework {
  id: string;
  job_id: string;
  org_id: string;
  role_type: RoleType | null;
  role_type_label: string | null;
  competencies: Competency[];
  company_values: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompetencyScore {
  name: string;
  weight: number;
  score: number;           // 0-100 for this competency
  evidence: string;        // quote / paraphrase from transcript
}

export type ReportType = "pre_interview" | "post_interview";

export interface InterviewReport {
  id: string;
  application_id: string;
  job_id: string;
  org_id: string;
  report_type: ReportType;
  round_name: string | null;
  transcript: string | null;
  overall_score: number | null;
  competency_scores: CompetencyScore[];
  strengths: string[];
  concerns: string[];
  recommendation: AIRecommendation | null;
  summary: string | null;
  generated_by: string | null;
  generated_at: string;
}

export const RECOMMENDATION_META: Record<AIRecommendation, { label: string; color: string }> = {
  strong_yes: { label: "Strong Yes", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  yes:        { label: "Yes",        color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  maybe:      { label: "Maybe",      color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  no:         { label: "No",         color: "bg-red-500/20 text-red-400 border-red-500/30" },
};
