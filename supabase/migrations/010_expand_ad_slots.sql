-- Expand sponsored_ads slot CHECK constraint to include new placement slots
ALTER TABLE public.sponsored_ads
  DROP CONSTRAINT IF EXISTS sponsored_ads_slot_check;

ALTER TABLE public.sponsored_ads
  ADD CONSTRAINT sponsored_ads_slot_check
  CHECK (slot IN ('hero', 'grid_inline', 'below_grid', 'sidebar', 'flights_inline', 'hotels_inline', 'planner_native', 'trip_strip'));
