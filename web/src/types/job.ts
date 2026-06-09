export type JobStatus = "created" | "processing" | "ready" | "failed";
export type JobSourceType = "text" | "file";

export interface Job {
  id: string;
  user_id: string;
  source_type: JobSourceType;
  status: JobStatus;
  content_hash: string;
  raw_text: string;
  source_url: string | null;
  posting_url: string | null;
  detected_language: string | null;
  parse_error_msg: string | null;
  created_at: string;
  updated_at: string;
  parsed?: JobParsed;
  match?: JobMatch | null;
}

export interface JobParsed {
  job_id: string;
  title: string | null;
  company: string | null;
  location: string | null;
  employment_type: string | null;
  seniority: string | null;
  compensation: string | null;
  posting_url: string | null;
  summary: string | null;
  skills: string[];
  responsibilities: string[];
  requirements: string[];
  parsed_json: ParsedJobJson;
}

export interface ParsedJobJson {
  title?: string;
  company?: string;
  location?: string;
  employment_type?: string;
  seniority?: string;
  compensation?: string;
  posting_url?: string;
  summary?: string;
  skills?: string[];
  responsibilities?: string[];
  requirements?: string[];
  detected_language?: string;
}

export interface JobMatch {
  id: string;
  job_id: string;
  resume_version_id: string;
  match_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  explanation: string | null;
  scored_json: MatchScoreJson;
  created_at: string;
}

export interface MatchScoreJson {
  match_score?: number;
  matched_keywords?: string[];
  missing_keywords?: string[];
  explanation?: string;
  coach_note?: string;
  interview_tip?: string;
  strengths?: string[];
  gaps?: string[];
  breakdown?: {
    skills?: number;
    experience?: number;
    title?: number;
    keywords?: number;
  };
}

export interface ImportJobResponse {
  job_id: string;
  status: JobStatus;
  dedup: boolean;
}
