-- Per-run Skyvern cost tracking on each browser-agent attempt.
-- step_count is real (from the run); actions/credits/usd are estimates derived
-- from it (see src/lib/agent-cost.ts). The Skyvern dashboard remains the
-- source of truth for actual billing.
alter table apply_attempts add column if not exists agent_steps    integer;
alter table apply_attempts add column if not exists agent_actions  integer;
alter table apply_attempts add column if not exists agent_credits  integer;
alter table apply_attempts add column if not exists agent_cost_usd numeric(10,4);
