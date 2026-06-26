-- 118: Recruiting CRM — job orders + deals (PR2).
-- Builds on 117. Deals are the agency BD pipeline; job orders are client
-- requirements that optionally spin up a real enterprise_jobs posting (and thus
-- reuse the existing candidate/pipeline/interview/offer flow). Both org-scoped
-- in app code via .eq("org_id", org.id) and gated behind requireFeature("crm").

-- ─── Deals (business-development pipeline) ────────────────────────────────────
create table if not exists crm_deals (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references enterprise_orgs(id) on delete cascade,
  name              text not null,
  company_id        uuid references crm_companies(id) on delete set null,
  contact_id        uuid references crm_contacts(id) on delete set null,
  value             numeric,
  stage             text not null default 'lead',  -- lead | discovery | proposal_sent | agreement_sent | active_requirement | won | lost
  probability       integer,                        -- 0–100
  expected_close_at timestamptz,
  next_action       text,
  notes             text,
  owner_id          text,
  created_by        text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_crm_deals_org on crm_deals(org_id);
create index if not exists idx_crm_deals_stage on crm_deals(org_id, stage);
create index if not exists idx_crm_deals_company on crm_deals(company_id);
create index if not exists idx_crm_deals_owner on crm_deals(org_id, owner_id);

-- ─── Job orders (client requirements) ────────────────────────────────────────
create table if not exists crm_job_orders (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references enterprise_orgs(id) on delete cascade,
  company_id        uuid not null references crm_companies(id) on delete cascade,
  contact_id        uuid references crm_contacts(id) on delete set null,
  deal_id           uuid references crm_deals(id) on delete set null,
  job_id            uuid references enterprise_jobs(id) on delete set null,  -- optional linked posting
  title             text not null,
  job_type          text not null default 'permanent',  -- permanent | contract | contract_to_hire | temporary
  status            text not null default 'intake',      -- intake | open | sourcing | submitted | interviewing | offer | filled | on_hold | cancelled
  priority          text not null default 'medium',      -- low | medium | high | urgent
  openings          integer not null default 1,
  location          text,
  work_mode         text,                                -- remote | hybrid | onsite
  salary_min        numeric,
  salary_max        numeric,
  pay_rate          numeric,
  bill_rate         numeric,
  fee_pct           numeric,
  markup            numeric,
  placement_value   numeric,
  expected_close_at timestamptz,
  description       text,
  internal_notes    text,
  assigned_recruiter text,            -- Clerk user_id
  created_by        text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_crm_job_orders_org on crm_job_orders(org_id);
create index if not exists idx_crm_job_orders_status on crm_job_orders(org_id, status);
create index if not exists idx_crm_job_orders_company on crm_job_orders(company_id);
create index if not exists idx_crm_job_orders_deal on crm_job_orders(deal_id);
create index if not exists idx_crm_job_orders_job on crm_job_orders(job_id);
create index if not exists idx_crm_job_orders_recruiter on crm_job_orders(org_id, assigned_recruiter);

-- ─── Wire up the reserved FK columns from 117 (now that the targets exist) ────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'crm_activities_deal_id_fkey') then
    alter table crm_activities add constraint crm_activities_deal_id_fkey
      foreign key (deal_id) references crm_deals(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_activities_job_order_id_fkey') then
    alter table crm_activities add constraint crm_activities_job_order_id_fkey
      foreign key (job_order_id) references crm_job_orders(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_tasks_deal_id_fkey') then
    alter table crm_tasks add constraint crm_tasks_deal_id_fkey
      foreign key (deal_id) references crm_deals(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_tasks_job_order_id_fkey') then
    alter table crm_tasks add constraint crm_tasks_job_order_id_fkey
      foreign key (job_order_id) references crm_job_orders(id) on delete cascade;
  end if;
end $$;
