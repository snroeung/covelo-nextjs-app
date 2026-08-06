-- Run in Supabase Dashboard → SQL Editor → New Query
-- Some spending_bonuses sources (e.g. Capital One's shopping-portal offers)
-- are evergreen — the issuer explicitly does not publish an expiration date.
-- transfer_bonuses are always time-limited promos, so that column stays
-- NOT NULL; only spending_bonuses.end_date is relaxed here.

ALTER TABLE public.spending_bonuses ALTER COLUMN end_date DROP NOT NULL;

DROP POLICY IF EXISTS "spending_bonuses_public_read" ON public.spending_bonuses;
CREATE POLICY "spending_bonuses_public_read" ON public.spending_bonuses
  FOR SELECT
  USING (
    active = true
    AND (end_date IS NULL OR end_date > NOW())
  );
