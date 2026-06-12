-- Phase 48: Post-interview feedback / scorecard

create table if not exists enterprise_interview_feedback (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references enterprise_orgs(id) on delete cascade,
  interview_id    uuid not null references enterprise_interview_schedule(id) on delete cascade,
  application_id  uuid references enterprise_applications(id) on delete set null,
  submitted_by    text not null,   -- clerk userId

  overall_rating  int check (overall_rating between 1 and 5),
  hire_rec        text check (hire_rec in ('strong_yes', 'yes', 'maybe', 'no')),

  -- Per-dimension ratings (optional)
  technical_rating     int check (technical_rating between 1 and 5),
  communication_rating int check (communication_rating between 1 and 5),
  culture_rating       int check (culture_rating between 1 and 5),

  notes           text,
  private_notes   text,   -- only visible to submitter

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique(interview_id, submitted_by)
);

create index if not exists ent_interview_feedback_interview_idx on enterprise_interview_feedback(interview_id);
create index if not exists ent_interview_feedback_app_idx       on enterprise_interview_feedback(application_id);
