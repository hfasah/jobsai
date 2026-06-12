-- Phase 43: SMS/WhatsApp outreach + self-service interview scheduling

-- Outreach log (SMS, WhatsApp, etc.)
create table if not exists enterprise_outreach_log (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references enterprise_orgs(id) on delete cascade,
  application_id uuid references enterprise_applications(id) on delete set null,
  job_id        uuid references enterprise_jobs(id) on delete set null,
  channel       text not null check (channel in ('sms','whatsapp','email')),
  message       text not null,
  sent_by       text not null,
  sent_at       timestamptz not null default now()
);
create index if not exists enterprise_outreach_log_org_idx on enterprise_outreach_log(org_id);

-- Add candidate phone to applications
alter table enterprise_applications
  add column if not exists candidate_phone text;

-- Recruiter availability slots for self-service booking
create table if not exists recruiter_availability (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references enterprise_orgs(id) on delete cascade,
  created_by     text not null,
  job_id         uuid references enterprise_jobs(id) on delete set null,
  starts_at      timestamptz not null,
  ends_at        timestamptz,
  duration_min   int not null default 45,
  booked         boolean not null default false,
  booking_token  uuid not null unique default gen_random_uuid(),
  booked_by_name  text,
  booked_by_email text,
  booked_by_phone text,
  booked_notes    text,
  booked_at       timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists recruiter_availability_org_idx on recruiter_availability(org_id, booked, starts_at);
create index if not exists recruiter_availability_token_idx on recruiter_availability(booking_token);

-- Add self_booked + availability_slot_id to interview schedule
alter table enterprise_interview_schedule
  add column if not exists self_booked boolean not null default false,
  add column if not exists availability_slot_id uuid references recruiter_availability(id) on delete set null;
