-- Outreach OS O2: campaign engine v2 — A/B variants, send windows, mailbox
-- rotation bookkeeping.

-- Send windows (org-local hours) + business-day gating per campaign.
alter table enterprise_campaigns
  add column if not exists send_window_start int check (send_window_start between 0 and 23),
  add column if not exists send_window_end   int check (send_window_end between 1 and 24),
  add column if not exists send_timezone     text,
  add column if not exists business_days_only boolean not null default false;

-- A/B variant B on a step (null = no test on this step). Assignment is
-- per-enrollment (sticky across every step of the sequence).
alter table enterprise_campaign_steps
  add column if not exists ab_subject text,
  add column if not exists ab_body    text;

alter table enterprise_campaign_enrollments
  add column if not exists ab_bucket text check (ab_bucket in ('A','B'));

-- Which variant + which mailbox actually sent (rotation analytics).
alter table enterprise_campaign_sends
  add column if not exists variant    text,
  add column if not exists mailbox_id uuid references sending_mailboxes(id) on delete set null,
  add column if not exists from_email text;
