-- Store the candidate's location (city / region / country) parsed from the
-- résumé, so it shows as a column and is searchable alongside name/email/phone.
alter table enterprise_applications add column if not exists candidate_location text;
