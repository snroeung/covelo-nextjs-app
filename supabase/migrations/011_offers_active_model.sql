-- Run in Supabase Dashboard → SQL Editor → New Query
-- Offers (transfer_bonuses, spending_bonuses) move to the same active/date
-- visibility model already used by sponsored_ads, since community-submission
-- review (the reason `status` existed) isn't built yet — every offer today
-- is admin-curated. `status` and the pending-submission insert policies are
-- left in place for when that feature ships; only public read stops
-- depending on `status`.

DROP POLICY IF EXISTS "transfer_bonuses_public_read" ON public.transfer_bonuses;
CREATE POLICY "transfer_bonuses_public_read" ON public.transfer_bonuses
  FOR SELECT
  USING (
    active = true
    AND end_date > NOW()
  );

DROP POLICY IF EXISTS "spending_bonuses_public_read" ON public.spending_bonuses;
CREATE POLICY "spending_bonuses_public_read" ON public.spending_bonuses
  FOR SELECT
  USING (
    active = true
    AND end_date > NOW()
  );
