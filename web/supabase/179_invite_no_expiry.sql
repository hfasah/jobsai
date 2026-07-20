-- 179_invite_no_expiry.sql
-- Client invite links must not expire (business decision 2026-07-19: a client
-- opening the welcome email three weeks later should still get in). The old
-- 7-day column default silently killed every link created without an explicit
-- expires_at (org-creation + team invites), and the owner re-invite route
-- reused stale tokens past their date.

-- New default: effectively never.
alter table enterprise_invitations
  alter column expires_at set default (now() + interval '100 years');

-- Revive every pending (un-accepted) invitation, including links already sent —
-- the same URL a client received weeks ago starts working again.
update enterprise_invitations
  set expires_at = now() + interval '100 years'
  where accepted_at is null;
