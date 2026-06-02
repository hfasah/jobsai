-- Phase 3: ATS Scanner, Resume Tailoring, Cover Letters
-- Run in Supabase SQL editor after 002_jobs.sql

-- ─── ats_scans ───────────────────────────────────────────────────────────────
create table if not exists ats_scans (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,
  job_id            uuid not null references jobs (id) on delete cascade,
  resume_version_id uuid not null references resume_versions (id) on delete cascade,
  score             int  not null check (score between 0 and 100),
  breakdown         jsonb default '{}',   -- { keyword_alignment, experience_relevance, formatting, readability, buzzwords_penalty }
  weaknesses        jsonb default '[]',   -- [{ section, issue, severity }]
  formatting_issues jsonb default '[]',   -- [{ type, detail }]
  buzzwords         jsonb default '[]',   -- [{ phrase, suggestion }]
  keyword_coverage  jsonb default '{}',   -- { required[], missing[], matched[] }
  fixes             jsonb default '[]',   -- [{ section, suggestion, severity }]
  ats_risks         jsonb default '[]',   -- string[]
  created_at        timestamptz not null default now(),
  unique (job_id, resume_version_id)
);

create index if not exists ats_scans_user_idx on ats_scans (user_id);
create index if not exists ats_scans_job_idx on ats_scans (job_id);

-- ─── tailored_resumes ────────────────────────────────────────────────────────
create table if not exists tailored_resumes (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  text not null,
  job_id                   uuid not null references jobs (id) on delete cascade,
  source_resume_version_id uuid not null references resume_versions (id) on delete cascade,
  headline                 text,
  summary                  text,
  tailored_json            jsonb default '{}',  -- full tailored resume structure
  changes                  jsonb default '[]',  -- [{ section, before, after, reason }]
  keywords_added           jsonb default '[]',  -- string[]
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (job_id, source_resume_version_id)
);

create index if not exists tailored_resumes_user_idx on tailored_resumes (user_id);
create index if not exists tailored_resumes_job_idx on tailored_resumes (job_id);

-- ─── cover_letters ───────────────────────────────────────────────────────────
create table if not exists cover_letters (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,
  job_id            uuid not null references jobs (id) on delete cascade,
  resume_version_id uuid not null references resume_versions (id) on delete cascade,
  tone              text not null default 'professional'
                      check (tone in ('professional', 'enthusiastic', 'confident', 'warm', 'concise')),
  length            text not null default 'medium'
                      check (length in ('short', 'medium', 'long')),
  body              text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists cover_letters_user_idx on cover_letters (user_id);
create index if not exists cover_letters_job_idx on cover_letters (job_id);

-- updated_at triggers (reuse update_updated_at from 001)
create trigger tailored_resumes_updated_at
  before update on tailored_resumes
  for each row execute function update_updated_at();

create trigger cover_letters_updated_at
  before update on cover_letters
  for each row execute function update_updated_at();
