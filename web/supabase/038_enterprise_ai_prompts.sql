-- Saved AI prompt templates shared across the org. Any team member can add one;
-- they appear as one-click prompts in the global "Ask AI" assistant.
create table if not exists enterprise_ai_prompts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  title       text not null,
  prompt      text not null,
  created_by  text,
  uses        int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists ent_ai_prompts_org_idx on enterprise_ai_prompts(org_id);
