-- Enterprise: ATS scoring of candidates against the job description.
-- Distinct from the holistic AI match_score: this measures keyword + format
-- alignment the way a real Applicant Tracking System filter would.

alter table enterprise_applications
  add column if not exists ats_score            int,           -- 0-100
  add column if not exists ats_keywords_matched text[] default '{}',
  add column if not exists ats_keywords_missing text[] default '{}',
  add column if not exists ats_summary          text;

create index if not exists enterprise_apps_ats_idx
  on enterprise_applications (job_id, ats_score desc nulls last);
