-- 177_admin_rbac.sql
-- RBAC for the super-admin portal: staff roster with roles + per-person area
-- overrides, and an audit log of every privileged action. The ADMIN_USER_IDS
-- env var keeps working as the super-admin bootstrap (those ids never need a
-- row here).

create table if not exists admin_staff (
  user_id         text primary key,          -- Clerk user id
  email           text not null,
  display_name    text,
  role            text not null check (role in ('super_admin', 'support_agent', 'support_lead', 'analyst', 'sales')),
  -- Per-person overrides on top of the role's defaults:
  -- { "<perm>": true|false } — boolean values win over the role grant.
  overrides       jsonb not null default '{}',
  -- Daily credit-grant ceiling. null = role default (support_agent 2000,
  -- everyone else unlimited).
  grant_cap_daily integer,
  active          boolean not null default true,
  created_by      text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    text not null,
  actor_role  text,
  action      text not null,      -- e.g. users.grant_credits, users.money_refund, staff.update
  target_type text,               -- user | ticket | org | staff | …
  target_id   text,
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_log_actor_idx on admin_audit_log (actor_id, action, created_at desc);
create index if not exists admin_audit_log_target_idx on admin_audit_log (target_type, target_id, created_at desc);
