-- Campaign objective (Setup step of the guided builder): what the campaign is
-- for. Drives copy defaults + reporting. Nullable; existing campaigns unaffected.
alter table enterprise_campaigns
  add column if not exists objective text
    check (objective in ('source', 're_engage', 'promote', 'pipeline'));
