-- Some status-match transfer promos (e.g. Bilt -> Accor Rent Day tiers) have
-- no percentage bonus at all -- they just require transferring at least N
-- points to unlock a partner status tier. bonus_pct was NOT NULL, which
-- forced these status-only rows to be skipped. Make bonus_pct optional and
-- add min_transfer_points to capture the threshold instead.
ALTER TABLE public.transfer_bonuses
  ALTER COLUMN bonus_pct DROP NOT NULL;

ALTER TABLE public.transfer_bonuses
  ADD COLUMN IF NOT EXISTS min_transfer_points INTEGER CHECK (min_transfer_points > 0);
