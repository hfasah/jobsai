-- Skills gap analysis cache (one row per user, overwritten on refresh)
create table if not exists skills_gap_analysis (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null unique,
  result_json jsonb not null default '{}',
  job_count   int  not null default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists skills_gap_user_idx on skills_gap_analysis(user_id);
