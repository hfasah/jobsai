-- Inbox: connect the user's mailbox (Gmail) to collect employer replies and
-- reply as them. Keeps using the user's real email on applications.

create table if not exists email_accounts (
  user_id        text primary key,
  provider       text not null default 'google',
  email          text,
  access_token   text,
  refresh_token  text,
  expires_at     timestamptz,
  history_id     text,
  last_synced_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists inbox_messages (
  id                  uuid primary key default gen_random_uuid(),
  user_id             text not null,
  direction           text not null default 'inbound',   -- inbound | outbound
  from_email          text,
  from_name           text,
  to_email            text,
  subject             text,
  body_text           text,
  classification      text default 'other',              -- confirmation|rejection|interview|otp|update|other
  job_id              uuid references jobs(id) on delete set null,
  provider_message_id text,
  provider_thread_id  text,
  rfc_message_id      text,                              -- Message-ID header, for threading replies
  is_read             boolean not null default false,
  received_at         timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  unique (user_id, provider_message_id)
);

create index if not exists inbox_messages_user_received_idx
  on inbox_messages (user_id, received_at desc);
