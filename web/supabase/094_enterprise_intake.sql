-- 094: Enterprise intake / lead form. A shareable public form a prospect fills
-- out; submissions land in the admin portal where back-office staff review the
-- suggested plan and one-click create the account.
create table if not exists enterprise_intake (
  id             uuid primary key default gen_random_uuid(),
  company        text not null,
  website        text,
  contact_name   text not null,
  contact_email  text not null,
  contact_phone  text,
  num_employees  text,           -- size band (e.g. "201-500")
  num_recruiters int,            -- seats / users who'll use JobsAI
  hiring_volume  text,           -- hires per year band
  industry       text,
  current_tools  text,           -- what they use today (free text)
  -- Per-tool interest: { "<tool_key>": "need" | "want" | "unsure" | "no" }
  tool_prefs     jsonb not null default '{}'::jsonb,
  notes          text,
  suggested_plan text,           -- plan slug computed at submit time
  status         text not null default 'new' check (status in ('new','reviewed','converted','archived')),
  org_id         uuid references enterprise_orgs(id) on delete set null, -- set once converted
  created_at     timestamptz not null default now()
);

create index if not exists enterprise_intake_status_idx  on enterprise_intake(status, created_at desc);
create index if not exists enterprise_intake_created_idx on enterprise_intake(created_at desc);
