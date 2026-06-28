-- Pay period for a job's salary range — hourly contracts vs annual salaries etc.
-- (salary_currency already exists from migration 026.)
alter table enterprise_jobs add column if not exists salary_period text not null default 'year';
