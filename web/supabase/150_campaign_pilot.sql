-- Pilot launch: send to the first N candidates, review performance, then
-- release the rest. pilot_size = the initial batch (null = full send);
-- pilot_released flips true once the remainder has been let go.
alter table enterprise_campaigns
  add column if not exists pilot_size     int,
  add column if not exists pilot_released boolean not null default false;
