-- 184_apply_engine.sql
-- Cost observability for auto-apply routing: record WHICH engine handled each
-- application so the per-tier cost mix is visible.
--   direct_api    ~$0   (Lever / Ashby / Greenhouse — no browser, no AI)
--   browser_agent ~cents (self-hosted headless browser)
--   manual        —     (handed back to the user)
--   (Skyvern ~$1 lives in agent_apply_tasks, tracked separately.)
-- Nullable + no default so the app's insert works before or after this runs.

alter table apply_attempts
  add column if not exists engine text
  check (engine is null or engine in ('direct_api', 'browser_agent', 'manual', 'skyvern'));

create index if not exists apply_attempts_engine_idx on apply_attempts (engine, status);
