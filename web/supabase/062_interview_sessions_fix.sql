-- Fix: interview_sessions was first created by 017_tokens.sql, so the schema in
-- 060_interview_feedback.sql never applied (create table if not exists is a no-op
-- when the table already exists). The save-session API inserts job_title and
-- job_description, which don't exist on the 017 table -> "Failed to save report".
--
-- Add the missing columns idempotently. We keep user_id as text (Clerk IDs),
-- NOT the uuid/auth.users version from 060 which is wrong for this app.

alter table interview_sessions add column if not exists job_title text;
alter table interview_sessions add column if not exists job_description text;
alter table interview_sessions add column if not exists updated_at timestamptz not null default now();
