-- Phase 51: Hiring Manager Workspace
-- Adds hiring_manager_id to jobs, assigned_to + HM decision fields to applications

alter table enterprise_jobs
  add column if not exists hiring_manager_id text;   -- Clerk user_id

alter table enterprise_applications
  add column if not exists assigned_to        text,  -- Clerk user_id (recruiter assigned)
  add column if not exists hm_decision        text,  -- approved|rejected|more_info
  add column if not exists hm_decision_at     timestamptz,
  add column if not exists hm_notes           text;

create index if not exists enterprise_jobs_hm_idx  on enterprise_jobs(hiring_manager_id);
create index if not exists enterprise_apps_hm_idx  on enterprise_applications(assigned_to);
