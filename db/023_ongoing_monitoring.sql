-- Ongoing Monitoring fields on customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS monitoring_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_monitored_at timestamptz,
  ADD COLUMN IF NOT EXISTS monitoring_status text NOT NULL DEFAULT 'clear' CHECK (monitoring_status IN ('clear', 'flagged', 'pending_review')),
  ADD COLUMN IF NOT EXISTS monitoring_hit_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS customers_monitoring_idx ON customers (organization_id, monitoring_enabled, last_monitored_at);

-- Ongoing Monitoring alert events table
CREATE TABLE IF NOT EXISTS customer_monitoring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('new_watchlist_hit', 'score_increased', 'adverse_media_hit', 'status_changed')),
  severity text NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  title text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_monitoring_events_lookup ON customer_monitoring_events(organization_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_monitoring_events_unread ON customer_monitoring_events(organization_id, is_read) WHERE NOT is_read;

-- Alerts are an append-only trail; the app inserts them and only updates the
-- is_read flag. DELETE is not granted (nothing deletes alerts directly), so the
-- trail can't be tampered with. Cascade deletion on customer/org removal still
-- works without a DELETE grant (referential actions use the FK's privileges).
GRANT SELECT, INSERT, UPDATE ON customer_monitoring_events TO mizan_app;
-- Converge existing databases that were granted DELETE before.
REVOKE DELETE, TRUNCATE ON customer_monitoring_events FROM mizan_app;

-- Tenant isolation: enforce organization scoping at the database level.
-- The platform owner (Super Admin) may read aggregate alert counts across
-- tenants for the oversight dashboard (see platform.ts / getPlatformChecksSummary),
-- mirroring the search_events policy in 021_quota_history.sql. Writes stay
-- strictly tenant-scoped via WITH CHECK.
ALTER TABLE customer_monitoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_monitoring_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_monitoring_events_tenant ON customer_monitoring_events;
CREATE POLICY customer_monitoring_events_tenant ON customer_monitoring_events
  USING (
    organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.platform_owner', true) = 'true'
  )
  WITH CHECK (
    organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
  );

-- Ongoing Monitoring adds a cross-tenant customer count to the platform owner
-- dashboard, so extend the customers policy to allow platform-owner reads too
-- (counts only; writes remain tenant-scoped). Re-creates the policy from
-- 001_foundation.sql.
DROP POLICY IF EXISTS customers_tenant ON customers;
CREATE POLICY customers_tenant ON customers
  USING (
    organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.platform_owner', true) = 'true'
  )
  WITH CHECK (
    organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
  );
