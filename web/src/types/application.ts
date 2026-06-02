export type ApplicationStage =
  | "saved"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected";

export const APPLICATION_STAGES: ApplicationStage[] = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
];

export const STAGE_LABELS: Record<ApplicationStage, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};

export interface StageHistoryEntry {
  stage: ApplicationStage;
  at: string;
}

// Lightweight job summary joined onto an application card
export interface ApplicationJobSummary {
  id: string;
  title: string | null;
  company: string | null;
  location: string | null;
  match_score: number | null;
}

export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  stage: ApplicationStage;
  notes: string | null;
  applied_at: string | null;
  next_action: string | null;
  next_action_date: string | null;
  position: number;
  stage_history: StageHistoryEntry[];
  created_at: string;
  updated_at: string;
  job?: ApplicationJobSummary;
}

export interface CreateApplicationBody {
  job_id: string;
  stage?: ApplicationStage;
}

export interface UpdateApplicationBody {
  stage?: ApplicationStage;
  notes?: string | null;
  next_action?: string | null;
  next_action_date?: string | null;
  position?: number;
}
