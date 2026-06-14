-- Capture an optional phone number during org onboarding so we can reach the
-- owner about activation. Shown as the first set of questions on /enterprise/onboard.
alter table enterprise_orgs add column if not exists phone text;
