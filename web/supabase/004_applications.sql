-- Phase 4: Application Tracker (Kanban pipeline)
-- Run in Supabase SQL editor after 003_phase3.sql

-- ─── applications ────────────────────────────────────────────────────────────
-- One pipeline card per (user, job). Tracks a job through the application stages.
create table if not exists applications (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,                 -- Clerk user ID
  job_id            uuid not null references jobs (id) on delete cascade,
  stage             text not null default 'saved'
                      check (stage in ('saved', 'applied', 'interviewing', 'offer', 'rejected')),
  notes             text,
  applied_at        timestamptz,                   -- set when the card first reaches 'applied'
  next_action       text,                          -- free-text reminder, e.g. "Follow up with recruiter"
  next_action_date  date,
  position          int  not null default 0,       -- ordering within a stage column
  stage_history     jsonb default '[]',            -- [{ stage, at }] transition log
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, job_id)
);

create index if not exists applications_user_idx on applications (user_id);
create index if not exists applications_user_stage_idx on applications (user_id, stage);
create index if not exists applications_job_idx on applications (job_id);

-- updated_at trigger (reuses update_updated_at from 001)
create trigger applications_updated_at
  before update on applications
  for each row execute function update_updated_at();
