export interface ApplyProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  website_url: string | null;
  city: string | null;
  country: string | null;
  authorized_to_work: boolean;
  requires_sponsorship: boolean;
  created_at: string;
  updated_at: string;
}

export type ApplyProfileUpdate = Omit<ApplyProfile, "id" | "user_id" | "created_at" | "updated_at">;

export type ApplyPlatform = "lever" | "greenhouse" | "ashby" | "unknown";

export type ApplyStatus = "pending" | "submitted" | "failed" | "manual_required";

export interface ApplyAttempt {
  id: string;
  user_id: string;
  job_id: string;
  platform: ApplyPlatform;
  status: ApplyStatus;
  submitted_at: string | null;
  error_msg: string | null;
  response_data: Record<string, unknown>;
  created_at: string;
}

export interface ApplyResult {
  status: ApplyStatus;
  platform: ApplyPlatform;
  attempt_id: string;
  message?: string;
}
