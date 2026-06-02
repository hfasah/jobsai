-- Phase 8: Job Preferences Profile
-- Run in Supabase SQL editor after 005_interview_prep.sql

-- ─── user_preferences ────────────────────────────────────────────────────────
-- One row per user. Used by the auto job discovery engine (Phase 9+).
create table if not exists user_preferences (
  id                   uuid primary key default gen_random_uuid(),
  user_id              text not null unique,              -- Clerk user ID

  -- Job targeting
  job_titles           jsonb not null default '[]',       -- string[] e.g. ["Senior Frontend Engineer"]
  keywords             jsonb not null default '[]',       -- string[] additional search terms

  -- Location
  location_type        text not null default 'any'
                         check (location_type in ('remote', 'hybrid', 'onsite', 'any')),
  locations            jsonb not null default '[]',       -- string[] preferred cities/regions

  -- Compensation
  min_salary           int,                               -- annual, null = no minimum
  salary_currency      text not null default 'USD',

  -- Job type filters
  employment_types     jsonb not null default '[]',       -- full-time|part-time|contract|internship
  seniority_levels     jsonb not null default '[]',       -- entry|mid|senior|lead|principal

  -- Exclusions
  excluded_companies   jsonb not null default '[]',       -- string[] companies to skip

  -- Auto-apply (active from Phase 10)
  auto_apply_enabled   boolean not null default false,
  auto_apply_threshold int     not null default 75        -- min match score to trigger auto-apply
                         check (auto_apply_threshold between 50 and 100),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists user_preferences_user_idx on user_preferences (user_id);

create trigger user_preferences_updated_at
  before update on user_preferences
  for each row execute function update_updated_at();
