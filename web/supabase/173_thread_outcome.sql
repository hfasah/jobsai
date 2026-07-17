-- 173: thread outcome chip + per-thread AI SDR gate (competitor-style statuses).
-- outcome: 'meeting_booked' (auto-set when the SDR books a calendar slot),
--          'manual_reply'   (auto-set when a human replies from the inbox),
--          'ai_sdr_disabled' (auto-set when the AI hands off a question it
--                             cannot answer; also settable manually), or null.
-- ai_sdr_disabled: hard gate — no auto-replies on this thread while true.
alter table inbox_threads add column if not exists outcome text;
alter table inbox_threads add column if not exists ai_sdr_disabled boolean not null default false;
