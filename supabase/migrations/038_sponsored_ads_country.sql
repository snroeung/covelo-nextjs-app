-- Run in Supabase Dashboard → SQL Editor → New Query
-- Catch-up: sponsored_ads.country. The admin ad form always sends it (default
-- 'US' — server/routers/offers.ts, create/update ad) and the offers read path
-- returns it, but no migration ever created the column, so a database built
-- from migrations alone rejects every ad publish with "Could not find the
-- 'country' column of 'sponsored_ads' in the schema cache". 030 did the same
-- for transfer_bonuses and spending_bonuses and missed this table.
-- IF NOT EXISTS makes this a no-op where the column was added by hand, with
-- the same definition 030 uses.

ALTER TABLE public.sponsored_ads ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'US';

-- Make PostgREST pick the new column up now instead of at its next cache refresh
NOTIFY pgrst, 'reload schema';
