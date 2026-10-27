-- Run in Supabase Dashboard → SQL Editor → New Query
-- Member-created offers now carry the same structured fields as the admin
-- offer editor (issuer, partner / merchant, bonus, cards, dates…), so an admin
-- can publish one to the catalog without re-typing it. The flat text columns
-- stay: they are derived from `details` on insert, and the feed, search and
-- legacy rows keep reading them.

ALTER TABLE public.board_member_offers
  ADD COLUMN IF NOT EXISTS details JSONB;

-- Spending offers map to the same labels the catalog uses on the board
ALTER TABLE public.board_member_offers DROP CONSTRAINT IF EXISTS board_member_offers_type_check;
ALTER TABLE public.board_member_offers ADD CONSTRAINT board_member_offers_type_check CHECK (type IN (
  'TRANSFER BONUS', 'STATUS MATCH', 'PARTNER DEAL', 'STATEMENT CREDIT',
  'SIGN-UP BONUS', 'FREE NIGHT', 'PACKAGE', 'CASH BACK', 'POINTS BONUS'));
