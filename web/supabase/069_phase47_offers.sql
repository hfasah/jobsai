-- Phase 47 Priority 1: Offer Letters + E-signature

create table if not exists enterprise_offer_letters (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references enterprise_orgs(id) on delete cascade,
  job_id           uuid references enterprise_jobs(id) on delete set null,
  application_id   uuid references enterprise_applications(id) on delete set null,
  created_by       text not null,

  -- Candidate info (denormalised so it survives application deletion)
  candidate_name   text not null,
  candidate_email  text not null,

  -- Offer details
  job_title        text not null,
  salary           text,
  start_date       text,
  content          text not null,      -- HTML body of the offer letter
  notes            text,               -- internal only

  -- Workflow
  status           text not null default 'draft'
                   check (status in ('draft','sent','signed','declined','withdrawn')),

  -- E-signature
  sign_token       text not null unique default encode(gen_random_bytes(24), 'base64'),
  signed_at        timestamptz,
  signed_by_name   text,
  signed_by_ip     text,
  signed_by_ua     text,
  declined_at      timestamptz,
  decline_reason   text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists enterprise_offer_letters_org_idx   on enterprise_offer_letters(org_id);
create index if not exists enterprise_offer_letters_app_idx   on enterprise_offer_letters(application_id);
create index if not exists enterprise_offer_letters_token_idx on enterprise_offer_letters(sign_token);
