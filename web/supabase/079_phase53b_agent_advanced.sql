-- Phase 53B: Autonomous Agent advanced
-- Multi-action rules, additional trigger events, stale-candidate cron

alter table enterprise_pipeline_rules
  add column if not exists actions       jsonb default null,          -- [{action, action_config}] array; overrides single action/action_config when set
  add column if not exists trigger_config jsonb not null default '{}'; -- e.g. {"stale_for_days": 5} for stale_candidate trigger
