-- Phase 10: Auto-Apply Agent
-- Run in Supabase SQL editor after 006_preferences.sql

-- ─── apply_profiles ──────────────────────────────────────────────────────────
-- One row per user. The "application passport" used for all auto-apply submissions.
create table if not exists apply_profiles (
  id                   uuid primary key default gen_random_uuid(),
  user_id              text not null unique,
  first_name           text,
  last_name            text,
  email                text,
  phone                text,
  linkedin_url         text,
  github_url           text,
  portfolio_url        text,
  website_url          text,
  city                 text,
  country              text,
  authorized_to_work   boolean not null default true,
  requires_sponsorship boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists apply_profiles_user_idx on apply_profiles (user_id);

create trigger apply_profiles_updated_at
  before update on apply_profiles
  for each row execute function update_updated_at();

-- ─── apply_attempts ──────────────────────────────────────────────────────────
-- Every auto-apply and manual-trigger attempt logged here.
create table if not exists apply_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  job_id        uuid not null references jobs (id) on delete cascade,
  platform      text not null,   -- 'lever' | 'greenhouse' | 'ashby' | 'unknown'
  status        text not null default 'pending'
                  check (status in ('pending', 'submitted', 'failed', 'manual_required')),
  submitted_at  timestamptz,
  error_msg     text,
  response_data jsonb default '{}',
  created_at    timestamptz not null default now()
);

create index if not exists apply_attempts_user_idx  on apply_attempts (user_id);
create index if not exists apply_attempts_job_idx   on apply_attempts (job_id);
