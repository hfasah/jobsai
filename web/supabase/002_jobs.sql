-- Manual Job Import & Matching schema (Phase 2)
-- Run in Supabase SQL editor after 001_resume_upload.sql

-- ─── jobs ────────────────────────────────────────────────────────────────────
create table if not exists jobs (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,             -- Clerk user ID
  source_type       text not null default 'text' check (source_type in ('text', 'file')),
  status            text not null default 'created'
                      check (status in ('created', 'processing', 'ready', 'failed')),
  content_hash      text not null,             -- SHA-256 of canonicalized text (dedupe)
  raw_text          text not null,
  source_url        text,
  detected_language text,
  parse_error_msg   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists jobs_user_id_idx on jobs (user_id);
create index if not exists jobs_user_hash_idx on jobs (user_id, content_hash);

-- ─── job_parsed ──────────────────────────────────────────────────────────────
create table if not exists job_parsed (
  job_id            uuid primary key references jobs (id) on delete cascade,
  title             text,
  company           text,
  location          text,
  employment_type   text,
  seniority         text,
  compensation      text,
  posting_url       text,
  summary           text,
  skills            jsonb default '[]',        -- string[]
  responsibilities  jsonb default '[]',        -- string[]
  requirements      jsonb default '[]',        -- string[]
  parsed_json       jsonb default '{}'
);

-- ─── job_matches ─────────────────────────────────────────────────────────────
-- Match score of a job against a specific resume version
create table if not exists job_matches (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references jobs (id) on delete cascade,
  resume_version_id uuid not null references resume_versions (id) on delete cascade,
  match_score       int  not null check (match_score between 0 and 100),
  matched_keywords  jsonb default '[]',        -- string[]
  missing_keywords  jsonb default '[]',        -- string[]
  explanation       text,
  scored_json       jsonb default '{}',
  created_at        timestamptz not null default now(),
  unique (job_id, resume_version_id)
);

create index if not exists job_matches_job_id_idx on job_matches (job_id);

-- ─── updated_at trigger (reuses update_updated_at from 001) ───────────────────
create trigger jobs_updated_at
  before update on jobs
  for each row execute function update_updated_at();
