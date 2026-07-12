-- Subsequences: configurable trigger → action rules per campaign. When a
-- trigger fires for a lead (a reply of a given category, or the sequence
-- finishing), the listed actions run. Replaces hard-coded reply automation with
-- something recruiters can configure.
create table if not exists enterprise_campaign_subsequences (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references enterprise_orgs(id) on delete cascade,
  campaign_id    uuid not null references enterprise_campaigns(id) on delete cascade,
  name           text not null,
  trigger_type   text not null check (trigger_type in ('reply_category', 'sequence_completed')),
  trigger_config jsonb not null default '{}',   -- e.g. {"category":"interested"}
  actions        jsonb not null default '[]',   -- [{"type":"notify_recruiter"}, {"type":"add_to_campaign","config":{"campaign_id":"…"}}]
  enabled        boolean not null default true,
  created_by     text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists enterprise_campaign_subsequences_campaign_idx
  on enterprise_campaign_subsequences(campaign_id);
