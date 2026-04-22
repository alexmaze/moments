-- Add baby_birthday column to spaces table (for baby-type spaces)
ALTER TABLE IF EXISTS spaces ADD COLUMN IF NOT EXISTS baby_birthday date;
