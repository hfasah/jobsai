-- 117: Recruiting CRM — core (companies, contacts, activities, tasks).
-- The platform already markets a "Recruiting CRM" (enterprise-personas /
-- enterprise-guide / the `crm` entitlement bundle) but it was never built. This
-- is the foundation: client companies + their contacts, plus a unified activity
-- timeline and follow-up tasks. Job orders + deals arrive in migration 118.
--
-- All CRM data is org-scoped in app code via `.eq("org_id", org.id)` (the whole
-- platform's pattern — no RLS) and gated behind requireFeature(userId, "crm").
-- Every table carries org_id, owner_id (the assigned team member, Clerk user_id),
-- created_by (Clerk user_id), created_at, updated_at.

-- ─── Client companies ────────────────────────────────────────────────────────
create table if not exists crm_companies (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references enterprise_orgs(id) on delete cascade,
  name              text not null,
  industry          text,
  website           text,
  location          text,
  size              text,
  status            text not null default 'prospect',  -- prospect | active_client | past_client | dormant
  source            text,
  tags              text[] not null default '{}',
  notes             text,
  owner_id          text,            -- Clerk user_id of the assigned team member
  last_activity_at  timestamptz,
  next_follow_up_at timestamptz,
  created_by        text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_crm_companies_org on crm_companies(org_id);
create index if not exists idx_crm_companies_status on crm_companies(org_id, status);
create index if not exists idx_crm_companies_owner on crm_companies(org_id, owner_id);
create index if not exists idx_crm_companies_followup on crm_companies(org_id, next_follow_up_at);

-- ─── Client contacts (people at a client company) ────────────────────────────
create table if not exists crm_contacts (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references enterprise_orgs(id) on delete cascade,
  company_id          uuid references crm_companies(id) on delete set null,
  first_name          text not null,
  last_name           text,
  title               text,
  email               text,
  phone               text,
  linkedin_url        text,
  contact_type        text not null default 'other',  -- hiring_manager | hr | founder | department_head | finance | other
  relationship_status text not null default 'new',     -- new | warm | active | unresponsive | do_not_contact
  tags                text[] not null default '{}',
  notes               text,
  owner_id            text,
  last_contacted_at   timestamptz,
  next_follow_up_at   timestamptz,
  created_by          text not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_crm_contacts_org on crm_contacts(org_id);
create index if not exists idx_crm_contacts_company on crm_contacts(company_id);
create index if not exists idx_crm_contacts_status on crm_contacts(org_id, relationship_status);
create index if not exists idx_crm_contacts_followup on crm_contacts(org_id, next_follow_up_at);

-- ─── Activity timeline (calls, emails, notes, logged events) ─────────────────
-- Polymorphic: any of the related_* refs may be set so the activity threads onto
-- a company, contact, deal, or job order timeline. Notes are activities with
-- type='note' (single unified timeline — no separate notes table). The deal /
-- job-order FKs are added in migration 118; kept nullable text→uuid here without
-- an FK constraint so this migration doesn't depend on 118's tables.
create table if not exists crm_activities (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references enterprise_orgs(id) on delete cascade,
  type              text not null default 'note',  -- call | email | meeting | linkedin | note | task | proposal_sent | client_intake | candidate_submitted | interview_scheduled | offer_update
  company_id        uuid references crm_companies(id) on delete cascade,
  contact_id        uuid references crm_contacts(id) on delete cascade,
  deal_id           uuid,            -- FK added in 118 (crm_deals)
  job_order_id      uuid,            -- FK added in 118 (crm_job_orders)
  subject           text,
  body              text,
  outcome           text,
  next_step         text,
  occurred_at       timestamptz not null default now(),
  reminder_at       timestamptz,
  owner_id          text,
  created_by        text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_crm_activities_org on crm_activities(org_id, occurred_at desc);
create index if not exists idx_crm_activities_company on crm_activities(company_id);
create index if not exists idx_crm_activities_contact on crm_activities(contact_id);
create index if not exists idx_crm_activities_deal on crm_activities(deal_id);
create index if not exists idx_crm_activities_job_order on crm_activities(job_order_id);

-- ─── Tasks / follow-ups ──────────────────────────────────────────────────────
create table if not exists crm_tasks (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references enterprise_orgs(id) on delete cascade,
  title             text not null,
  status            text not null default 'open',  -- open | done
  due_at            timestamptz,
  reminder_at       timestamptz,
  company_id        uuid references crm_companies(id) on delete cascade,
  contact_id        uuid references crm_contacts(id) on delete cascade,
  deal_id           uuid,            -- FK added in 118
  job_order_id      uuid,            -- FK added in 118
  notes             text,
  owner_id          text,            -- assignee (Clerk user_id)
  completed_at      timestamptz,
  created_by        text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_crm_tasks_org on crm_tasks(org_id);
create index if not exists idx_crm_tasks_status on crm_tasks(org_id, status, due_at);
create index if not exists idx_crm_tasks_owner on crm_tasks(org_id, owner_id);
create index if not exists idx_crm_tasks_company on crm_tasks(company_id);
create index if not exists idx_crm_tasks_contact on crm_tasks(contact_id);
