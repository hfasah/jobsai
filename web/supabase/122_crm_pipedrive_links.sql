-- 122: Pipedrive CRM sync — maps a JobsAI CRM entity to its Pipedrive object so
-- pushes update (not duplicate) the right record. Generic entity_type so the
-- same table serves companies now and contacts/deals/activities later.
-- The Pipedrive API token itself lives in enterprise_integrations (provider
-- 'pipedrive', api_key = token, subdomain = company domain) from migration 029.
create table if not exists crm_pipedrive_links (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references enterprise_orgs(id) on delete cascade,
  entity_type    text not null,            -- 'company' (future: contact|deal|activity)
  entity_id      uuid not null,            -- crm_companies.id, etc.
  pipedrive_id   bigint not null,          -- the Pipedrive object id
  last_pushed_at timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  unique (org_id, entity_type, entity_id)
);
create index if not exists idx_crm_pipedrive_links_lookup on crm_pipedrive_links(org_id, entity_type, entity_id);
