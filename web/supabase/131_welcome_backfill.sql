-- One-time backfill marker: who has received the re-sent welcome email (the
-- original sends 403'd on the unverified jobsai.app domain, so the existing
-- welcome_emails rows are unreliable as "delivered"). backfilled_at lets the
-- backfill endpoint be idempotent — re-running never double-sends.
alter table welcome_emails add column if not exists backfilled_at timestamptz;

notify pgrst, 'reload schema';
