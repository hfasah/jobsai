export type UploadStatus = "uploaded" | "virus_scanned" | "quarantined" | "failed";
export type ParseStatus = "pending" | "extracting_text" | "parsed" | "partial" | "failed";

export interface ResumeDocument {
  id: string;
  user_id: string;
  label: string;
  active_version_id: string | null;
  is_primary: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  active_version?: ResumeVersion;
}

export interface ResumeVersion {
  id: string;
  document_id: string;
  version_number: number;
  storage_key: string;
  file_name: string;
  file_ext: string;
  file_mime: string;
  file_size_bytes: number;
  checksum_sha256: string;
  upload_status: UploadStatus;
  parse_status: ParseStatus;
  parse_error_code: string | null;
  parse_error_msg: string | null;
  language: string | null;
  ocr_used: boolean;
  pages_count: number | null;
  text_char_count: number | null;
  uploaded_at: string;
  processed_at: string | null;
  deleted_at: string | null;
  parsed_profile?: ParsedProfile;
  experiences?: ResumeExperience[];
  educations?: ResumeEducation[];
  skills?: ResumeSkill[];
}

export interface ParsedProfile {
  version_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  headline: string | null;
  summary: string | null;
  links: Record<string, string>;
  years_experience: number | null;
  parsed_json: ParsedJson;
}

export interface ParsedJson {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  headline?: string;
  summary?: string;
  links?: Record<string, string>;
  years_experience?: number;
  experience?: ParsedExperience[];
  education?: ParsedEducation[];
  skills?: ParsedSkill[];
  certifications?: string[];
  languages?: string[];
  confidence?: Record<string, number>;
  warnings?: string[];
}

export interface ParsedExperience {
  title: string;
  company: string;
  employment_type?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  description?: string;
}

export interface ParsedEducation {
  school: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  grade?: string;
  description?: string;
}

export interface ParsedSkill {
  skill: string;
  category?: string;
  confidence?: number;
}

export interface ResumeExperience {
  id: string;
  version_id: string;
  idx: number;
  title: string | null;
  company: string | null;
  employment_type: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
}

export interface ResumeEducation {
  id: string;
  version_id: string;
  idx: number;
  school: string | null;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  grade: string | null;
  description: string | null;
}

export interface ResumeSkill {
  id: string;
  version_id: string;
  skill: string;
  category: string | null;
  confidence: number | null;
}

export interface UploadResumeResponse {
  resume_version_id: string;
  resume_document_id: string;
  status: ParseStatus;
}
