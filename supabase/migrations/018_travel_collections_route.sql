-- Run in Supabase Dashboard
-- Add route (origin/destination) columns to travel_collections so flight-type
-- Points Boost offers can be matched to the specific route they apply to,
-- not just the airline. Null on both = wildcard (matches any route for that
-- airline), preserving current behavior for un-migrated rows.

ALTER TABLE travel_collections
  ADD COLUMN origin_iata_code TEXT,
  ADD COLUMN destination_iata_code TEXT;
