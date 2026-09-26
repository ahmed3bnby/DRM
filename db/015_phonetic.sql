-- 015: cross-script phonetic key on source names.
-- Lets a customer name written in Latin match a source entry written in Arabic
-- (and vice versa). Populated from lib/name-normalization.phoneticKey at import
-- time; searched with a trigram index alongside the normalized key.
ALTER TABLE source_names ADD COLUMN IF NOT EXISTS phonetic text;
CREATE INDEX IF NOT EXISTS source_names_phonetic_trgm ON source_names USING gin(phonetic gin_trgm_ops);
