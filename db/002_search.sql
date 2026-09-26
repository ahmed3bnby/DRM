CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE IF NOT EXISTS source_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL, sha256 text NOT NULL, retrieved_at timestamptz NOT NULL,
 parser_version text NOT NULL, source_url text NOT NULL, record_count integer NOT NULL CHECK(record_count>0), active boolean NOT NULL DEFAULT false,
 UNIQUE(code,sha256,parser_version)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_source ON source_versions(code) WHERE active;
CREATE TABLE IF NOT EXISTS source_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version_id uuid NOT NULL REFERENCES source_versions(id),source_record_id text NOT NULL,
 name text NOT NULL, kind text NOT NULL, aliases jsonb NOT NULL, details jsonb NOT NULL,
 UNIQUE(version_id,source_record_id)
);
CREATE TABLE IF NOT EXISTS source_names(record_id uuid NOT NULL REFERENCES source_records(id),name text NOT NULL,normalized text NOT NULL,PRIMARY KEY(record_id,name));
CREATE INDEX IF NOT EXISTS source_names_trgm ON source_names USING gin(normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS source_records_version ON source_records(version_id);
GRANT SELECT ON source_versions,source_records,source_names TO mizan_app;
