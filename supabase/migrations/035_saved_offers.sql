-- Run in Supabase Dashboard → SQL Editor → New Query
-- Members can save transfer and spending bonuses to come back to. A save is a
-- private row per member; the list itself is read through the offers API, which
-- only returns offers that are still live.

CREATE TABLE IF NOT EXISTS public.saved_offers (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_table TEXT NOT NULL CHECK (offer_table IN ('transfer_bonuses', 'spending_bonuses')),
  -- Not a foreign key (it points at one of two tables): a deleted offer simply drops out of the list
  offer_id    UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, offer_table, offer_id)
);

CREATE INDEX IF NOT EXISTS saved_offers_user_recent_idx ON public.saved_offers (user_id, created_at DESC);

ALTER TABLE public.saved_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_offers_own" ON public.saved_offers;
CREATE POLICY "saved_offers_own" ON public.saved_offers
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- An offer is live through its end date. The public read policies compared the
-- date to NOW(), which is midnight at the start of that day, so an offer
-- vanished a day early and "ends today" was never shown.
DROP POLICY IF EXISTS "transfer_bonuses_public_read" ON public.transfer_bonuses;
CREATE POLICY "transfer_bonuses_public_read" ON public.transfer_bonuses
  FOR SELECT
  USING (active = true AND end_date >= CURRENT_DATE);

DROP POLICY IF EXISTS "spending_bonuses_public_read" ON public.spending_bonuses;
CREATE POLICY "spending_bonuses_public_read" ON public.spending_bonuses
  FOR SELECT
  USING (active = true AND end_date >= CURRENT_DATE);
