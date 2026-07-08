-- Add tags array and minimum_nights to offer tables.
ALTER TABLE transfer_bonuses ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE spending_bonuses ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE spending_bonuses ADD COLUMN IF NOT EXISTS minimum_nights INTEGER NULL;
