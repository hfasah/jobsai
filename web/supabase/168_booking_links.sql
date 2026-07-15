-- Standing booking links ("pick a time" pages, Calendly-style). One per
-- recruiter: candidates open /enterprise/book/p/<token>, see live availability
-- (work hours minus Google Calendar conflicts minus existing bookings), and
-- book — which creates a calendar event with a Meet link and invites them.
create table if not exists enterprise_booking_links (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references enterprise_orgs(id) on delete cascade,
  user_id               text not null,                       -- clerk userId (link owner; their calendar)
  token                 uuid not null unique default gen_random_uuid(),
  title                 text not null default 'Intro call',
  duration_min          int  not null default 30,
  buffer_min            int  not null default 10,            -- padding around busy events
  window_days           int  not null default 14,            -- how far ahead candidates can book
  work_start            int  not null default 9,             -- local hour 0-23
  work_end              int  not null default 17,
  timezone              text not null default 'America/Toronto',
  business_days_only    boolean not null default true,
  create_on_calendar_id text not null default 'primary',     -- which calendar gets the event
  conflict_calendar_ids text[] not null default '{primary}', -- calendars checked for conflicts
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (org_id, user_id)
);
create index if not exists idx_booking_links_org on enterprise_booking_links(org_id);
