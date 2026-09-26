-- 017: per-organization plan, premium feature flags, and team member limit.
-- The platform owner (super admin) toggles premium features per organization
-- from /platform. Base features (search, sources, customer profiles/screening,
-- reports, capped team) are always on; only the flags below gate premium ones.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'base';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS member_limit int NOT NULL DEFAULT 5;
GRANT UPDATE (plan, features, member_limit, name) ON organizations TO mizan_app;
