-- 176_write_path_repairs.sql
-- Repairs from the 2026-07-19 write-path audit (every insert/upsert in both
-- branches diffed against the actual migration schema, after the Norbert
-- incident proved several writes were failing silently).

-- ── 1. enterprise_distributions: the distribute route upserts with
--       ON CONFLICT (job_id, platform) but no unique constraint ever existed,
--       so the upsert errored and distribution records never saved.
--       Dedupe anything present (keep newest), then add the index the code
--       has always assumed.
delete from enterprise_distributions a
using enterprise_distributions b
where a.job_id = b.job_id
  and a.platform = b.platform
  and a.created_at < b.created_at;

create unique index if not exists enterprise_distributions_job_platform_uniq
  on enterprise_distributions (job_id, platform);

-- ── 2. enterprise_pipeline_rules: pipeline-agent updates
--       { run_count, last_run_at } but last_run_at was never created, so the
--       whole update failed and run_count never incremented either.
alter table enterprise_pipeline_rules
  add column if not exists last_run_at timestamptz;

-- ── 3. agent_apply_tasks: used by the consumer Skyvern pipeline since launch
--       and ALTERed by migration 128, but no migration ever CREATED it (the
--       live table was made by hand). Baseline it so fresh environments and
--       restores work. No-op on the production database.
create table if not exists agent_apply_tasks (
  id              uuid primary key default gen_random_uuid(),
  task_id         text not null unique,   -- Skyvern task id
  user_id         text not null,
  job_id          uuid,
  final_status    text,                   -- webhook-resolved outcome
  resolved_at     timestamptz,
  charged_credits integer,                -- from migration 128
  metered_credits integer,                -- from migration 128
  created_at      timestamptz not null default now()
);

create index if not exists agent_apply_tasks_user_idx on agent_apply_tasks (user_id, created_at desc);
