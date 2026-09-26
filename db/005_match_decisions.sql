-- Analyst decision on an individual screening match. Every decision keeps a mandatory reason
-- and is appended (history preserved); the latest row is the current determination. record_id is
-- the source record as seen at screening time and is intentionally not foreign-keyed to the
-- versioned source_records table (a re-import replaces those rows).
CREATE TABLE IF NOT EXISTS match_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  record_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('confirmed','dismissed','needs_info')),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  decided_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_decisions_lookup ON match_decisions(customer_id, record_id, created_at DESC);

ALTER TABLE match_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_decisions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS match_decisions_tenant ON match_decisions;
CREATE POLICY match_decisions_tenant ON match_decisions
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
GRANT SELECT, INSERT ON match_decisions TO mizan_app;
