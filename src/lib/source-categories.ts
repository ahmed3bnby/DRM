import { hasFeature } from './features';
import type { Actor } from './auth';

export type SourceCategory =
  | 'core'
  | 'regional'
  | 'enforcement'
  | 'pep'
  | 'regulatory'
  | 'maritime'
  | 'corporate_ubo'
  | 'offshore';

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

export const REGULATORY_ALERT_CODES = new Set([
  'ae_sca_alerts',
  'ae_dfsa_adgm_alerts',
  'sa_cma_alerts',
  'gb_fca_warnings',
  'us_sec_harmed_investors',
  'us_sec_pause',
]);

export const MARITIME_CODES = new Set([
  'ofac_sanctioned_vessels',
  'abuja_mou_detention',
  'black_sea_mou_detention',
]);

export const CORPORATE_UBO_CODES = new Set([
  'gleif_lei_registry',
  'opencorporates_registry',
]);

export const OFFSHORE_LEAK_CODES = new Set([
  'icij_offshore_leaks',
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
  if (REGULATORY_ALERT_CODES.has(code)) return 'regulatory';
  if (MARITIME_CODES.has(code)) return 'maritime';
  if (CORPORATE_UBO_CODES.has(code)) return 'corporate_ubo';
  if (OFFSHORE_LEAK_CODES.has(code)) return 'offshore';
  if (ENFORCEMENT_CODES.has(code)) return 'enforcement';
  if (PEP_CODES.has(code)) return 'pep';
  return 'core';
}

export function isSourceAllowed(
  code: string,
  actor?: Partial<Pick<Actor, 'id' | 'role' | 'features' | 'plan'>> | null
): boolean {
  if (!actor) return true;
  if (actor.role === 'admin' || actor.plan === 'enterprise') return true;
  const category = getSourceCategory(code);
  if (category === 'core') return true;
  if (!actor.features) return true;
  if (category === 'regional') return hasFeature(actor, 'regional_sources');
  if (category === 'enforcement') return hasFeature(actor, 'enforcement_debarment');
  if (category === 'pep') return hasFeature(actor, 'pep_screening');
  if (category === 'regulatory') return hasFeature(actor, 'regional_sources');
  if (category === 'maritime') return hasFeature(actor, 'enforcement_debarment');
  if (category === 'corporate_ubo') return hasFeature(actor, 'company_search');
  if (category === 'offshore') return hasFeature(actor, 'company_search');
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
    case 'regulatory':
      return {
        label: isAr ? 'تنبيهات الهيئات الرقابية والإنفاذ المالي (SCA, DFSA, ADGM, CMA, FCA)' : 'Regulatory & Investor Alerts (SCA, DFSA, CMA, FCA)',
        short: isAr ? 'تنبيهات رقابية' : 'Regulatory Alerts',
        tierNote: isAr ? 'باقة التحذيرات الرقابية' : 'Regulatory Alert Tier',
      };
    case 'maritime':
      return {
        label: isAr ? 'قوائم حظر السفن والملاحة البحرية (OFAC & IMO Vessels Blacklist)' : 'Sanctioned Maritime Vessels (OFAC & IMO)',
        short: isAr ? 'حظر السفن' : 'Vessels',
        tierNote: isAr ? 'باقة الملاحة والشحن' : 'Maritime Logistics Tier',
      };
    case 'corporate_ubo':
      return {
        label: isAr ? 'سجلات كشف المستفيد الحقيقي للشركات (GLEIF / LEI & OpenCorporates)' : 'Corporate Registries & UBO Ownership (GLEIF / LEI)',
        short: isAr ? 'المستفيد الحقيقي' : 'Corporate UBO',
        tierNote: isAr ? 'باقة كشف الشركات' : 'UBO Registry Tier',
      };
    case 'offshore':
      return {
        label: isAr ? 'تسريبات الملاذات الضريبية والشركات الوهمية (Panama / Pandora Papers - ICIJ)' : 'Offshore Leaks & Shell Companies (ICIJ)',
        short: isAr ? 'تسريبات الملاذات' : 'Offshore Leaks',
        tierNote: isAr ? 'باقة الاستقصاء المالي' : 'Investigative Leaks Tier',
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
