-- Send idempotency: exactly one email per (campaign, enrollment, sequence step).
-- The sender cron upserts on this key and skips on conflict, so a retried or
-- overlapping cron run can never double-send.

-- Clear any accidental duplicate sends first (keep one per key) so the unique
-- index can be created.
delete from enterprise_campaign_sends a
using enterprise_campaign_sends b
where a.campaign_id = b.campaign_id
  and a.enrollment_id = b.enrollment_id
  and a.step_order = b.step_order
  and a.ctid > b.ctid;

create unique index if not exists enterprise_campaign_sends_idem_idx
  on enterprise_campaign_sends (campaign_id, enrollment_id, step_order);
