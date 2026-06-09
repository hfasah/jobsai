-- Per-application inbound email aliases.
-- The browser agent applies using a unique alias (token@apply.jobsai.work) so
-- employer replies land back in JobsAI and can be matched to the exact card.

create table if not exists apply_aliases (
  token        text primary key,                          -- random, unguessable
  alias_email  text not null,                             -- token@<inbound domain>
  user_id      text not null,
  job_id       uuid not null references jobs(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (user_id, job_id)
);

create index if not exists apply_aliases_user_job_idx on apply_aliases (user_id, job_id);
create index if not exists apply_aliases_alias_idx on apply_aliases (alias_email);
