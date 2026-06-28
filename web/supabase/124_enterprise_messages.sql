-- Unified candidate email thread, so the recruiter<>candidate conversation stays
-- inside JobsAI instead of escaping to a personal mailbox. Outbound sends
-- (sourcing outreach, follow-ups, in-app replies) and inbound replies (captured
-- via the intake webhook) are both logged here, threaded to the application.

create table if not exists enterprise_messages (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null,
  application_id uuid,
  outreach_id    uuid,
  direction      text not null,            -- 'outbound' | 'inbound'
  from_email     text,
  to_email       text,
  subject        text,
  body           text,
  channel        text not null default 'email',
  created_at     timestamptz not null default now()
);

create index if not exists idx_enterprise_messages_org on enterprise_messages(org_id);
create index if not exists idx_enterprise_messages_app on enterprise_messages(application_id, created_at desc);
