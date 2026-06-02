-- Company research cache per job
create table if not exists company_research (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs(id) on delete cascade,
  user_id      text not null,
  company_name text not null,
  result_json  jsonb not null default '{}',
  created_at   timestamptz default now()
);

create unique index if not exists company_research_job_user_uniq
  on company_research(job_id, user_id);
