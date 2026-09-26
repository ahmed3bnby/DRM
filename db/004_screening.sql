-- Customer identity fields that let screening use more than the name.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS date_of_birth text NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS identifier text NOT NULL DEFAULT '';

-- Screening may now record an outcome. risk_level stays locked to 'unassessed':
-- a screening hit is match evidence, not the customer's risk rating (analyst/P06 owns that).
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_screening_status_check;
ALTER TABLE customers ADD CONSTRAINT customers_screening_status_check
  CHECK (screening_status IN ('not_run','no_match','screened','potential_match'));

CREATE TABLE IF NOT EXISTS customer_screenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  run_by uuid NOT NULL REFERENCES users(id),
  overall_band text NOT NULL,
  flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  match_count integer NOT NULL DEFAULT 0,
  relevant_count integer NOT NULL DEFAULT 0,
  used_dob boolean NOT NULL DEFAULT false,
  used_identifier boolean NOT NULL DEFAULT false,
  top_matches jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_screenings_customer ON customer_screenings(customer_id, created_at DESC);

ALTER TABLE customer_screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_screenings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS screenings_tenant ON customer_screenings;
CREATE POLICY screenings_tenant ON customer_screenings
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
GRANT SELECT, INSERT ON customer_screenings TO mizan_app;
