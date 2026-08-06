-- Bilt Rent Day promos let members transfer rent-earned points into a
-- partner program AND count that transfer toward elite/award status with
-- the partner (e.g. World of Hyatt night credits) — existing bonus rows
-- only model a points bonus_pct, so add a flag for the status-transfer case.
ALTER TABLE public.transfer_bonuses
  ADD COLUMN IF NOT EXISTS for_status_transfer BOOLEAN NOT NULL DEFAULT false;
