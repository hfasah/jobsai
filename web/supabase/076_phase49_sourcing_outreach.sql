-- Phase 49: Sourcing outreach tracking + follow-up sequences

create table if not exists enterprise_sourcing_outreach (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references enterprise_orgs(id) on delete cascade,
  job_id           uuid references enterprise_jobs(id) on delete set null,

  candidate_name   text not null,
  candidate_email  text not null,
  candidate_source text not null default 'application',  -- application | pool
  source_id        uuid,   -- application.id or talent_pool.id

  subject          text,
  sent_by          text,   -- clerk userId

  -- Reply / pipeline tracking
  replied_at       timestamptz,
  reply_added_to_pipeline boolean not null default false,
  application_id   uuid references enterprise_applications(id) on delete set null,

  -- Sequence follow-ups
  follow_up_1_sent_at  timestamptz,
  follow_up_2_sent_at  timestamptz,
  unsubscribed         boolean not null default false,

  created_at       timestamptz not null default now()
);

create index if not exists ent_sourcing_outreach_org_idx   on enterprise_sourcing_outreach(org_id, created_at desc);
create index if not exists ent_sourcing_outreach_job_idx   on enterprise_sourcing_outreach(job_id);
create index if not exists ent_sourcing_outreach_email_idx on enterprise_sourcing_outreach(candidate_email);
create index if not exists ent_sourcing_outreach_fu1_idx   on enterprise_sourcing_outreach(org_id)
  where follow_up_1_sent_at is null and replied_at is null and unsubscribed = false;
