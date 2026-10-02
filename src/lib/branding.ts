import { withTenant, pool } from './db';
import type { Actor } from './auth';
import { type OrganizationBranding, DEFAULT_BRANDING } from './branding-types';

export * from './branding-types';

export async function getOrganizationBranding(organizationId: string): Promise<OrganizationBranding> {
  try {
    const res = await pool.query(
      `SELECT features FROM organizations WHERE id = $1`,
      [organizationId]
    );
    if (res.rowCount && res.rows[0].features?.branding) {
      return { ...DEFAULT_BRANDING, ...res.rows[0].features.branding };
    }
    return DEFAULT_BRANDING;
  } catch (err) {
    console.error('Failed to get organization branding:', err);
    return DEFAULT_BRANDING;
  }
}

export async function saveOrganizationBranding(
  actor: Pick<Actor, 'organizationId' | 'role'>,
  branding: Partial<OrganizationBranding>
): Promise<OrganizationBranding> {
  if (actor.role !== 'admin') {
    throw new Error('FORBIDDEN: Only organization admins can configure custom branding.');
  }

  return withTenant(actor.organizationId, async (db) => {
    const res = await db.query(
      `SELECT features FROM organizations WHERE id = $1`,
      [actor.organizationId]
    );
    const currentFeatures = res.rows[0]?.features || {};
    const updatedBranding = {
      ...(currentFeatures.branding || DEFAULT_BRANDING),
      ...branding,
      enabled: true,
    };

    const updatedFeatures = {
      ...currentFeatures,
      branding: updatedBranding,
    };

    await db.query(
      `UPDATE organizations SET features = $2, updated_at = now() WHERE id = $1`,
      [actor.organizationId, JSON.stringify(updatedFeatures)]
    );

    return updatedBranding;
  });
}
