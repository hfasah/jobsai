-- Let a talent-pool candidate belong to MULTIPLE named pools at once. The
-- junction table becomes the source of truth for pool membership; the legacy
-- enterprise_talent_pool.group_id is kept but no longer authoritative.

create table if not exists enterprise_talent_pool_memberships (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null,
  talent_pool_id uuid not null,   -- → enterprise_talent_pool.id
  group_id       uuid not null,   -- → enterprise_talent_pool_groups.id
  created_at     timestamptz not null default now(),
  unique (talent_pool_id, group_id)
);

create index if not exists idx_tp_memberships_org    on enterprise_talent_pool_memberships(org_id);
create index if not exists idx_tp_memberships_group  on enterprise_talent_pool_memberships(group_id);
create index if not exists idx_tp_memberships_member on enterprise_talent_pool_memberships(talent_pool_id);

-- Backfill: existing single-group assignments become memberships.
insert into enterprise_talent_pool_memberships (org_id, talent_pool_id, group_id)
select org_id, id, group_id
from enterprise_talent_pool
where group_id is not null
on conflict (talent_pool_id, group_id) do nothing;
