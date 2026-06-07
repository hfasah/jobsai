-- The ATS scan writes a 2-sentence verdict to ats_scans.summary, but the column
-- was never added (030's ats_summary is on the separate enterprise table). Add it.
alter table ats_scans add column if not exists summary text;
