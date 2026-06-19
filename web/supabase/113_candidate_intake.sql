-- 113: Candidate intake — email + upload into the Candidate Inbox.
-- Lets candidates email resumes to a per-org address (forwarded from the org's
-- own hr@ mailbox) and lets recruiters upload a resume directly. Both create an
-- enterprise_applications row so they surface in /enterprise/inbox.

-- Per-org inbound mailbox handle. The address is <handle>@<intake domain>
-- (ENTERPRISE_INTAKE_DOMAIN, defaults to apply.jobsai.work). Lazily defaults to
-- the org slug; stored so it can be customised and looked up from the webhook.
alter table enterprise_orgs add column if not exists intake_email_handle text;

create unique index if not exists enterprise_orgs_intake_handle_idx
  on enterprise_orgs (lower(intake_email_handle))
  where intake_email_handle is not null;

-- Catch-all "General Applications" job so emailed/uploaded candidates that aren't
-- tied to a specific posting still land in the inbox (job_id is NOT NULL). One
-- per org, created lazily on first intake.
alter table enterprise_jobs add column if not exists is_intake_pool boolean not null default false;

create unique index if not exists enterprise_jobs_one_intake_pool_idx
  on enterprise_jobs (org_id)
  where is_intake_pool;

-- Note: arrival channel is recorded in the existing enterprise_applications.source
-- column ('email' | 'upload' | 'careers' | 'import' | 'ats' | 'api').
