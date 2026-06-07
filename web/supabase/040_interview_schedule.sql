-- Interview scheduling: HR books sessions with a meeting link (Zoom/Teams/Meet),
-- a calendar invite (.ics) goes out, reminders reduce no-shows, and HR joins
-- straight from the portal.
create table if not exists enterprise_interview_schedule (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null,
  job_id            uuid,
  application_id    uuid,
  candidate_name    text not null,
  candidate_email   text not null,
  title             text not null,
  interview_type    text not null default 'video',  -- video | phone | onsite
  provider          text,                            -- zoom | teams | google_meet | other | in_person
  meeting_link      text,
  location          text,
  scheduled_at      timestamptz not null,
  duration_min      int not null default 45,
  interviewers      text,                            -- display names
  interviewer_emails text[] default '{}',
  status            text not null default 'scheduled', -- scheduled | confirmed | completed | cancelled | no_show
  notes             text,
  confirm_token     text not null unique default encode(gen_random_bytes(16), 'hex'),
  reminder_24h_sent boolean not null default false,
  reminder_1h_sent  boolean not null default false,
  created_by        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists ent_schedule_org_idx   on enterprise_interview_schedule(org_id, scheduled_at);
create index if not exists ent_schedule_token_idx on enterprise_interview_schedule(confirm_token);
create index if not exists ent_schedule_remind_idx on enterprise_interview_schedule(scheduled_at, status);
