-- Phase 47 Priority 2: Workflow Automation

create table if not exists enterprise_workflow_rules (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references enterprise_orgs(id) on delete cascade,
  name         text not null,
  active       boolean not null default true,

  -- What fires this rule
  trigger_type text not null
    check (trigger_type in ('stage_change', 'application_created', 'offer_signed', 'offer_declined')),
  trigger_stage text, -- only used when trigger_type = 'stage_change'

  -- What to do
  action_type  text not null
    check (action_type in (
      'send_candidate_email',
      'send_team_notification',
      'assign_to',
      'move_stage',
      'add_tag'
    )),
  action_config jsonb not null default '{}',

  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists enterprise_workflow_rules_org_idx
  on enterprise_workflow_rules(org_id, active);
