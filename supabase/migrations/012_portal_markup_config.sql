-- Run in Supabase Dashboard → SQL Editor → New Query
-- Audit/ops table only — not queried at runtime. Tracks when the portal markup
-- constants in lib/points/portalMarkup.ts were last calibrated and surfaces
-- overdue reviews. When quarterly calibration (PM.3) runs: update `multiplier`
-- and `markup_update_date` here, then update the matching constant in
-- portalMarkup.ts.

CREATE TABLE public.portal_markup_config (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  markup_type        TEXT NOT NULL CHECK (markup_type IN ('flight', 'hotel')),
  portal             TEXT NOT NULL,
  multiplier         NUMERIC(6, 4) NOT NULL,
  source             TEXT NOT NULL,
  markup_update_date DATE NOT NULL,
  next_review_date   DATE GENERATED ALWAYS AS (markup_update_date + INTERVAL '90 days') STORED,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Ops-only table: admins have full access, no public read
ALTER TABLE public.portal_markup_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_markup_config_admin_all" ON public.portal_markup_config
  FOR ALL
  USING  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

INSERT INTO public.portal_markup_config
  (markup_type, portal, multiplier, source, markup_update_date, notes)
VALUES
  ('flight','capitalOne',1.0076,'TPG Nov 2025 (804 data points)','2025-11-05','Confirmed June 2026'),
  ('flight','chase',     1.0594,'TPG Nov 2025 (804 data points)','2025-11-05',NULL),
  ('flight','bilt',      1.0650,'TPG Nov 2025 (804 data points)','2025-11-05','Smaller sample; validate quarterly'),
  ('flight','amex',      1.1032,'TPG Nov 2025 (804 data points)','2025-11-05','Partially due to no basic economy fares'),
  ('flight','citi',      1.1459,'TPG Nov 2025 (804 data points)','2025-11-05',NULL),
  ('hotel', 'capitalOne',1.0080,'AwardWallet Aug 2025 (4 properties)','2025-08-26',NULL),
  ('hotel', 'chase',     1.0600,'AwardWallet Aug 2025 (4 properties)','2025-08-26',NULL),
  ('hotel', 'bilt',      1.0700,'AwardWallet Aug 2025 (4 properties)','2025-08-26','Fewer room options in Bilt portal'),
  ('hotel', 'amex',      1.1000,'AwardWallet Aug 2025 (4 properties)','2025-08-26',NULL),
  ('hotel', 'citi',      1.1500,'AwardWallet Aug 2025 (4 properties)','2025-08-26',NULL);

-- Overdue-calibration query (for an internal admin view):
--   SELECT portal, markup_type, multiplier, markup_update_date, next_review_date
--   FROM portal_markup_config
--   WHERE next_review_date < CURRENT_DATE
--   ORDER BY next_review_date ASC;
