-- 184_notification_types.sql
-- The user_notifications type CHECK (last refreshed in 022) allows 8 types,
-- but the code sends 12 — agent_apply_started/done/failed and employer_reply
-- inserts have been silently rejected with 400s ever since those features
-- shipped (surfaced by the 2026-07-21 agent-backlog settlement: users were
-- made whole but never told). Refresh with the complete inventory.

alter table user_notifications drop constraint if exists user_notifications_type_check;
alter table user_notifications add constraint user_notifications_type_check check (type in (
  'auto_applied', 'manual_required', 'high_match',
  'discovery_summary', 'plan_upgraded', 'pending_approval',
  'interview', 'auto_replied',
  'agent_apply_started', 'agent_apply_done', 'agent_apply_failed',
  'employer_reply'
));
