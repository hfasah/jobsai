-- Browser-profile reuse for the agent-apply WORKFLOW path (cost lever #2).
-- A Skyvern browser profile (bp_…) persists a user's logged-in cookies for a
-- given job board, with NO idle cost (unlike a live browser session). Reusing it
-- on the next apply to that board skips the login steps (~30–40% fewer steps).
--
-- Profiles are per (user, board) and only used for the account-based boards
-- (LinkedIn/Indeed/ZipRecruiter/Dice/Workable). Unknown/"manual" ATS hosts are
-- guest applies (no stable login) and are NOT keyed here.
--
-- Gated entirely behind SKYVERN_APPLY_WORKFLOW_ID — until that's set, the
-- run_task path is used and these tables stay empty (no behavior change).
create table if not exists agent_board_profiles (
  user_id            text not null,
  board              text not null,
  browser_profile_id text not null,
  workflow_run_id    text,
  created_at         timestamptz not null default now(),
  refreshed_at       timestamptz not null default now(),
  primary key (user_id, board)
);

-- Let the completion webhook know which run used the workflow path + for which
-- board, so it can capture/refresh that (user, board) profile.
alter table agent_apply_tasks add column if not exists board    text;
alter table agent_apply_tasks add column if not exists run_mode text; -- 'task' | 'workflow'
