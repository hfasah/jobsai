-- Per-recruiter scheduling profile: their default video meeting / calendar link
-- used to pre-fill interview invites.
alter table enterprise_members
  add column if not exists default_meeting_link text,
  add column if not exists calendar_provider    text;  -- zoom | teams | google_meet | outlook | google_calendar | other
