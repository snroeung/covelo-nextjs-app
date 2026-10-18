-- Run in Supabase Dashboard → SQL Editor → New Query
-- Catch-up: transfer_bonuses.country and spending_bonuses.country exist on
-- covelo-dev (added by hand) and the offer admin schema writes them, but no
-- migration ever created them — so a database built from migrations alone
-- rejects every admin offer insert. IF NOT EXISTS makes this a no-op where the
-- column is already there, with the definition dev already has.

ALTER TABLE public.transfer_bonuses ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'US';
ALTER TABLE public.spending_bonuses ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'US';
