-- Phase 5: Interview Prep
-- Run in Supabase SQL editor after 004_applications.sql

-- ─── interview_preps ─────────────────────────────────────────────────────────
create table if not exists interview_preps (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,
  job_id            uuid not null references jobs (id) on delete cascade,
  resume_version_id uuid not null references resume_versions (id) on delete cascade,
  questions         jsonb default '[]',    -- InterviewQuestion[]
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (job_id, resume_version_id)
);

create index if not exists interview_preps_user_idx on interview_preps (user_id);
create index if not exists interview_preps_job_idx on interview_preps (job_id);

create trigger interview_preps_updated_at
  before update on interview_preps
  for each row execute function update_updated_at();
