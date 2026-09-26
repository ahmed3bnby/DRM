-- A review case tracks ownership and workflow for a material screening signal.
-- The evidence and every analyst decision remain immutable in the screening tables.
CREATE TABLE IF NOT EXISTS review_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  screening_id uuid NOT NULL REFERENCES customer_screenings(id),
  priority text NOT NULL CHECK (priority IN ('high','medium','low')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','resolved')),
  assigned_to uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  assigned_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(screening_id)
);
CREATE INDEX IF NOT EXISTS review_cases_work_queue ON review_cases(organization_id,status,priority,created_at);
CREATE INDEX IF NOT EXISTS review_cases_assignee ON review_cases(assigned_to,status,updated_at DESC);
ALTER TABLE review_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_cases FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS review_cases_tenant ON review_cases;
CREATE POLICY review_cases_tenant ON review_cases
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON review_cases TO mizan_app;

-- Make historic relevant screenings visible immediately after this feature is installed.
INSERT INTO review_cases (organization_id,customer_id,screening_id,priority,status,created_at,updated_at)
SELECT organization_id, customer_id, id,
  CASE WHEN overall_band='high' THEN 'high' WHEN overall_band='medium' THEN 'medium' ELSE 'low' END,
  'open', created_at, created_at
FROM customer_screenings WHERE relevant_count > 0
ON CONFLICT (screening_id) DO NOTHING;
