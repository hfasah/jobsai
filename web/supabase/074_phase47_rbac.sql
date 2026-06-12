-- Phase 47 Priority 6: Advanced RBAC

-- Extend role check on enterprise_members
alter table enterprise_members
  drop constraint if exists enterprise_members_role_check;

alter table enterprise_members
  add constraint enterprise_members_role_check
    check (role in ('owner', 'admin', 'recruiter', 'hiring_manager', 'interviewer', 'department_head', 'viewer'));

-- Role permission defaults (used as reference; enforcement is in application layer)
create table if not exists enterprise_role_permissions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references enterprise_orgs(id) on delete cascade,
  role        text not null
    check (role in ('owner', 'admin', 'recruiter', 'hiring_manager', 'interviewer', 'department_head', 'viewer')),

  -- Granular permission flags
  can_view_applications    boolean not null default true,
  can_move_stages          boolean not null default false,
  can_send_emails          boolean not null default false,
  can_send_offers          boolean not null default false,
  can_manage_jobs          boolean not null default false,
  can_invite_members       boolean not null default false,
  can_manage_settings      boolean not null default false,
  can_view_reports         boolean not null default false,
  can_add_notes            boolean not null default true,
  can_schedule_interviews  boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique(org_id, role)
);

-- Seed default permission profiles for the built-in roles
-- (orgs can override these later)
-- No seeding needed here — defaults are enforced in app layer via ROLE_PERMISSIONS constant
