export type ApplyPlatform =
  | "lever" | "greenhouse" | "ashby"
  | "workday" | "smartrecruiters" | "bamboohr" | "icims" | "unknown";

export type ApplyStatus = "submitted" | "failed" | "manual_required";

export interface ApplyProfile {
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
}

export interface BrowserApplyRequest {
  platform: ApplyPlatform;
  sourceUrl: string;
  profile: ApplyProfile;
  resumeBase64: string;
  resumeMime: string;
  resumeFilename: string;
  coverLetter: string;
}

export interface BrowserApplyResponse {
  status: ApplyStatus;
  message?: string;
}
