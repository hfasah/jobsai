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
  // Role & experience
  employment_status: string | null;
  target_experience_level: string | null;
  industry: string | null;
  willing_to_relocate: boolean;
  available_from: string | null;
  // Personal / address
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  date_of_birth: string | null;
  // Eligibility
  work_auth_us: string | null;
  work_auth_canada: string | null;
  security_clearance: string | null;
  has_drivers_license: boolean;
  // Education & certifications
  highest_education: string | null;
  university: string | null;
  certifications: string[];
  // Voluntary self-identification (EEO)
  race_ethnicity: string | null;
  nationality: string | null;
  gender_identity: string | null;
  sexual_orientation: string | null;
  transgender: string | null;
  disability_status: string | null;
  veteran_status: string | null;
  // Application behaviour
  cc_email: string | null;
  application_mode: string | null;
  created_at: string;
  updated_at: string;
}

export type ApplyProfileUpdate = Omit<ApplyProfile, "id" | "user_id" | "created_at" | "updated_at">;

export type ApplyPlatform =
  | "lever"
  | "greenhouse"
  | "ashby"
  | "workday"
  | "smartrecruiters"
  | "bamboohr"
  | "icims"
  | "unknown";

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
