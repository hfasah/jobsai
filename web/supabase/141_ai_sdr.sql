-- Outreach OS — per-campaign AI SDR auto-reply. When a candidate replies to a
-- campaign, an AI agent grounded in that campaign's knowledge base + memory
-- drafts a reply. Draft-first by default: the draft lands in the inbox for a
-- human to approve/edit/send; a campaign can opt into true auto-send. No RLS —
-- app-code org scoping like the rest of the enterprise schema.

-- ── Per-campaign AI SDR config (flat settings live on the campaign row) ──────
alter table enterprise_campaigns
  add column if not exists ai_sdr_enabled        boolean not null default false,
  add column if not exists ai_sdr_mode           text not null default 'draft'
    check (ai_sdr_mode in ('draft', 'auto')),
  add column if not exists ai_sdr_persona         text,   -- who the SDR is / tone
  add column if not exists ai_sdr_guardrails      text,   -- hard do's & don'ts injected into the prompt
  add column if not exists ai_sdr_min_confidence  numeric not null default 0.7,  -- auto-send floor
  add column if not exists ai_sdr_max_replies     int not null default 2,        -- auto-replies per thread before human handoff
  add column if not exists ai_sdr_tier            text not null default 'smart'
    check (ai_sdr_tier in ('smart', 'fast'));

-- ── Knowledge base: campaign-scoped reference docs the SDR draws from ────────
-- (role details, comp band, FAQ, objection handling). MVP retrieval packs the
-- whole KB into the prompt under a token budget — no embeddings yet.
create table if not exists ai_sdr_knowledge (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references enterprise_orgs(id) on delete cascade,
  campaign_id uuid not null references enterprise_campaigns(id) on delete cascade,
  title       text not null,
  content     text not null,
  source      text not null default 'manual' check (source in ('manual', 'file', 'url')),
  pinned      boolean not null default false,  -- pinned docs win the token budget first
  created_by  text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ai_sdr_knowledge_campaign_idx on ai_sdr_knowledge(campaign_id);

-- ── Memory: operator-authored running notes / persona rules / learnings ──────
-- Distinct from the KB (reference facts): these are steering notes the SDR
-- always follows. Auto-distilled learnings are a later addition (created_by
-- nullable so an AI author can be recorded then).
create table if not exists ai_sdr_memory (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references enterprise_orgs(id) on delete cascade,
  campaign_id uuid not null references enterprise_campaigns(id) on delete cascade,
  kind        text not null default 'note' check (kind in ('note', 'objection', 'fact')),
  content     text not null,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists ai_sdr_memory_campaign_idx on ai_sdr_memory(campaign_id);

-- ── Draft / send queue + audit: one row per AI-generated reply ───────────────
-- draft mode → status 'needs_review' (human acts in the inbox); auto mode →
-- 'queued' (the cron sends it once scheduled_at is due, after re-validation).
create table if not exists ai_sdr_replies (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references enterprise_orgs(id) on delete cascade,
  thread_id           uuid not null references inbox_threads(id) on delete cascade,
  campaign_id         uuid references enterprise_campaigns(id) on delete set null,
  enrollment_id       uuid references enterprise_campaign_enrollments(id) on delete set null,
  candidate_email     text not null,
  draft_subject       text,
  draft_body          text not null,
  status              text not null default 'needs_review'
    check (status in ('needs_review', 'queued', 'sent', 'suppressed', 'failed', 'rejected')),
  suppressed_reason   text,               -- why a draft was withheld (guardrail hit)
  intent              text,               -- intent snapshot at draft time
  confidence          numeric,            -- classifier confidence at draft time
  model               text,
  input_tokens        int,
  output_tokens       int,
  scheduled_at        timestamptz,        -- when the cron may send (auto mode)
  sent_at             timestamptz,
  reviewed_by         text,               -- clerk user id who approved/edited/rejected
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists ai_sdr_replies_thread_idx on ai_sdr_replies(thread_id);
create index if not exists ai_sdr_replies_queue_idx
  on ai_sdr_replies(org_id, status, scheduled_at);
