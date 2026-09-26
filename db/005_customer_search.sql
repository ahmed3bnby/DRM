-- Derived search key only. Original customer name is preserved.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS normalized_name text NOT NULL DEFAULT '';
