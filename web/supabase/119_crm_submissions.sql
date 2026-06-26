-- 119: Recruiting CRM — candidate submissions (the "Submitted Candidates"
-- follow-up). A submission is a candidate put forward to a client for a job
-- order, with its own short status pipeline (submitted → client review →
-- interview → offer → placed / rejected). Optionally links to an existing ATS
-- application (enterprise_applications) when the job order has a linked posting.
-- Org-scoped in app code; gated behind requireFeature("crm").

create table if not exists crm_submissions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references enterprise_orgs(id) on delete cascade,
  company_id      uuid not null references crm_companies(id) on delete cascade,
  job_order_id    uuid references crm_job_orders(id) on delete set null,
  contact_id      uuid references crm_contacts(id) on delete set null,   -- hiring manager submitted to
  application_id  uuid references enterprise_applications(id) on delete set null, -- optional ATS link
  candidate_name  text not null,
  candidate_email text,
  candidate_phone text,
  resume_url      text,
  status          text not null default 'submitted',  -- submitted | client_review | interview | offer | placed | rejected | withdrawn
  submitted_at    timestamptz not null default now(),
  notes           text,
  owner_id        text,
  created_by      text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_crm_submissions_org on crm_submissions(org_id);
create index if not exists idx_crm_submissions_company on crm_submissions(company_id);
create index if not exists idx_crm_submissions_job_order on crm_submissions(job_order_id);
create index if not exists idx_crm_submissions_contact on crm_submissions(contact_id);
create index if not exists idx_crm_submissions_status on crm_submissions(org_id, status);
