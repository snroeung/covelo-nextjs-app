-- Add spending_minimum to spending_bonuses and expand bonus_type to include dollar_amount.
ALTER TABLE spending_bonuses ADD COLUMN IF NOT EXISTS spending_minimum NUMERIC(10, 2) NULL;

-- Expand bonus_type check constraint to include dollar_amount.
-- Postgres names inline CHECK constraints as {table}_{column}_check.
ALTER TABLE spending_bonuses DROP CONSTRAINT IF EXISTS spending_bonuses_bonus_type_check;
ALTER TABLE spending_bonuses ADD CONSTRAINT spending_bonuses_bonus_type_check
  CHECK (bonus_type IN ('points_multiplier', 'cash_back_pct', 'dollar_amount'));
