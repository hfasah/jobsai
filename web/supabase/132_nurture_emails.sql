-- Recurring personalized "nurture" letters sent on a paced cadence by
-- /api/cron/nurture. One row per (user, letter) records that it was sent —
-- drives the sequence (send the next unsent letter) and prevents re-sends.
create table if not exists nurture_emails (
  user_id    text not null,
  letter_key text not null,
  sent_at    timestamptz not null default now(),
  primary key (user_id, letter_key)
);
-- Look up a user's most recent nurture send (for pacing between letters).
create index if not exists nurture_emails_user_sent_idx on nurture_emails (user_id, sent_at desc);

notify pgrst, 'reload schema';
