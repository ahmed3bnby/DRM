import { pool } from './db';
import { PREMIUM_FEATURES } from './features';

// Platform-owner (super admin) operations act ACROSS organizations, so they use
// the base pool without a tenant scope. Only organizations/users are read here
// (neither is row-level-security protected); tenant data is never touched.
export type PlatformOrg = {
  id: string; name: string; reference: string; plan: string;
  features: Record<string, boolean>; member_limit: number; users: number;
};

export async function listAllOrgs(): Promise<PlatformOrg[]> {
  const r = await pool.query(`SELECT o.id,o.name,o.reference,o.plan,o.features,o.member_limit,
    (SELECT count(*)::int FROM users u WHERE u.organization_id=o.id AND u.disabled_at IS NULL) AS users
    FROM organizations o ORDER BY o.name`);
  return r.rows as PlatformOrg[];
}

export async function updateOrgPlan(orgId: string, patch: { features: Record<string, boolean>; member_limit: number; plan: string }) {
  // Whitelist feature keys so only known premium flags are ever stored.
  const features: Record<string, boolean> = {};
  for (const key of PREMIUM_FEATURES) features[key] = patch.features[key] === true;
  const limit = Math.max(1, Math.min(1000, Math.floor(patch.member_limit || 5)));
  const plan = ['base', 'pro', 'enterprise'].includes(patch.plan) ? patch.plan : 'base';
  await pool.query('UPDATE organizations SET features=$2, member_limit=$3, plan=$4 WHERE id=$1',
    [orgId, JSON.stringify(features), limit, plan]);
}
