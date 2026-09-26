import { hasFeature } from './features';
import type { Actor } from './auth';

export type SourceCategory = 'core' | 'regional' | 'enforcement' | 'pep';

export const REGIONAL_CODES = new Set([
  'sa_pcct_terrorism_list',
  'eg_terrorists',
  'eg_house_representatives',
  'qa_shura_council',
  'bh_nuwab',
  'om_parliament',
  'ir_sanctions',
  'pk_proscribed_persons',
  'pk_na_members',
  'pk_senate_members',
]);

export const ENFORCEMENT_CODES = new Set([
  'worldbank_debarred',
  'iadb_sanctions',
  'ebrd_ineligible',
  'afdb_sanctions',
  'interpol_red_notices',
  'eu_europol_wanted',
  'gb_nca_most_wanted',
  'us_fbi_most_wanted',
  'enforcement',
]);

export const PEP_CODES = new Set([
  'eu_meps',
  'us_cia_world_leaders',
  'everypolitician',
  'fr_assemblee',
  'dk_pep',
  'cz_pep_declarations',
  'ng_join_dots',
  'co_join_dots',
  'ng_chipper_peps',
]);

export function getSourceCategory(code: string): SourceCategory {
  if (REGIONAL_CODES.has(code)) return 'regional';
  if (ENFORCEMENT_CODES.has(code)) return 'enforcement';
  if (PEP_CODES.has(code)) return 'pep';
  return 'core';
}

export function isSourceAllowed(
  code: string,
  actor?: Partial<Pick<Actor, 'id' | 'role' | 'features'>> | null
): boolean {
  if (!actor) return true;
  const category = getSourceCategory(code);
  if (category === 'core') return true;
  if (!actor.features) return true;
  if (category === 'regional') return hasFeature(actor, 'regional_sources');
  if (category === 'enforcement') return hasFeature(actor, 'enforcement_debarment');
  if (category === 'pep') return hasFeature(actor, 'pep_screening');
  return true;
}

export function getCategoryLabel(category: SourceCategory, locale: string = 'en') {
  const isAr = locale === 'ar';
  switch (category) {
    case 'core':
      return {
        label: isAr ? 'الأساسي: العقوبات الدولية والإمارات' : 'Core: International Sanctions & UAE',
        short: isAr ? 'أساسي' : 'Core',
        tierNote: isAr ? 'مشمول بالباقة الأساسية' : 'Included in Base plan',
      };
    case 'regional':
      return {
        label: isAr ? 'القوائم الإقليمية والعربية (السعودية، مصر، الخليج)' : 'Regional & Arab Lists',
        short: isAr ? 'إقليمي' : 'Regional',
        tierNote: isAr ? 'باقة القوائم الإقليمية' : 'Regional Tier',
      };
    case 'enforcement':
      return {
        label: isAr ? 'الإنفاذ الدولي وحظر التعاقد (البنك الدولي، الإنتربول)' : 'International Enforcement & Debarment',
        short: isAr ? 'إنفاذ' : 'Enforcement',
        tierNote: isAr ? 'باقة الإنفاذ الدولي' : 'Enforcement Tier',
      };
    case 'pep':
      return {
        label: isAr ? 'الشخصيات السياسية البارزة عالمياً (PEP)' : 'Global PEP Screening',
        short: isAr ? 'PEP' : 'PEP',
        tierNote: isAr ? 'باقة الشخصيات السياسية' : 'PEP Tier',
      };
  }
}
