-- Phase 47 Priority 4: SAML/SSO configuration

create table if not exists enterprise_sso_configs (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references enterprise_orgs(id) on delete cascade,

  -- Domain that must use SSO
  sso_domain     text not null,          -- e.g. "acme.com"
  enforce_sso    boolean not null default false,

  -- Provider
  provider       text not null
    check (provider in ('okta', 'azure_ad', 'google', 'saml', 'oidc')),
  status         text not null default 'pending'
    check (status in ('pending', 'active', 'error')),
  status_message text,                   -- human-readable error or note

  -- SAML IdP settings
  idp_metadata_url   text,
  idp_entity_id      text,
  idp_sso_url        text,
  idp_certificate    text,

  -- OIDC IdP settings
  oidc_discovery_url text,
  oidc_client_id     text,
  oidc_client_secret text,              -- stored encrypted in prod; plaintext for MVP

  -- Clerk connection reference (set by ops when SSO is activated)
  clerk_connection_id text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique(org_id)   -- one active SSO config per org
);

create index if not exists enterprise_sso_domain_idx
  on enterprise_sso_configs(sso_domain)
  where status = 'active';
