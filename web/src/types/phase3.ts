// ─── ATS Scan ────────────────────────────────────────────────────────────────
export interface AtsScan {
  id: string;
  user_id: string;
  job_id: string;
  resume_version_id: string;
  score: number;
  breakdown: AtsBreakdown;
  weaknesses: AtsWeakness[];
  formatting_issues: AtsFormattingIssue[];
  buzzwords: AtsBuzzword[];
  keyword_coverage: AtsKeywordCoverage;
  fixes: AtsFix[];
  ats_risks: string[];
  created_at: string;
}

export interface AtsBreakdown {
  keyword_alignment?: number;   // /40
  experience_relevance?: number; // /25
  formatting?: number;          // /20
  readability?: number;         // /10
  buzzwords_penalty?: number;   // -5..0
}

export interface AtsWeakness {
  section: string;
  issue: string;
  severity: "low" | "medium" | "high";
}
export interface AtsFormattingIssue {
  type: string;
  detail: string;
}
export interface AtsBuzzword {
  phrase: string;
  suggestion: string;
}
export interface AtsKeywordCoverage {
  required?: string[];
  missing?: string[];
  matched?: string[];
}
export interface AtsFix {
  section: string;
  suggestion: string;
  severity: "low" | "medium" | "high";
}

// ─── Tailored Resume ─────────────────────────────────────────────────────────
export interface TailoredResume {
  id: string;
  user_id: string;
  job_id: string;
  source_resume_version_id: string;
  headline: string | null;
  summary: string | null;
  tailored_json: TailoredJson;
  changes: TailorChange[];
  keywords_added: string[];
  created_at: string;
  updated_at: string;
}

export interface TailoredJson {
  headline?: string;
  summary?: string;
  experience?: {
    title: string;
    company: string;
    start_date?: string | null;
    end_date?: string | null;
    is_current?: boolean;
    bullets: string[];
  }[];
  skills?: string[];
}

export interface TailorChange {
  section: string;
  before: string;
  after: string;
  reason: string;
}

// ─── Interview Prep ──────────────────────────────────────────────────────────
export type InterviewCategory = "behavioral" | "technical" | "role" | "culture";

export interface InterviewQuestion {
  id: string;
  category: InterviewCategory;
  question: string;
  why_asked: string;
  talking_points: string[];
  sample_answer: string;
}

export interface InterviewPrep {
  id: string;
  user_id: string;
  job_id: string;
  resume_version_id: string;
  questions: InterviewQuestion[];
  created_at: string;
  updated_at: string;
}

// ─── Cover Letter ────────────────────────────────────────────────────────────
export type CoverTone = "professional" | "enthusiastic" | "confident" | "warm" | "concise";
export type CoverLength = "short" | "medium" | "long";

export interface CoverLetter {
  id: string;
  user_id: string;
  job_id: string;
  resume_version_id: string;
  tone: CoverTone;
  length: CoverLength;
  body: string;
  created_at: string;
  updated_at: string;
}
