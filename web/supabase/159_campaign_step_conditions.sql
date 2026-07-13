-- Per-step sending condition:
--   skip_if_in_pipeline — before sending this step, if the candidate already has
--   an application in the org's pipeline (i.e. they've been moved forward), skip
--   the step and advance the enrollment without emailing. Stops us from chasing a
--   candidate who has already responded and progressed.
alter table enterprise_campaign_steps
  add column if not exists skip_if_in_pipeline boolean not null default false;
