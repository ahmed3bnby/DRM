import { isPlatformOwner } from './platform-access';
import type { Actor } from './auth';

// Premium features gated per organization by the platform owner (super admin).
// Base features — source search, coverage, customer profiles/screening/risk,
// reports, and a capped team — are always available and are NOT listed here.
export const PREMIUM_FEATURES = ['adverse_media', 'company_search', 'reviews'] as const;
export type PremiumFeature = typeof PREMIUM_FEATURES[number];

export const FEATURE_LABELS: Record<PremiumFeature, { ar: string; en: string }> = {
  adverse_media: { ar: 'الإعلام السلبي', en: 'Adverse media' },
  company_search: { ar: 'بحث الشركات (GLEIF)', en: 'Company search (GLEIF)' },
  reviews: { ar: 'صندوق المراجعات', en: 'Review inbox / workflow' },
};

export const DEFAULT_MEMBER_LIMIT = 5;

// The platform owner always has every feature; a normal org only has what the
// owner switched on for it.
export function hasFeature(actor: Pick<Actor, 'id' | 'role' | 'features'>, key: PremiumFeature): boolean {
  if (isPlatformOwner(actor)) return true;
  return actor.features?.[key] === true;
}
