-- Transfer bonuses can be gated to a specific card product (e.g. a business
-- card variant), not just the issuer — mirrors spending_bonuses.card_ids.
ALTER TABLE public.transfer_bonuses ADD COLUMN card_ids TEXT[] NOT NULL DEFAULT '{}';
