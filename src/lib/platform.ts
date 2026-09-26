import { pool } from './db';
import { PREMIUM_FEATURES } from './features';
import { platformOwnerEmails, platformOwnerIds } from './platform-access';

// Platform-owner (super admin) operations act ACROSS organizations, so they use
// the base pool without a tenant scope. Only organizations/users are read here
// (neither is row-level-security protected); tenant data is never touched.
export type PlatformOrg = {
  id: string; name: string; reference: string; plan: string;
  features: Record<string, boolean>; member_limit: number; users: number;
};

export async function listAllOrgs(): Promise<PlatformOrg[]> {
  const hiddenEmails = platformOwnerEmails().map(e => e.toLowerCase());
  const hiddenIds = platformOwnerIds();
  const r = await pool.query(`SELECT o.id,o.name,o.reference,o.plan,o.features,o.member_limit,
    (SELECT count(*)::int FROM users u 
     WHERE u.organization_id=o.id 
       AND u.disabled_at IS NULL 
       AND NOT (lower(u.email) = ANY($1::text[])) 
       AND NOT (u.id = ANY($2::uuid[]))) AS users
    FROM organizations o ORDER BY o.name`, [hiddenEmails, hiddenIds]);
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

export type SystemLockdown = {
  enabled: boolean;
  message_ar?: string;
  message_en?: string;
  updated_at?: string;
  updated_by?: string;
};

export async function getSystemLockdown(): Promise<SystemLockdown> {
  try {
    const res = await pool.query(
      `SELECT value, updated_at, updated_by FROM system_settings WHERE key = 'system_lockdown'`
    );
    if (!res.rowCount || !res.rows[0]) {
      return { enabled: false };
    }
    const row = res.rows[0];
    const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    return {
      enabled: !!val?.enabled,
      message_ar: val?.message_ar || '',
      message_en: val?.message_en || '',
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      updated_by: row.updated_by || undefined,
    };
  } catch (err) {
    console.error('Failed to query system lockdown status:', err);
    return { enabled: false };
  }
}

export async function setSystemLockdown(
  actor: { id: string; email?: string; role: string },
  enabled: boolean,
  messageAr?: string,
  messageEn?: string
) {
  const payload = {
    enabled,
    message_ar: messageAr?.trim() || '',
    message_en: messageEn?.trim() || '',
  };
  await pool.query(
    `INSERT INTO system_settings (key, value, updated_at, updated_by)
     VALUES ('system_lockdown', $1::jsonb, now(), $2)
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [JSON.stringify(payload), actor.id]
  );
}
