-- The AI SDR per-thread reply cap defaulted to 2 — a real conversation
-- (details → times → confirmation) burns that before the booking happens,
-- and the SDR goes silent mid-conversation. 10 still stops bot↔bot loops
-- while letting a normal scheduling exchange complete.
alter table enterprise_campaigns
  alter column ai_sdr_max_replies set default 10;

-- Unlock existing campaigns still on the old conservative default.
update enterprise_campaigns
  set ai_sdr_max_replies = 10
  where ai_sdr_max_replies = 2;
