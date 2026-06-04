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
  // Extended application-passport fields (all optional in the payload).
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  date_of_birth?: string | null;
  work_auth_us?: string | null;
  work_auth_canada?: string | null;
  security_clearance?: string | null;
  has_drivers_license?: boolean;
  highest_education?: string | null;
  university?: string | null;
  certifications?: string[];
  race_ethnicity?: string | null;
  nationality?: string | null;
  gender_identity?: string | null;
  sexual_orientation?: string | null;
  transgender?: string | null;
  disability_status?: string | null;
  veteran_status?: string | null;
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
