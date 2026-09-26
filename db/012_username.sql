-- Readable team URLs: a per-org unique username (derived from the email local part), so member
-- pages are /team/<username> instead of /team/<uuid>.
ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;

-- Backfill from the email local part, de-duplicating within each organization.
WITH ranked AS (
  SELECT id,
    regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._-]', '', 'g') AS base,
    row_number() OVER (PARTITION BY organization_id, regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._-]', '', 'g') ORDER BY id) AS rn
  FROM users WHERE username IS NULL OR username = ''
)
UPDATE users u SET username = CASE WHEN r.rn = 1 THEN r.base ELSE r.base || '-' || r.rn::text END
FROM ranked r WHERE u.id = r.id;

UPDATE users SET username = 'user-' || left(id::text, 8) WHERE username IS NULL OR username = '';
CREATE UNIQUE INDEX IF NOT EXISTS users_org_username ON users(organization_id, username);
