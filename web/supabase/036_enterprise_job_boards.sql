-- Track which external job boards an org has connected its feed to.
alter table enterprise_orgs
  add column if not exists connected_boards text[] default '{}';
