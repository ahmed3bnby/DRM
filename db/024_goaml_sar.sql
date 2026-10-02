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

-- Regulatory filings are append-only: once submitted to the FIU they must not
-- be edited or deleted by the application (same principle as audit_events). The
-- app only ever inserts and reads them. Cascade deletion when a customer/org is
-- removed still works — referential actions run with the FK's own privileges and
-- do not require DELETE to be granted here.
GRANT SELECT, INSERT ON customer_sar_reports TO mizan_app;
-- Converge existing databases that were granted the wider set before.
REVOKE UPDATE, DELETE, TRUNCATE ON customer_sar_reports FROM mizan_app;

-- Tenant isolation: enforce organization scoping at the database level.
ALTER TABLE customer_sar_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sar_reports FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_sar_reports_tenant ON customer_sar_reports;
CREATE POLICY customer_sar_reports_tenant ON customer_sar_reports
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
