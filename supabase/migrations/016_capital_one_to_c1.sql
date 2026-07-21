-- Run in Supabase Dashboard → SQL Editor → New Query
-- Rename PortalId 'capital_one' → 'c1' for transfer_partners.portal_id, to
-- match the `issuer` convention already used by hotel_collections and every
-- portal-sync schema. hotel_collections.issuer already uses 'c1' — no change
-- needed there.

ALTER TABLE public.transfer_partners
  DROP CONSTRAINT transfer_partners_portal_id_check;

UPDATE public.transfer_partners
  SET portal_id = 'c1'
  WHERE portal_id = 'capital_one';

ALTER TABLE public.transfer_partners
  ADD CONSTRAINT transfer_partners_portal_id_check
  CHECK (portal_id IN ('chase', 'amex', 'c1', 'bilt', 'citi'));
