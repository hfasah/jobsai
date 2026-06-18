-- Drop the demo-bookings table. The self-serve demo wizard was replaced by the
-- LeadConnector calendar embed (bookings now live in GoHighLevel), so nothing
-- writes to this table anymore. Indexes are dropped automatically with it.

drop table if exists enterprise_demo_bookings;
