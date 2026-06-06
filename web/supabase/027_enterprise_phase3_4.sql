-- Phase 3: Distribution + Analytics
-- Phase 4: Talent pool + Engagement sequences

-- Track where a job has been distributed + AI-generated content per platform
create table if not exists enterprise_distributions (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references enterprise_jobs(id) on delete cascade,
  org_id      uuid not null,
  platform    text not null,  -- linkedin|indeed|twitter|email|google_jobs|direct
  content     text,           -- AI-generated platform-specific copy
  tracking_url text,          -- UTM-tracked link
  published_at timestamptz,
  created_at  timestamptz not null default now()
);

-- Click / view tracking per source
create table if not exists enterprise_job_views (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references enterprise_jobs(id) on delete cascade,
  org_id     uuid not null,
  source     text not null default 'direct',
  event_type text not null default 'view',  -- view|click|apply
  created_at timestamptz not null default now()
);

-- Talent pool — strong candidates kept warm for future roles
create table if not exists enterprise_talent_pool (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null,
  application_id  uuid references enterprise_applications(id) on delete set null,
  candidate_name  text not null,
  candidate_email text not null,
  candidate_phone text,
  linkedin_url    text,
  skills_tags     text[] default '{}',
  match_score     int,
  source_job_title text,
  notes           text,
  status          text default 'active',  -- active|contacted|placed|inactive
  last_contacted  timestamptz,
  created_at      timestamptz not null default now(),
  unique(org_id, candidate_email)
);

-- Automated engagement sequences (per org, per trigger stage)
create table if not exists enterprise_sequences (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  name        text not null,
  trigger_stage text not null,  -- applied|screened|interview|offer|rejected
  delay_days  int not null default 0,
  subject     text not null,
  body        text not null,
  active      boolean default true,
  created_at  timestamptz not null default now()
);

-- Track which sequence emails have been sent
create table if not exists enterprise_sequence_sends (
  id              uuid primary key default gen_random_uuid(),
  sequence_id     uuid not null references enterprise_sequences(id) on delete cascade,
  application_id  uuid not null references enterprise_applications(id) on delete cascade,
  sent_at         timestamptz not null default now(),
  unique(sequence_id, application_id)
);

-- Indexes
create index if not exists enterprise_distributions_job_idx on enterprise_distributions(job_id);
create index if not exists enterprise_job_views_job_idx     on enterprise_job_views(job_id);
create index if not exists enterprise_job_views_source_idx  on enterprise_job_views(source);
create index if not exists enterprise_talent_pool_org_idx   on enterprise_talent_pool(org_id);
create index if not exists enterprise_sequences_org_idx     on enterprise_sequences(org_id);
