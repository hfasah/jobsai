-- Webhook idempotency. Resend (via Svix) can redeliver an event; without dedup a
-- redelivered email.received re-runs the whole reply pipeline (double notify,
-- double AI draft). We record each processed event id and skip repeats.
create table if not exists outreach_webhook_events (
  event_id    text primary key,   -- "<endpoint>:<svix-id>"
  received_at timestamptz not null default now()
);

-- Housekeeping: old rows are useless once Resend stops retrying (hours).
create index if not exists outreach_webhook_events_received_idx
  on outreach_webhook_events (received_at);
