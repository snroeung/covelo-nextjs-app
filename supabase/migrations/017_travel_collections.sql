-- Run in Supabase Dashboard
-- Rename hotel_collections -> travel_collections, add flight-type support,
-- bundle in the previously-dropped discount columns, add limited_time_offer signal.

ALTER TABLE hotel_collections RENAME TO travel_collections;

ALTER TABLE travel_collections
  ADD COLUMN type TEXT NOT NULL DEFAULT 'hotel' CHECK (type IN ('hotel', 'flight'));

ALTER TABLE travel_collections
  ADD COLUMN airline_name TEXT,
  ADD COLUMN airline_iata_code TEXT,
  ADD COLUMN cabin_class TEXT CHECK (cabin_class IN ('economy', 'premium_economy', 'business', 'first'));

ALTER TABLE travel_collections
  ADD COLUMN original_amount NUMERIC,
  ADD COLUMN original_unit TEXT CHECK (original_unit IN ('points', 'usd')),
  ADD COLUMN discount_amount NUMERIC,
  ADD COLUMN discount_unit TEXT CHECK (discount_unit IN ('points', 'usd'));

ALTER TABLE travel_collections DROP COLUMN start_date;

ALTER TABLE travel_collections
  ADD COLUMN limited_time_offer BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE transfer_bonuses
  ADD COLUMN limited_time_offer BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE spending_bonuses
  ADD COLUMN limited_time_offer BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS hotel_collections_filter_idx;

CREATE INDEX travel_collections_filter_idx ON travel_collections (issuer, type, active);
