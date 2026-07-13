-- Sender lock: the mailbox a candidate is assigned to for the whole sequence.
-- Set on the first send; every later step must come from the SAME sender so we
-- never rotate identities mid-conversation. Null = not yet locked (first send
-- will claim + persist).
alter table enterprise_campaign_enrollments
  add column if not exists mailbox_id uuid references sending_mailboxes(id) on delete set null;
