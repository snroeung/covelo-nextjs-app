-- Run in Supabase Dashboard → SQL Editor → New Query
-- Extends portal_markup_config (audit/ops only — not queried at runtime) to
-- also track cents-per-point (CPP) redemption-rate calibration alongside the
-- existing price-markup rows. Chase Travel's Points Boost change (2025-06-23)
-- means chase_reserve/chase_preferred now have two CPP tiers — legacy fixed
-- rate (grandfathered until lib/points/types.ts CHASE_LEGACY_RATE_SUNSET_DATE)
-- and the new baseline rate. When either changes, update CHASE_LEGACY_CPP /
-- PORTAL_CPP in lib/points/types.ts and the matching row(s) here.

ALTER TABLE public.portal_markup_config
  ADD COLUMN metric_type TEXT NOT NULL DEFAULT 'price_markup'
    CHECK (metric_type IN ('price_markup', 'cpp')),
  ADD COLUMN card_id TEXT,
  ADD CONSTRAINT portal_markup_config_cpp_requires_card_id
    CHECK (metric_type <> 'cpp' OR card_id IS NOT NULL);

INSERT INTO public.portal_markup_config
  (markup_type, portal, multiplier, source, markup_update_date, notes, metric_type, card_id)
VALUES
  ('hotel', 'chase', 1.5000, 'Chase Travel legacy 50% portal bonus (pre-2025-06-23 cardholders)', '2025-06-23', 'Legacy rate; sunsets per CHASE_LEGACY_RATE_SUNSET_DATE (2027-10-26)', 'cpp', 'chase_reserve'),
  ('flight','chase', 1.5000, 'Chase Travel legacy 50% portal bonus (pre-2025-06-23 cardholders)', '2025-06-23', 'Legacy rate; sunsets per CHASE_LEGACY_RATE_SUNSET_DATE (2027-10-26)', 'cpp', 'chase_reserve'),
  ('hotel', 'chase', 1.2500, 'Chase Travel legacy 25% portal bonus (pre-2025-06-23 cardholders)', '2025-06-23', 'Legacy rate; sunsets per CHASE_LEGACY_RATE_SUNSET_DATE (2027-10-26)', 'cpp', 'chase_preferred'),
  ('flight','chase', 1.2500, 'Chase Travel legacy 25% portal bonus (pre-2025-06-23 cardholders)', '2025-06-23', 'Legacy rate; sunsets per CHASE_LEGACY_RATE_SUNSET_DATE (2027-10-26)', 'cpp', 'chase_preferred'),
  ('hotel', 'chase', 1.0000, 'Chase Travel Points Boost baseline (post-2025-06-23 cardholders)', '2025-06-23', 'Baseline only; actual per-booking boost up to 2.0 not modeled', 'cpp', 'chase_reserve'),
  ('flight','chase', 1.0000, 'Chase Travel Points Boost baseline (post-2025-06-23 cardholders)', '2025-06-23', 'Baseline only; actual per-booking boost up to 2.0 not modeled', 'cpp', 'chase_reserve'),
  ('hotel', 'chase', 1.0000, 'Chase Travel Points Boost baseline (post-2025-06-23 cardholders)', '2025-06-23', 'Baseline only; actual per-booking boost up to 1.75 not modeled', 'cpp', 'chase_preferred'),
  ('flight','chase', 1.0000, 'Chase Travel Points Boost baseline (post-2025-06-23 cardholders)', '2025-06-23', 'Baseline only; actual per-booking boost up to 1.75 not modeled', 'cpp', 'chase_preferred');

-- CPP calibration lookup (for an internal admin view):
--   SELECT card_id, markup_type, multiplier AS cpp, notes
--   FROM portal_markup_config
--   WHERE metric_type = 'cpp'
--   ORDER BY card_id, markup_type;
