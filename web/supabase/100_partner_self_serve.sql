-- Self-serve partner sign-up: a public application form + email/SMS verification
-- (anti-spam) that mints a referral link without requiring a JobsAI login.

-- Partners no longer must map to a Clerk user (a partner needn't be a customer).
alter table partner_accounts alter column user_id drop not null;

alter table partner_accounts add column if not exists name                text;
alter table partner_accounts add column if not exists linkedin            text;
alter table partner_accounts add column if not exists estimated_referrals text;
alter table partner_accounts add column if not exists verified            boolean not null default false;
alter table partner_accounts add column if not exists verify_code         text;
alter table partner_accounts add column if not exists verify_expires_at   timestamptz;
alter table partner_accounts add column if not exists verify_channel      text;   -- email | sms

-- Look up applicants by email (one partner per email).
create unique index if not exists uniq_partner_email on partner_accounts (lower(email)) where email is not null;
