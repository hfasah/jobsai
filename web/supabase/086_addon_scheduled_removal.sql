-- 086: add-on "scheduled for removal" — stays active until the renewal date.
alter table org_addons add column if not exists removal_at timestamptz;

-- Allow the scheduled_removal status.
alter table org_addons drop constraint if exists org_addons_status_check;
alter table org_addons add constraint org_addons_status_check
  check (status in ('active', 'scheduled_removal', 'canceled'));
