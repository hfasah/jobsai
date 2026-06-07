-- Custom portal title shown as the bold headline on each enterprise's branded
-- home page at /e/{slug}. Optional — falls back to "<Name> HR Management &
-- Recruitment Portal" when blank.
alter table enterprise_orgs add column if not exists portal_title text;

-- Backfill existing orgs (incl. test/demo accounts used for sales & marketing)
-- with the sensible default so every portal is presentable out of the box.
-- Clients can override this during onboarding.
update enterprise_orgs
set portal_title = name || ' HR Management & Recruitment Portal'
where portal_title is null or portal_title = '';
