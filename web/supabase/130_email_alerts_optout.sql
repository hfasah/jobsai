-- Opt-out for consumer lifecycle/alert emails (daily job-discovery summary, etc.).
-- Default ON (opt-out model); the one-click unsubscribe link in those emails and
-- the Notification settings toggle set it false. Welcome email is transactional
-- and not gated by this.
alter table user_preferences add column if not exists alert_emails_enabled boolean not null default true;

notify pgrst, 'reload schema';
