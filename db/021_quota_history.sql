-- Quota History and Credit Audit Trail
-- Tracks all quota allocations, credits, top-ups, and adjustments with timestamp and delta.

CREATE TABLE IF NOT EXISTS quota_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name text NOT NULL DEFAULT '',
  previous_quota integer,
  new_quota integer,
  delta integer,
  action_type text NOT NULL DEFAULT 'quota_updated', -- 'user_created', 'quota_updated', 'quota_credited', 'role_changed'
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quota_history_user_idx ON quota_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quota_history_org_idx ON quota_history(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quota_history_created_idx ON quota_history(created_at DESC);

GRANT SELECT, INSERT ON quota_history TO mizan_app;

-- Allow platform owners (Super Admins) to read aggregate search_events across tenants
DROP POLICY IF EXISTS search_events_tenant ON search_events;
CREATE POLICY search_events_tenant ON search_events
  USING (
    organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.platform_owner', true) = 'true'
  )
  WITH CHECK (
    organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
  );
