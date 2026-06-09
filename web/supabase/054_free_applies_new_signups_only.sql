-- Free auto-applies are a NEW-SIGNUP teaser only — not for existing accounts.
-- 053 added the column with default 3, which backfilled every existing user.
-- Reset everyone to 0 and flip the default to 0; the 3 freebies are now granted
-- explicitly by the Clerk user.created webhook for genuine new signups.
update user_tokens set free_applies = 0;
alter table user_tokens alter column free_applies set default 0;
