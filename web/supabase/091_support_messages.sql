-- 091: Threaded support messages — log every email on a ticket (the inbound
-- contact submission, the AI auto-reply, and each admin reply) so the whole
-- conversation is managed from the admin portal.
create table if not exists support_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references support_tickets(id) on delete cascade,
  direction  text not null check (direction in ('inbound','outbound')),
  author     text not null check (author in ('customer','ai','admin')),
  subject    text,
  body       text not null,
  email_to   text,
  email_from text,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_ticket_idx on support_messages(ticket_id, created_at);
