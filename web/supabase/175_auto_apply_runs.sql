-- 175_auto_apply_runs.sql
-- Per-user auto-apply cron run log. The cron has inserted into this table
-- since launch and /api/auto-apply/logs reads from it, but no migration ever
-- created it — every insert 404'd silently (found 2026-07-19 during the
-- Norbert incident).

create table if not exists auto_apply_runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  jobs_found     integer not null default 0,
  jobs_applied   integer not null default 0,
  jobs_manual    integer not null default 0,
  jobs_failed    integer not null default 0,
  threshold_used integer,
  job_logs       jsonb not null default '[]',
  completed_at   timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists auto_apply_runs_user_idx on auto_apply_runs (user_id, created_at desc);
