-- Distinct campaign lifecycle states. Pause (resumable) and Archive existed;
-- add Stopped (ended permanently) and Completed (every enrolled candidate has
-- finished the sequence — set automatically by the sender cron).
alter table enterprise_campaigns drop constraint if exists enterprise_campaigns_status_check;
alter table enterprise_campaigns add constraint enterprise_campaigns_status_check
  check (status in ('draft', 'active', 'paused', 'stopped', 'completed', 'archived'));
