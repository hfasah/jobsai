-- White-label branding + enterprise API access on the org.

alter table enterprise_orgs
  add column if not exists brand_color       text default '#2563eb',
  add column if not exists tagline           text,
  add column if not exists careers_intro     text,
  add column if not exists show_powered_by   boolean default true,
  add column if not exists api_key           text,
  add column if not exists api_key_created_at timestamptz;

create unique index if not exists ent_orgs_api_key_idx on enterprise_orgs(api_key) where api_key is not null;
