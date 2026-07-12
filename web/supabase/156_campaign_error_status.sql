-- Campaign 'error' status — the campaign can't continue (mailbox/config issue).
alter table enterprise_campaigns drop constraint if exists enterprise_campaigns_status_check;
alter table enterprise_campaigns add constraint enterprise_campaigns_status_check
  check (status in ('draft', 'scheduled', 'active', 'paused', 'stopped', 'completed', 'archived', 'error'));
