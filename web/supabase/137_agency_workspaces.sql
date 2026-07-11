-- Outreach OS O4: agency sub-workspaces. A "client workspace" is modeled as a
-- child enterprise_orgs row (parent_org_id set), so EVERY existing
-- .eq("org_id", …) query already isolates a workspace's data with zero
-- changes — a workspace simply IS an org. The agency's users get membership
-- across the parent + its children; billing/entitlements roll up to the parent
-- (O4-PR3). Gated behind the agency_workspaces feature so nothing changes for
-- standalone orgs until it's enabled.

alter table enterprise_orgs
  add column if not exists parent_org_id uuid references enterprise_orgs(id) on delete cascade;
-- NULL = a top-level org (standalone customer OR an agency parent).
-- Non-null = a client workspace under that parent.

create index if not exists enterprise_orgs_parent_idx on enterprise_orgs(parent_org_id);

insert into features (feature_key, name, category, is_addon) values
  ('agency_workspaces', 'Agency Client Workspaces', 'Agency', true)
on conflict (feature_key) do nothing;
