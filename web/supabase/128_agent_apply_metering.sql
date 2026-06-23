-- Usage metering for browser-agent (Skyvern) auto-apply.
-- We charge a flat TOKEN_COSTS.auto_apply (600) upfront, then RECONCILE against
-- the run's real step_count when Skyvern's webhook reports completion:
--   • charged_credits  = what we reserved upfront (600, or 0 for a free apply)
--   • metered_credits  = the settled amount derived from step_count
--     (set once — also the idempotency guard so webhook retries don't double-bill)
-- Refund the difference when an apply was lighter than the flat quote; bill the
-- overage (capped) when it was heavier, so heavy users fund their own usage and
-- one shared Skyvern pool can't be drained by undercharging.
alter table agent_apply_tasks add column if not exists charged_credits integer;
alter table agent_apply_tasks add column if not exists metered_credits integer;
