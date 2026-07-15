-- The role a campaign is recruiting for. The wizard's "Target role" field was
-- only used to suggest the campaign name and then discarded — so {{job_title}}
-- fell back to filler ("our the role role at ..."). Persist it and use it in
-- sends, previews, and test emails whenever an enrollment has no job attached.
alter table enterprise_campaigns
  add column if not exists role_title text;
