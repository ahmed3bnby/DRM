import { isPlatformOwner } from './platform-access';
import type { Actor } from './auth';

// Premium features gated per organization by the platform owner (super admin).
// Base features — source search, coverage, customer profiles/screening/risk,
// reports, and a capped team — are always available and are NOT listed here.
export const PREMIUM_FEATURES = [
  'adverse_media',
  'company_search',
  'reviews',
  'regional_sources',
  'enforcement_debarment',
  'pep_screening',
  'bulk_screening',
  'ongoing_monitoring',
] as const;
export type PremiumFeature = typeof PREMIUM_FEATURES[number];

export const FEATURE_LABELS: Record<PremiumFeature, { ar: string; en: string }> = {
  adverse_media: { ar: 'الإعلام والوسائط السلبية (Adverse Media)', en: 'Adverse media' },
  company_search: { ar: 'بحث الشركات وسجلات الكيانات (GLEIF)', en: 'Company search (GLEIF)' },
  reviews: { ar: 'صندوق ومسار تدقيق الحالات (Review Workflow)', en: 'Review inbox / workflow' },
  regional_sources: { ar: 'القوائم الإقليمية والعربية (مصر، السعودية، الخليج)', en: 'Regional & Arab watchlists' },
  enforcement_debarment: { ar: 'الإنفاذ الدولي ومكافحة الجرائم (البنك الدولي، الإنتربول)', en: 'International enforcement & debarment' },
  pep_screening: { ar: 'فحص الشخصيات السياسية البارزة عالمياً (PEP)', en: 'Global PEP screening' },
  bulk_screening: { ar: 'الفحص الجماعي عبر ملفات الإكسل (Bulk Excel/CSV)', en: 'Bulk Excel/CSV screening' },
  ongoing_monitoring: { ar: 'المراقبة المستمرة التلقائية 24/7 (Ongoing Monitoring)', en: 'Automated 24/7 ongoing monitoring' },
};

export const DEFAULT_MEMBER_LIMIT = 5;

// The platform owner always has every feature; a normal org only has what the
// owner switched on for it.
export function hasFeature(actor: Partial<Pick<Actor, 'id' | 'role' | 'features'>>, key: PremiumFeature): boolean {
  if (isPlatformOwner(actor)) return true;
  return actor.features?.[key] === true;
}
