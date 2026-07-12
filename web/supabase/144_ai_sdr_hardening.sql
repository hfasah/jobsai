-- AI SDR auto-send hardening: a workspace-wide kill switch and provenance on
-- outbound messages so AI-sent replies are visibly labeled in the thread.

-- Kill switch: when true, no AI SDR reply is drafted or sent for the whole org,
-- regardless of per-campaign config. Off by default.
alter table enterprise_orgs
  add column if not exists ai_sdr_paused boolean not null default false;

-- Provenance on the message log: 'ai_sdr' marks a reply the AI SDR sent
-- (null = human / system as before).
alter table enterprise_messages
  add column if not exists sent_via text;
