// LinkedIn Optimizer — profile optimization + content writeups.

export type LinkedInPostStatus = "draft" | "scheduled" | "posted";

export interface LinkedInExperienceRewrite {
  title: string;
  company: string;
  /** Optimized role summary in LinkedIn first-person voice. */
  rewrite: string;
  /** Achievement-oriented bullets the user can paste under the role. */
  bullets: string[];
}

export interface LinkedInSuggestion {
  /** e.g. "Headline", "About", "Skills", "Featured", "Banner". */
  area: string;
  issue: string;
  action: string;
  severity: "low" | "medium" | "high";
}

/** Shape returned by the AI optimizer. */
export interface LinkedInProfileResult {
  headline: string;
  about: string;
  experience_rewrites: LinkedInExperienceRewrite[];
  skills: string[];
  /** 0-100 strength of the user's current profile (pre-optimization). */
  score: number;
  suggestions: LinkedInSuggestion[];
}

/** Persisted profile row (= result + DB metadata). */
export interface LinkedInProfile extends LinkedInProfileResult {
  id: string;
  user_id: string;
  source_resume_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export type LinkedInPostTone =
  | "professional"
  | "story"
  | "contrarian"
  | "educational"
  | "celebratory";

export type LinkedInPostFormat = "short" | "standard" | "article";

export interface LinkedInPostResult {
  body: string;
  hashtags: string[];
}

export interface LinkedInPost {
  id: string;
  user_id: string;
  topic: string | null;
  tone: string | null;
  format: string | null;
  body: string;
  hashtags: string[];
  status: LinkedInPostStatus;
  scheduled_at: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
}
