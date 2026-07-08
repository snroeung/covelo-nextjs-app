-- Add description field to transfer and spending bonus offers.
ALTER TABLE transfer_bonuses ADD COLUMN IF NOT EXISTS description TEXT NULL;
ALTER TABLE spending_bonuses ADD COLUMN IF NOT EXISTS description TEXT NULL;
