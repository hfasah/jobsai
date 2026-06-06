-- Candidate Pools.
-- Resumes/applications auto-triage into pools (per job, by score tier) and are
-- removed from the inbox. HR works inside pools, not the inbox. Each pool has a
-- single standardized question set shared by every candidate in it.

create table if not exists enterprise_pools (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null,
  job_id             uuid references enterprise_jobs(id) on delete cascade,
  name               text not null,
  description        text,
  type               text not null default 'custom',  -- auto_top|auto_strong|auto_possible|auto_low|custom
  color              text default 'slate',
  criteria           text,                  -- extra criteria HR wants questions to target
  question_set       jsonb default '[]',    -- [{ id, type, question }] — same for all candidates in pool
  additional_context text,                  -- HR / hiring-manager notes fed into question generation
  sort_order         int default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Applications gain pool membership + a triaged flag (triaged => out of inbox)
alter table enterprise_applications
  add column if not exists pool_id uuid references enterprise_pools(id) on delete set null,
  add column if not exists triaged boolean default false;

create index if not exists ent_pools_job_idx  on enterprise_pools(job_id);
create index if not exists ent_apps_pool_idx  on enterprise_applications(pool_id);
create index if not exists ent_apps_triaged_idx on enterprise_applications(org_id, triaged);
