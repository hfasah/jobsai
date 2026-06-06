-- LLM usage log for admin cost monitoring across enterprise orgs.
create table if not exists llm_usage (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid,             -- enterprise org (null for non-enterprise)
  user_id       text,
  feature       text not null,    -- screening|ask_ai|framework|report|pool_questions|interview_kit|references|job_description|concierge|distribution
  model         text not null,
  input_tokens  int not null default 0,
  output_tokens int not null default 0,
  cost_usd      numeric(12,6) not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists llm_usage_org_idx     on llm_usage(org_id, created_at desc);
create index if not exists llm_usage_created_idx on llm_usage(created_at desc);

-- Admin-managed fields on the org
alter table enterprise_orgs
  add column if not exists plan_label       text default 'Enterprise',
  add column if not exists admin_notes      text,
  add column if not exists onboarding_done  boolean default false,
  add column if not exists created_by_admin text,
  add column if not exists status           text default 'active';  -- active | suspended
