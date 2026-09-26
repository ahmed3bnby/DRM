-- Account access can be suspended without erasing commercial usage history.
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
CREATE INDEX IF NOT EXISTS users_org_role ON users(organization_id, role);
GRANT DELETE ON users TO mizan_app;
