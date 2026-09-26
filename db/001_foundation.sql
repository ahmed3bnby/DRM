CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY, name text NOT NULL, reference text NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id),
  email text NOT NULL UNIQUE, display_name text NOT NULL,
  password_hash text NOT NULL, role text NOT NULL CHECK (role IN ('admin','analyst','viewer'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_lookup ON login_attempts(email_key, created_at);
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
  reference text NOT NULL, name text NOT NULL CHECK (length(name) BETWEEN 2 AND 160),
  entity_type text NOT NULL CHECK (entity_type IN ('individual','company')),
  country text NOT NULL, email text, industry text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','awaiting_information')),
  screening_status text NOT NULL DEFAULT 'not_run' CHECK (screening_status = 'not_run'),
  risk_level text NOT NULL DEFAULT 'unassessed' CHECK (risk_level = 'unassessed'),
  created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id, reference)
);
CREATE INDEX IF NOT EXISTS customers_org_created ON customers(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS customers_org_name ON customers(organization_id, name);
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
  actor_id uuid NOT NULL REFERENCES users(id), customer_id uuid REFERENCES customers(id),
  action text NOT NULL, summary text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_org_created ON audit_events(organization_id,created_at DESC);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customers_tenant ON customers;
CREATE POLICY customers_tenant ON customers
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
DROP POLICY IF EXISTS audit_tenant ON audit_events;
CREATE POLICY audit_tenant ON audit_events
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM mizan_app;
GRANT USAGE ON SCHEMA public TO mizan_app;
GRANT SELECT ON organizations, users TO mizan_app;
GRANT SELECT, INSERT, DELETE ON sessions TO mizan_app;
GRANT SELECT, INSERT ON login_attempts TO mizan_app;
GRANT USAGE ON SEQUENCE login_attempts_id_seq TO mizan_app;
GRANT SELECT, INSERT, UPDATE ON customers TO mizan_app;
GRANT SELECT, INSERT ON audit_events TO mizan_app;
