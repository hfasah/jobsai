-- 120: Org reply-to address for candidate-facing email.
-- Platform-sent candidate emails (interview invites, offers, nurture, reminders)
-- go out branded as the org but from JobsAI's verified sending domain. Without a
-- Reply-To, a candidate's reply hits JobsAI's inbox instead of the org's hiring
-- team. reply_to_email lets each org route replies to their own monitored inbox
-- (e.g. hr@yourcompany.com). Falls back to the existing contact_email when unset.
alter table enterprise_orgs add column if not exists reply_to_email text;
