-- 121: store Gmail / Google Workspace forwarding-confirmation requests.
-- When an org sets up "forward hr@company.com -> <handle>@talent.jobsai.work",
-- Google sends a confirmation email (code + verify link) to the intake address.
-- We capture it on the org and surface it in Settings -> Intake instead of
-- dropping it into the candidate inbox as a junk record. reply_to_email already
-- exists from migration 120.
alter table enterprise_orgs add column if not exists intake_forward_code text;
alter table enterprise_orgs add column if not exists intake_forward_link text;
alter table enterprise_orgs add column if not exists intake_forward_from text;
alter table enterprise_orgs add column if not exists intake_forward_at   timestamptz;
