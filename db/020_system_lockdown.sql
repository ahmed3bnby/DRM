-- System Settings and Lockdown / Maintenance Mode
CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Default: system operational (not locked down)
INSERT INTO system_settings (key, value)
VALUES ('system_lockdown', '{"enabled": false, "message_ar": "", "message_en": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON system_settings TO mizan_app;
