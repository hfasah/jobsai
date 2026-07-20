-- 178_retention_offer.sql
-- Cancel-flow retention ladder (30% off 2mo → 50% off 2mo final offer).
-- Tracks when a customer last took a retention discount so the ladder is
-- offered at most once per 12 months (anti-gaming guard).

alter table user_billing
  add column if not exists retention_offer_at timestamptz,
  add column if not exists retention_offer_coupon text;
