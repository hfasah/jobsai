-- Outreach OS O3: Master Inbox / AI SDR. Thread-level rollup over the existing
-- enterprise_messages log (individual messages stay there). One thread per
-- (org, candidate email); holds AI intent classification, assignment, and
-- workflow status. No RLS — app-code org scoping.

create table if not exists inbox_threads (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references enterprise_orgs(id) on delete cascade,
  candidate_email  text not null,
  candidate_name   text,
  application_id   uuid,                  -- enterprise_applications.id when known
  -- AI intent classification of the latest inbound reply.
  intent           text check (intent in
    ('interested','not_interested','out_of_office','referral','unsubscribe','meeting_requested','neutral')),
  intent_confidence numeric,             -- 0..1
  intent_manual    boolean not null default false,  -- true once a human overrides
  ai_summary       text,
  -- Operator workflow.
  status           text not null default 'open' check (status in ('open','snoozed','done')),
  assignee_user_id text,                  -- clerk user id
  last_inbound_at  timestamptz,
  last_outbound_at timestamptz,
  reply_count      int not null default 0,
  unread           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (org_id, candidate_email)
);
create index if not exists inbox_threads_org_idx on inbox_threads(org_id, last_inbound_at desc);
create index if not exists inbox_threads_assignee_idx on inbox_threads(org_id, assignee_user_id);
create index if not exists inbox_threads_intent_idx on inbox_threads(org_id, intent);
