-- Third AI SDR reply mode: 'manual'. Replies are still classified + routed, but
-- the SDR does NOT draft — a recruiter writes every response. (draft = AI drafts
-- for approval; auto = AI sends automatically.)
alter table enterprise_campaigns drop constraint if exists enterprise_campaigns_ai_sdr_mode_check;
alter table enterprise_campaigns add constraint enterprise_campaigns_ai_sdr_mode_check
  check (ai_sdr_mode in ('manual', 'draft', 'auto'));
