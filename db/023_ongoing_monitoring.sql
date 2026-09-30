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

GRANT SELECT, INSERT, UPDATE, DELETE ON customer_monitoring_events TO mizan_app;
