-- Opt-in auto-confirm reply: when on, JobsAI auto-sends an AI-drafted reply to
-- incoming interview/update employer emails during inbox sync. Default OFF, so
-- nothing is sent without review unless the user explicitly enables it.
alter table apply_profiles add column if not exists auto_reply boolean not null default false;

-- Refresh the notification type check so the auto-reply notice (and the
-- interview/pending_approval types already used in code) are accepted.
alter table user_notifications drop constraint if exists user_notifications_type_check;
alter table user_notifications add constraint user_notifications_type_check check (type in (
  'auto_applied', 'manual_required', 'high_match',
  'discovery_summary', 'plan_upgraded', 'pending_approval',
  'interview', 'auto_replied'
));
