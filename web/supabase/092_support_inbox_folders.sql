-- 092: Read/unread + folder support for the admin Support Inbox.
-- read_at        = when an admin last opened the ticket
-- last_inbound_at = when the most recent inbound (customer) message arrived
-- A ticket is "unread" when last_inbound_at is newer than read_at (or read_at is
-- null). "Sent" is derived from replied_at. Grouping uses the existing category.
alter table support_tickets add column if not exists read_at         timestamptz;
alter table support_tickets add column if not exists last_inbound_at timestamptz;

-- Backfill: the original submission is the first inbound message.
update support_tickets set last_inbound_at = created_at where last_inbound_at is null;

create index if not exists support_tickets_unread_idx on support_tickets (last_inbound_at desc);
