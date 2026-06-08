-- Inbox: let users also CC their own (or another) email on application/inbox
-- emails JobsAI sends/forwards on their behalf.
alter table user_preferences add column if not exists cc_email_enabled boolean not null default false;
alter table user_preferences add column if not exists cc_email text;
