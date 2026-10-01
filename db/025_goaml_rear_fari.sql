-- Migration 025: Expand goAML report types to support UAE DNFBP mandatory filings (REAR, FARI, DPMSR)
ALTER TABLE customer_sar_reports DROP CONSTRAINT IF EXISTS customer_sar_reports_report_type_check;
ALTER TABLE customer_sar_reports ADD CONSTRAINT customer_sar_reports_report_type_check 
  CHECK (report_type IN ('SAR', 'STR', 'REAR', 'FARI', 'DPMSR', 'HRC', 'AIF'));
