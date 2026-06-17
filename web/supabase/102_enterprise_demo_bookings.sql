-- Self-serve demo bookings from the public /enterprise/demo page.
-- Prospects pick a date + time in the 4-step wizard; the row is the lead record
-- and the back office confirms/hosts the call. Accessed via the service role.

create table if not exists enterprise_demo_bookings (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  email           text not null,
  company         text,
  phone           text,
  team_size       text,            -- recruiter headcount band, optional
  current_ats     text,            -- ATS / tools they use today, optional
  goals           text,            -- free-text "what do you want to see"
  -- Chosen slot. starts_at is the absolute instant; timezone is the visitor's
  -- IANA zone so the team can display it back in the prospect's local time.
  starts_at       timestamptz not null,
  duration_min    integer not null default 30,
  timezone        text,
  status          text not null default 'requested',  -- requested | confirmed | completed | cancelled | no_show
  source          text,            -- utm/source hint, optional
  created_at      timestamptz not null default now()
);

create index if not exists idx_demo_bookings_starts_at on enterprise_demo_bookings(starts_at);
create index if not exists idx_demo_bookings_status on enterprise_demo_bookings(status);
create index if not exists idx_demo_bookings_email on enterprise_demo_bookings(email);
