-- Per-user search quota (subscription-style). NULL = unlimited (e.g. admins); a number caps searches.
ALTER TABLE users ADD COLUMN IF NOT EXISTS search_quota integer;

-- One row per distinct search/screening a user performed (deduped by query_key), so quota = rows < quota.
CREATE TABLE IF NOT EXISTS search_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  query_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, query_key)
);
CREATE INDEX IF NOT EXISTS search_events_user ON search_events(user_id);
ALTER TABLE search_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS search_events_tenant ON search_events;
CREATE POLICY search_events_tenant ON search_events
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

-- Admins manage their org's users through the app role; org scoping is enforced in the query layer.
GRANT INSERT, UPDATE ON users TO mizan_app;
GRANT SELECT, INSERT ON search_events TO mizan_app;
