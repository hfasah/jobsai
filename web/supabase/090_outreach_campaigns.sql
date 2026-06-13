-- 090: Outreach Campaigns — configurable multi-step nurture sequences.
-- A campaign is an ordered set of steps (each an email with its own delay,
-- copy, and optional AI personalization). Candidates are enrolled, then a
-- daily cron walks each enrollment through the steps, recording per-step
-- analytics (sent / opened / replied). Gated to Agency+ via the
-- 'outreach_campaigns' feature seeded in 083.

-- ── Campaign (the sequence definition) ──────────────────────────
create table if not exists enterprise_campaigns (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references enterprise_orgs(id) on delete cascade,
  name        text not null,
  description text,
  status      text not null default 'draft'
              check (status in ('draft','active','paused','archived')),
  created_by  text,                         -- clerk userId
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Steps (ordered; each fires `delay_days` after the previous one) ──
create table if not exists enterprise_campaign_steps (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references enterprise_campaigns(id) on delete cascade,
  step_order     int  not null,             -- 0-based position in the sequence
  delay_days     int  not null default 0,   -- days after the previous step (step 0 = days after enrollment)
  subject        text not null,
  body           text not null,             -- supports {{candidate_name}}, {{job_title}}, {{org_name}}, {{sender_name}}
  ai_personalize boolean not null default false,  -- rewrite body per-candidate via LLM before sending
  ai_prompt      text,                       -- optional extra steering for the rewrite
  created_at     timestamptz not null default now(),
  unique (campaign_id, step_order)
);

-- ── Enrollments (a candidate moving through a campaign) ──────────
create table if not exists enterprise_campaign_enrollments (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references enterprise_campaigns(id) on delete cascade,
  org_id            uuid not null references enterprise_orgs(id) on delete cascade,
  job_id            uuid references enterprise_jobs(id) on delete set null,

  candidate_name    text not null,
  candidate_email   text not null,
  candidate_source  text not null default 'manual',   -- application | pool | manual
  source_id         uuid,

  status            text not null default 'active'
                    check (status in ('active','completed','replied','unsubscribed','bounced','removed')),
  current_step_order int not null default 0,   -- next step to send
  next_send_at      timestamptz,                -- when the next step is due (null once finished)

  enrolled_by       text,
  enrolled_at       timestamptz not null default now(),
  last_sent_at      timestamptz,
  replied_at        timestamptz,
  completed_at      timestamptz,

  unique (campaign_id, candidate_email)
);

-- ── Sends (one row per email actually sent → per-step analytics) ──
create table if not exists enterprise_campaign_sends (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enterprise_campaign_enrollments(id) on delete cascade,
  campaign_id   uuid not null references enterprise_campaigns(id) on delete cascade,
  step_id       uuid references enterprise_campaign_steps(id) on delete set null,
  step_order    int  not null,
  org_id        uuid not null references enterprise_orgs(id) on delete cascade,

  candidate_email text not null,
  subject       text,
  sent_at       timestamptz not null default now(),
  opened_at     timestamptz,
  replied_at    timestamptz
);

create index if not exists ent_campaigns_org_idx        on enterprise_campaigns(org_id, created_at desc);
create index if not exists ent_campaign_steps_idx       on enterprise_campaign_steps(campaign_id, step_order);
create index if not exists ent_campaign_enroll_camp_idx on enterprise_campaign_enrollments(campaign_id);
create index if not exists ent_campaign_enroll_org_idx  on enterprise_campaign_enrollments(org_id);
-- Hot path for the cron: active enrollments whose next step is due.
create index if not exists ent_campaign_enroll_due_idx  on enterprise_campaign_enrollments(next_send_at)
  where status = 'active' and next_send_at is not null;
create index if not exists ent_campaign_sends_camp_idx  on enterprise_campaign_sends(campaign_id, step_order);
create index if not exists ent_campaign_sends_enroll_idx on enterprise_campaign_sends(enrollment_id);
