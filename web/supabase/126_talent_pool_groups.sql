-- Named talent pools (groups) so candidates can be organised into buckets
-- (e.g. "AWS bench", "Future leadership", "Contract DevOps") and nurtured as a
-- group. Each talent-pool member belongs to at most one named pool; group_id
-- null = the default / ungrouped pool.

create table if not exists enterprise_talent_pool_groups (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  name        text not null,
  created_by  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_tp_groups_org on enterprise_talent_pool_groups(org_id);

alter table enterprise_talent_pool add column if not exists group_id uuid;
create index if not exists idx_talent_pool_group on enterprise_talent_pool(group_id);
