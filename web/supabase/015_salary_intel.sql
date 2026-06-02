-- Salary intelligence cache per job
create table if not exists salary_intel (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  user_id     text not null,
  result_json jsonb not null default '{}',
  created_at  timestamptz default now()
);

create unique index if not exists salary_intel_job_user_uniq
  on salary_intel(job_id, user_id);
