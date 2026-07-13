-- Per-campaign sending controls:
--   daily_send_limit  — cap emails sent per day for this campaign (null = no cap).
--   holidays          — 'YYYY-MM-DD' dates to skip sending entirely.
--   send_jitter_hours — randomize the next-step time by 0..N hours so sends look
--                       less machine-timed.
alter table enterprise_campaigns
  add column if not exists daily_send_limit  int,
  add column if not exists holidays          text[] not null default '{}',
  add column if not exists send_jitter_hours int not null default 0;
