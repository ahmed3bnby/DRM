-- Searches before the latest quota save do not reduce the new allowance.
ALTER TABLE users ADD COLUMN IF NOT EXISTS quota_anchor integer NOT NULL DEFAULT 0;
