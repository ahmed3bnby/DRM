-- Migration 024: UAE FIU goAML SAR / STR Reporting
CREATE TABLE IF NOT EXISTS customer_sar_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reference_number text NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('SAR', 'STR')),
  reason_category text NOT NULL,
  narrative text NOT NULL,
  action_taken text NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'archived')),
  fiu_payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS customer_sar_reports_lookup ON customer_sar_reports(organization_id, customer_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON customer_sar_reports TO mizan_app;
