-- Run in Supabase Dashboard → SQL Editor → New Query
-- Adds public read access to sponsored_ads for active, in-window ads.
-- This allows the public offers page to fetch active ads without the service role key.

CREATE POLICY "sponsored_ads_public_read" ON public.sponsored_ads
  FOR SELECT
  USING (
    active = true
    AND (start_date IS NULL OR start_date <= CURRENT_DATE)
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  );
