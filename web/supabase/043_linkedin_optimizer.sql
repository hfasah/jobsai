-- Phase 43: LinkedIn Optimizer
--   1. linkedin_profiles  — one optimized-profile cache per user (regenerated on
--      demand, editable + savable in place).
--   2. linkedin_posts     — generated field writeups the user can edit, schedule,
--      and mark as posted. status/scheduled_at/posted_at are structured so a real
--      LinkedIn OAuth publisher can be wired in later without a schema change.

create table if not exists linkedin_profiles (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  text not null unique,
  source_resume_version_id uuid,
  headline                 text,
  about                    text,
  experience_rewrites      jsonb not null default '[]',
  skills                   jsonb not null default '[]',
  score                    int,
  suggestions              jsonb not null default '[]',
  generated_json           jsonb not null default '{}',
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

create index if not exists linkedin_profiles_user_idx on linkedin_profiles(user_id);

create table if not exists linkedin_posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  topic         text,
  tone          text,
  format        text,
  body          text not null,
  hashtags      jsonb not null default '[]',
  status        text not null default 'draft' check (status in ('draft', 'scheduled', 'posted')),
  scheduled_at  timestamptz,
  posted_at     timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists linkedin_posts_user_idx on linkedin_posts(user_id, created_at desc);
