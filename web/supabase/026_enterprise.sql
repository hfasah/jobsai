-- Enterprise recruiting platform tables
-- Phase 1: org model, jobs, applications
-- Phase 2: AI screening scores, pipeline stages, bulk actions

-- Organizations
create table if not exists enterprise_orgs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  logo_url     text,
  industry     text,
  size         text,
  website      text,
  created_by   text not null,  -- Clerk user_id of owner
  created_at   timestamptz not null default now()
);

-- Org members (recruiters / admins)
create table if not exists enterprise_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references enterprise_orgs(id) on delete cascade,
  user_id    text not null,  -- Clerk user_id
  role       text not null default 'recruiter',  -- owner | admin | recruiter
  created_at timestamptz not null default now(),
  unique(org_id, user_id)
);

-- Job postings
create table if not exists enterprise_jobs (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references enterprise_orgs(id) on delete cascade,
  title            text not null,
  department       text,
  location         text,
  employment_type  text default 'full-time',  -- full-time|part-time|contract|internship
  description      text,
  responsibilities text,
  qualifications   text,
  nice_to_have     text,
  salary_min       int,
  salary_max       int,
  salary_currency  text default 'USD',
  status           text not null default 'draft',  -- draft|active|paused|closed
  created_by       text not null,
  created_at       timestamptz not null default now(),
  published_at     timestamptz,
  closes_at        timestamptz
);

-- Applications (Phase 1: manual + public form; Phase 3: multi-board import)
create table if not exists enterprise_applications (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references enterprise_jobs(id) on delete cascade,
  org_id              uuid not null,
  -- Candidate
  candidate_name      text not null,
  candidate_email     text not null,
  candidate_phone     text,
  resume_url          text,
  resume_text         text,  -- extracted for AI screening
  cover_letter        text,
  linkedin_url        text,
  portfolio_url       text,
  source              text default 'direct',  -- direct|linkedin|indeed|referral|jobsai
  -- Pipeline
  stage               text not null default 'applied',  -- applied|screened|interview|offer|hired|rejected
  -- Phase 2: AI scoring
  match_score         int,   -- 0-100 overall
  skills_score        int,
  experience_score    int,
  culture_score       int,
  risk_flags          text[] default '{}',
  ai_summary          text,
  ai_recommendation   text,  -- strong_yes|yes|maybe|no
  -- Meta
  tags                text[] default '{}',
  notes               text,
  duplicate_of        uuid references enterprise_applications(id),
  is_duplicate        boolean default false,
  screened_at         timestamptz,
  stage_updated_at    timestamptz default now(),
  status_email_sent   boolean default false,
  created_at          timestamptz not null default now()
);

-- Indexes
create index if not exists enterprise_members_user_idx  on enterprise_members(user_id);
create index if not exists enterprise_jobs_org_idx      on enterprise_jobs(org_id);
create index if not exists enterprise_jobs_status_idx   on enterprise_jobs(status);
create index if not exists enterprise_apps_job_idx      on enterprise_applications(job_id);
create index if not exists enterprise_apps_org_idx      on enterprise_applications(org_id);
create index if not exists enterprise_apps_stage_idx    on enterprise_applications(stage);
create index if not exists enterprise_apps_email_idx    on enterprise_applications(candidate_email);
