-- Campaign options: deliverability + dedup controls.
--   track_opens      — add the open-tracking pixel (off improves deliverability).
--   dedup_days       — don't enroll a lead contacted (any campaign) within N days.
--   allow_unverified — allow enrolling leads without a verified/likely-valid email.
alter table enterprise_campaigns
  add column if not exists track_opens      boolean not null default true,
  add column if not exists dedup_days       int,
  add column if not exists allow_unverified boolean not null default true;
