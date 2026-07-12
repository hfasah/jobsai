-- Per-campaign mailbox strategy. 'auto' spreads sends across the org's healthy
-- mailboxes by remaining capacity (lowest-usage first); 'fixed' always sends
-- from mailbox_id (falling back to the pool if it's unavailable).
alter table enterprise_campaigns
  add column if not exists mailbox_strategy text not null default 'auto'
    check (mailbox_strategy in ('auto', 'fixed')),
  add column if not exists mailbox_id uuid;
