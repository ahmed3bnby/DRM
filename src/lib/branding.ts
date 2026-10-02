import { withTenant, pool } from './db';
import type { Actor } from './auth';
import { type OrganizationBranding, DEFAULT_BRANDING } from './branding-types';

export * from './branding-types';

// Logo is stored inline as a data URL inside organizations.features (jsonb) and
// later rendered as <img src> on reports. Only accept image data URLs within a
// size cap — reject external URLs (tracking / IP leak) and oversized blobs that
// would bloat the org row read on every request.
const MAX_LOGO_CHARS = 1_500_000; // ~1.1 MB decoded — ample for a logo
const LOGO_DATA_URL = /^data:image\/(png|jpe?g|svg\+xml|webp|gif);(base64|charset=[\w-]+),/i;

function sanitizeBranding(input: Partial<OrganizationBranding>): Partial<OrganizationBranding> {
  const out: Partial<OrganizationBranding> = { ...input };

  if (typeof out.logoUrl === 'string' && out.logoUrl.trim() !== '') {
    const logo = out.logoUrl.trim();
    if (!LOGO_DATA_URL.test(logo)) {
      throw new Error('شعار غير صالح: يجب أن يكون صورة (PNG/JPG/SVG/WebP) مرفوعة مباشرة، وليس رابطاً خارجياً.');
    }
    if (logo.length > MAX_LOGO_CHARS) {
      throw new Error('حجم الشعار كبير جداً. يرجى رفع صورة أصغر (أقل من 1 ميجابايت).');
    }
    out.logoUrl = logo;
  }

  // primaryColor is injected into report styling; restrict to a hex colour.
  if (typeof out.primaryColor === 'string' && out.primaryColor.trim() !== '') {
    const color = out.primaryColor.trim();
    if (!/^#[0-9a-fA-F]{3,8}$/.test(color)) {
      throw new Error('لون غير صالح: استخدم صيغة hex مثل ‎#0f172a');
    }
    out.primaryColor = color;
  }

  // Cap free-text fields to keep the jsonb row small and bounded.
  const textCaps: Partial<Record<keyof OrganizationBranding, number>> = {
    companyName: 200, licenseNumber: 100, regulatorName: 200,
    contactEmail: 200, contactPhone: 60, customHeaderNote: 1000, customFooterNote: 1000,
  };
  for (const [key, cap] of Object.entries(textCaps) as [keyof OrganizationBranding, number][]) {
    const v = out[key];
    if (typeof v === 'string' && v.length > cap) {
      (out as Record<string, unknown>)[key] = v.slice(0, cap);
    }
  }

  return out;
}

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

  const safeBranding = sanitizeBranding(branding);

  return withTenant(actor.organizationId, async (db) => {
    const res = await db.query(
      `SELECT features FROM organizations WHERE id = $1`,
      [actor.organizationId]
    );
    const currentFeatures = res.rows[0]?.features || {};
    const updatedBranding = {
      ...(currentFeatures.branding || DEFAULT_BRANDING),
      ...safeBranding,
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
