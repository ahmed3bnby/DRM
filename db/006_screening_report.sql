-- Snapshot of the source list versions that were active when the screening ran, so the report
-- is reproducible: we can show exactly which lists (and which fingerprints/dates) were searched.
ALTER TABLE customer_screenings ADD COLUMN IF NOT EXISTS source_versions jsonb NOT NULL DEFAULT '[]'::jsonb;
