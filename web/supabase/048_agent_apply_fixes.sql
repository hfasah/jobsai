-- Agent-apply fixes
-- Run in Supabase SQL editor.

-- 1. Allow jobs to be marked 'expired' when a posting is no longer live.
--    The original check (002_jobs.sql) only permitted created/processing/ready/failed.
alter table jobs drop constraint if exists jobs_status_check;
alter table jobs add constraint jobs_status_check
  check (status in ('created', 'processing', 'ready', 'failed', 'expired'));

-- 2. Job-board account password the browser agent uses to log into / create
--    accounts on sites that require it (Adzuna, Workable, etc.).
alter table apply_profiles add column if not exists job_board_password text;
