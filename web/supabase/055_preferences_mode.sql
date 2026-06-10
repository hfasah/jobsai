-- Add auto-apply mode and related columns to user_preferences

alter table user_preferences
  add column if not exists auto_apply_mode text
    check (auto_apply_mode in ('auto', 'hybrid', 'review')),
  add column if not exists require_approval boolean not null default false,
  add column if not exists blocked_domains jsonb not null default '[]';

-- Backfill existing users with 'hybrid' mode (balanced)
update user_preferences
set auto_apply_mode = 'hybrid'
where auto_apply_mode is null
  and auto_apply_enabled = true;

-- For disabled users, set to null (they can choose on first enable)
update user_preferences
set auto_apply_mode = null
where auto_apply_mode is null
  and auto_apply_enabled = false;
