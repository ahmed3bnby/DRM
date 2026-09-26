-- Import change log: one row per import attempt that reached a decision.
-- Answers "which lists updated, when, and by how much" for manual and scheduled runs.
CREATE TABLE IF NOT EXISTS source_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  version_id uuid REFERENCES source_versions(id),
  outcome text NOT NULL CHECK (outcome IN ('imported','unchanged')),
  record_count integer NOT NULL DEFAULT 0,
  added integer NOT NULL DEFAULT 0,
  removed integer NOT NULL DEFAULT 0,
  sha256 text NOT NULL,
  prev_sha256 text,
  upstream_version text,
  upstream_last_change text,
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS source_imports_code_time ON source_imports(code, imported_at DESC);
GRANT SELECT ON source_imports TO mizan_app;
