-- Migration 026: SAR/STR retention.
-- goAML SAR/STR reports are statutory regulatory filings that must be retained for the
-- legal period (UAE AML law / FATF Recommendation 11 = at least 5 years) even after the
-- related customer record is deleted. Each report already carries a full customer snapshot
-- in fiu_payload.customerSnapshot, so on customer deletion we KEEP the report and null the
-- link (instead of cascading the delete, which previously destroyed the filing).
ALTER TABLE customer_sar_reports ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE customer_sar_reports DROP CONSTRAINT IF EXISTS customer_sar_reports_customer_id_fkey;
ALTER TABLE customer_sar_reports ADD CONSTRAINT customer_sar_reports_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- Flag retained-but-orphaned filings for the platform/audit view.
CREATE INDEX IF NOT EXISTS customer_sar_reports_orphaned ON customer_sar_reports(organization_id, created_at DESC) WHERE customer_id IS NULL;
