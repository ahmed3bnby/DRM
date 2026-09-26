import type { Customer } from './customers';
import type { Category } from './risk';
import type { DecisionRow } from './decisions';

// Customer-level risk MODEL (Phase 4). This is a transparent suggestion for the analyst — the final
// customer risk rating is always the analyst's decision (plan principle #3). It combines a risk-factor
// matrix (residence, nationality, industry, delivery channel) with overrides from stored screening hits.
export type RiskBand = 'low' | 'medium' | 'high';
export type RiskFactor = { key: string; value: string; score: number; band: RiskBand };
export type RiskRating = { factors: RiskFactor[]; base: number; baseBand: RiskBand; band: RiskBand; drivers: string[] };
type ScreeningMatch = { recordId: string; category: string };
export type ReviewImpact = { flags: Partial<Record<Category, boolean>>; confirmed: number; dismissed: number; needsInfo: number; unreviewed: number };

// Screening creates leads. Only a lead confirmed by the analyst may affect the
// model. A dismissed lead is always excluded, even if the run raised a raw flag.
export function reviewImpact(matches: ScreeningMatch[], decisions: Record<string, DecisionRow>): ReviewImpact {
  const flags: Partial<Record<Category, boolean>> = {};
  let confirmed = 0, dismissed = 0, needsInfo = 0, unreviewed = 0;
  for (const match of matches) {
    const decision = decisions[match.recordId]?.decision;
    if (decision === 'dismissed') { dismissed++; continue; }
    if (decision === 'needs_info') { needsInfo++; continue; }
    if (decision !== 'confirmed') { unreviewed++; continue; }
    confirmed++;
    if (match.category === 'sanctions' || match.category === 'debarment' || match.category === 'crime' || match.category === 'pep' || match.category === 'regulatory') flags[match.category] = true;
  }
  return { flags, confirmed, dismissed, needsInfo, unreviewed };
}

// FATF Call for Action (Blacklist) - High Risk Jurisdictions subject to countermeasures
export const FATF_BLACKLIST = new Set(['KP', 'IR', 'MM']);

// FATF Increased Monitoring (Greylist) - Updated per UAE NAMLCFTC & FATF plenary
export const FATF_GREYLIST = new Set([
  'DZ', 'AO', 'BO', 'BG', 'CM', 'CI', 'CD', 'HT', 'KE', 'LA',
  'LB', 'MC', 'NA', 'NP', 'SS', 'SY', 'VE', 'VN', 'VG', 'YE'
]);

// Other Comprehensively Sanctioned or Conflict / High-Risk Jurisdictions
export const SANCTIONED_OR_CONFLICT_COUNTRIES = new Set([
  'RU', 'CU', 'BY', 'AF', 'SD', 'SO', 'LY', 'IQ', 'ML', 'BF',
  'MZ', 'NG', 'PH', 'SN', 'ZA', 'TZ', 'HR', 'ZW', 'ER', 'CF',
  'GN', 'GW', 'PK', 'NI', 'KH', 'JM', 'PA'
]);

export type FatfStatus = 'blacklist' | 'greylist' | null;

export function getFatfStatus(code: string | null | undefined): FatfStatus {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  if (FATF_BLACKLIST.has(upper)) return 'blacklist';
  if (FATF_GREYLIST.has(upper)) return 'greylist';
  return null;
}

export const isSanctionedCountry = (code: string | null | undefined): boolean => {
  if (!code) return false;
  const upper = code.trim().toUpperCase();
  return FATF_BLACKLIST.has(upper) || SANCTIONED_OR_CONFLICT_COUNTRIES.has(upper);
};

const countryScore = (code: string): number => {
  if (!code) return 0;
  const upper = code.trim().toUpperCase();
  if (FATF_BLACKLIST.has(upper)) return 10;
  if (FATF_GREYLIST.has(upper) || SANCTIONED_OR_CONFLICT_COUNTRIES.has(upper)) return 7.5;
  return 2.5;
};

// High-Risk DNFBP Sectors in UAE AML/CFT Framework
export const HIGH_RISK_INDUSTRY = /exchange|money|remittance|crypto|virtual asset|vasp|blockchain|precious|gold|jewel|diamond|gem|dpms|real estate|property|broker|developer|lawyer|legal|advocate|notary|audit|account|tax|tcsp|trust|corporate service|offshore|fiduciary|casino|gambling|betting|gaming|arms|weapon|defen[cs]e|nonprofit|charity|hawala|ذهب|مجوهرات|معادن ثمينة|عقارات|وساطة عقارية|تطوير عقاري|محاماة|استشارات قانونية|كاتب عدل|تدقيق|محاسبة|ضرائب|تأسيس شركات|خدمات شركات|أصول افتراضية|عملات مشفرة|صرافة|حوالة|كازينو|قمار/i;

export const UAE_DNFBP_SECTORS = [
  { id: 'dpms', labelAr: 'تجار المعادن الثمينة والأحجار الكريمة (DPMS)', labelEn: 'Dealers in Precious Metals & Stones (DPMS)', highRisk: true },
  { id: 'real_estate', labelAr: 'الوسطاء والوكلاء العقاريون والمطورون', labelEn: 'Real Estate Brokers & Developers', highRisk: true },
  { id: 'legal', labelAr: 'المحامون والمستشارون القانونيون المستقلون', labelEn: 'Independent Legal Professionals & Notaries', highRisk: true },
  { id: 'accounting', labelAr: 'مدققو الحسابات والمحاسبون المستقلون', labelEn: 'Independent Auditors & Accountants', highRisk: true },
  { id: 'tcsp', labelAr: 'مزودو خدمات الشركات والصناديق الاستئمانية (TCSPs)', labelEn: 'Trust & Company Service Providers (TCSPs)', highRisk: true },
  { id: 'vasp', labelAr: 'مزودو خدمات الأصول الافتراضية والعملات المشفرة (VASPs)', labelEn: 'Virtual Asset Service Providers (VASPs)', highRisk: true },
  { id: 'exchange', labelAr: 'شركات الصرافة والحوالات المالية (Hawala)', labelEn: 'Exchange & Money Remittance (Hawala)', highRisk: true },
  { id: 'luxury', labelAr: 'تجار السلع الفاخرة (السيارات الفارهة والتحف الفنية)', labelEn: 'High-Value Goods (Luxury Vehicles, Art & Antiques)', highRisk: true },
] as const;

export const isCashThresholdSector = (industry: string | null | undefined): boolean => {
  if (!industry) return false;
  return /precious|gold|jewel|diamond|gem|dpms|real estate|property|broker|developer|ذهب|مجوهرات|معادن ثمينة|أحجار كريمة|عقار/i.test(industry);
};

const industryScore = (industry: string): number => !industry ? 0 : HIGH_RISK_INDUSTRY.test(industry) ? 7.5 : 2.5;
const deliveryScore = (channel: string): number => channel === 'non_face_to_face' || channel === 'online' ? 5 : channel === 'face_to_face' ? 0 : 2.5;

const factorBand = (score: number): RiskBand => score >= 7.5 ? 'high' : score >= 4 ? 'medium' : 'low';
const RANK: Record<RiskBand, number> = { low: 1, medium: 2, high: 3 };
const max = (a: RiskBand, b: RiskBand): RiskBand => RANK[a] >= RANK[b] ? a : b;

export function computeRiskRating(customer: Pick<Customer, 'country' | 'nationality' | 'industry' | 'delivery_channel'>, flags?: Partial<Record<Category, boolean>> | null, adverse?: boolean): RiskRating {
  const factors: RiskFactor[] = [
    { key: 'residence', value: customer.country, score: countryScore(customer.country), band: 'low' },
    { key: 'nationality', value: customer.nationality, score: countryScore(customer.nationality), band: 'low' },
    { key: 'industry', value: customer.industry, score: industryScore(customer.industry), band: 'low' },
    { key: 'delivery', value: customer.delivery_channel, score: deliveryScore(customer.delivery_channel), band: 'low' },
  ].map(f => ({ ...f, band: factorBand(f.score) }));
  const base = factors.reduce((sum, f) => sum + f.score, 0);
  const baseBand: RiskBand = base >= 20 ? 'high' : base >= 10 ? 'medium' : 'low';

  // Overrides from statutory country classifications and stored screening hits
  let band = baseBand;
  const drivers: string[] = [];

  const resBlacklist = FATF_BLACKLIST.has(customer.country?.trim().toUpperCase() || '');
  const natBlacklist = FATF_BLACKLIST.has(customer.nationality?.trim().toUpperCase() || '');
  const resSanctioned = isSanctionedCountry(customer.country);
  const natSanctioned = isSanctionedCountry(customer.nationality);

  if (resBlacklist || natBlacklist) {
    band = 'high';
    drivers.push('fatf_blacklist');
  } else if (resSanctioned || natSanctioned) {
    band = 'high';
    drivers.push('sanctioned_country');
  }

  if (flags?.sanctions) { band = 'high'; drivers.push('sanction'); }
  if (flags?.crime) { band = max(band, 'high'); drivers.push('crime'); }
  if (flags?.debarment) { band = max(band, 'high'); drivers.push('debarment'); }
  if (flags?.pep) { band = max(band, 'medium'); drivers.push('pep'); }
  if (flags?.regulatory) { band = max(band, 'medium'); drivers.push('regulatory'); }
  if (adverse) { band = max(band, 'medium'); drivers.push('adverse'); }
  if (!drivers.length) drivers.push('base');
  return { factors, base: Math.round(base * 10) / 10, baseBand, band, drivers };
}

// goAML Statutory Reporting Guidance for UAE Compliance Officers
export type GoAmlReportType = 'HRC' | 'HRCA' | 'STR' | 'SAR' | 'DCR' | 'EDD';

export type GoAmlAdviceItem = {
  type: GoAmlReportType;
  titleAr: string;
  titleEn: string;
  severity: 'critical' | 'high' | 'warning' | 'info';
  triggerAr: string;
  triggerEn: string;
  actionAr: string;
  actionEn: string;
  legalBasisAr: string;
  legalBasisEn: string;
  mandatory: boolean;
};

export type GoAmlGuidance = {
  requiresImmediateAction: boolean;
  requiresEdd: boolean;
  reports: GoAmlAdviceItem[];
  cashThresholdAlert: boolean;
  cashThresholdNote: { ar: string; en: string };
  summaryAr: string;
  summaryEn: string;
};

export function getGoAmlAdvice(
  customer: Pick<Customer, 'country' | 'nationality' | 'industry'>,
  flags?: Partial<Record<Category, boolean>> | null,
  adverseHit = false
): GoAmlGuidance {
  const reports: GoAmlAdviceItem[] = [];
  let requiresImmediateAction = false;
  let requiresEdd = false;

  const resFatf = getFatfStatus(customer.country);
  const natFatf = getFatfStatus(customer.nationality);

  // 1. FATF Blacklist Check (HRC Report)
  if (resFatf === 'blacklist' || natFatf === 'blacklist') {
    requiresImmediateAction = true;
    requiresEdd = true;
    reports.push({
      type: 'HRC',
      titleAr: 'تقرير دولة عالية المخاطر (HRC - High Risk Country)',
      titleEn: 'High Risk Country Report (HRC)',
      severity: 'critical',
      triggerAr: 'ارتباط العميل بإحدى الدول عالية المخاطر الخاضعة لدعوة لاتخاذ تدابير مضادة (القائمة السوداء لـ FATF).',
      triggerEn: 'Customer linked to a FATF Call for Action high-risk jurisdiction (Blacklist).',
      actionAr: 'تطبيق تدابير مضادة إلزامية، وإجراء العناية الواجبة المعززة (EDD)، وأخذ موافقة الإدارة العليا، ورفع تقرير HRC فورًا عبر بوابة goAML.',
      actionEn: 'Apply mandatory countermeasures, perform Enhanced Due Diligence (EDD), obtain Senior Management approval, and file an HRC report on goAML immediately.',
      legalBasisAr: 'المرسوم بقانون اتحادي رقم (20) لسنة 2018 وتوجيهات اللجنة الوطنية لمكافحة غسل الأموال (NAMLCFTC).',
      legalBasisEn: 'UAE Federal Decree-Law No. (20) of 2018 & NAMLCFTC High-Risk Country Directives.',
      mandatory: true,
    });
  }

  // 2. Confirmed Sanctions Check (STR / SAR + Immediate Asset Freeze)
  if (flags?.sanctions) {
    requiresImmediateAction = true;
    reports.push({
      type: 'STR',
      titleAr: 'بلاغ معاملة مشبوهة وتجميد أصول فوري (STR / Asset Freeze)',
      titleEn: 'Suspicious Transaction Report & Asset Freeze (STR)',
      severity: 'critical',
      triggerAr: 'تأكيد مطابقة العميل مع قائمة عقوبات دولية أو القائمة المحلية المعتمدة بدولة الإمارات.',
      triggerEn: 'Confirmed match against international sanctions or UAE National Terrorist List.',
      actionAr: 'تجميد فوري للأصول والأموال خلال 24 ساعة دون تأخير ودون إشعار مسبق للعميل، وحظر تقديم الخدمات، ورفع تقرير STR/SAR عبر goAML وإخطار المكتب التنفيذي للرقابة وحظر الانتشار (EOCN).',
      actionEn: 'Immediately freeze assets within 24 hours without prior notice, prohibit provision of services, file an STR via goAML, and notify the Executive Office for Control & Non-Proliferation (EOCN).',
      legalBasisAr: 'قرار مجلس الوزراء رقم (74) لسنة 2020 بشأن نظام القوائم الإرهابية وتطبيق قرارات مجلس الأمن.',
      legalBasisEn: 'UAE Cabinet Resolution No. 74 of 2020 on Terrorist Lists & UNSC Targeted Financial Sanctions.',
      mandatory: true,
    });
  }

  // 3. Confirmed Crime / Debarment Check (STR / SAR)
  if (flags?.crime || flags?.debarment) {
    requiresImmediateAction = true;
    reports.push({
      type: 'SAR',
      titleAr: 'بلاغ نشاط مشبوه (SAR - Suspicious Activity Report)',
      titleEn: 'Suspicious Activity Report (SAR)',
      severity: 'high',
      triggerAr: 'تأكيد وجود سوابق أو قرائن إنفاذ قانون أو جرائم مالية أو حظر تعاقد.',
      triggerEn: 'Confirmed criminal enforcement, financial crime, or debarment match.',
      actionAr: 'توثيق أسباب الاشتباه، والامتناع عن إتمام المعاملة إذا استمرت الشبهة، ورفع تقرير SAR عبر goAML مع الحفاظ على سرية البلاغ وحظر تنبيه العميل (No Tipping-off).',
      actionEn: 'Document grounds for suspicion, refrain from completing transactions if suspicion persists, and submit a SAR via goAML under strict confidentiality (anti-tipping-off).',
      legalBasisAr: 'المادة (15) من المرسوم بقانون اتحادي رقم (20) لسنة 2018 وتعديلاته.',
      legalBasisEn: 'Article 15 of UAE Federal Decree-Law No. (20) of 2018 as amended.',
      mandatory: true,
    });
  }

  // 4. FATF Greylist Check (HRCA Report)
  if ((resFatf === 'greylist' || natFatf === 'greylist') && resFatf !== 'blacklist' && natFatf !== 'blacklist') {
    requiresEdd = true;
    reports.push({
      type: 'HRCA',
      titleAr: 'تقرير نشاط دولة خاضعة للمراقبة المتزايدة (HRCA - High Risk Country Activity)',
      titleEn: 'High Risk Country Activity Report (HRCA)',
      severity: 'high',
      triggerAr: 'ارتباط العميل بدولة خاضعة للمراقبة المتزايدة من قِبل مجموعة العمل المالي (القائمة الرمادية لـ FATF).',
      triggerEn: 'Customer linked to a FATF Increased Monitoring jurisdiction (Greylist).',
      actionAr: 'تطبيق تدابير العناية الواجبة المعززة (EDD)، والتحقق من مصدر الأموال والثروة، وتقديم تقرير HRCA في حال مباشرة تعاملات جوهرية ترتبط بالدولة.',
      actionEn: 'Conduct Enhanced Due Diligence (EDD), verify Source of Wealth/Funds, and file an HRCA report on goAML if substantial transactions link to this jurisdiction.',
      legalBasisAr: 'إرشادات المصرف المركزي الإماراتي ووزارة الاقتصاد بشأن الدول الخاضعة للمراقبة المتزايدة.',
      legalBasisEn: 'UAE CBUAE & Ministry of Economy Directives on Jurisdictions under Increased Monitoring.',
      mandatory: true,
    });
  }

  // 5. PEP Check (Mandatory EDD & Senior Management Approval)
  if (flags?.pep) {
    requiresEdd = true;
    reports.push({
      type: 'EDD',
      titleAr: 'إجراءات العناية الواجبة المعززة وموافقة الإدارة (EDD for PEP)',
      titleEn: 'Enhanced Due Diligence for PEP (EDD)',
      severity: 'warning',
      triggerAr: 'تأكيد تصنيف العميل كشخص معرّض سياسيًا (PEP) أو شخص مرتبط به أو قريب (RCA).',
      triggerEn: 'Confirmed Politically Exposed Person (PEP) or Relative/Close Associate (RCA).',
      actionAr: 'الحصول على موافقة خطية من الإدارة العليا قبل استمرار علاقة العمل، والتحقق الموثق من مصدر الأموال (SOF) ومصدر الثروة (SOW)، وتطبيق مراقبة مستمرة ومكثفة.',
      actionEn: 'Obtain senior management approval, verify Source of Funds (SOF) and Source of Wealth (SOW), and conduct intensive ongoing transaction monitoring.',
      legalBasisAr: 'المادة (15) من اللائحة التنفيذية الصادرة بقرار مجلس الوزراء رقم (10) لسنة 2019.',
      legalBasisEn: 'Article 15 of UAE Cabinet Decision No. 10 of 2019 (Executive Regulations).',
      mandatory: true,
    });
  }

  // 6. Adverse Media hit with potential financial crime
  if (adverseHit && !flags?.sanctions && !flags?.crime) {
    reports.push({
      type: 'SAR',
      titleAr: 'إشعار فحص إعلام سلبي ومؤشرات اشتباه (Adverse Media Lead)',
      titleEn: 'Adverse Media Screening Signal (SAR Advisory)',
      severity: 'warning',
      triggerAr: 'رصد مؤشرات إخبارية سلبية غير محسومة مرتبطة بغسل أموال أو احتيال أو فساد مالي.',
      triggerEn: 'Public adverse media leads flagged regarding financial crimes or corruption.',
      actionAr: 'إجراء فحص تحرّي إضافي، ومطالبة العميل بمستندات توضيحية، وإذا تأكد الاشتباه يتم رفع تقرير SAR عبر goAML.',
      actionEn: 'Conduct investigative due diligence, request clarifying documentation, and escalate to a SAR on goAML if suspicion is substantiated.',
      legalBasisAr: 'معايير التحري الرقابي المعتمدة بوحدة المعلومات المالية الإماراتية.',
      legalBasisEn: 'UAE Financial Intelligence Unit (FIU) Investigative Due Diligence Standards.',
      mandatory: false,
    });
  }

  // 7. High-Risk DNFBP Sector Check
  const cashAlert = isCashThresholdSector(customer.industry);
  if (HIGH_RISK_INDUSTRY.test(customer.industry || '')) {
    requiresEdd = true;
    reports.push({
      type: 'EDD',
      titleAr: 'العناية الواجبة الخاصة بقطاعات DNFBP في دولة الإمارات',
      titleEn: 'UAE DNFBP Statutory Compliance Requirements',
      severity: 'info',
      triggerAr: 'ممارسة العميل لنشاط يندرج ضمن الأعمال والمهن غير المالية المحددة (DNFBPs).',
      triggerEn: 'Customer operates in a Designated Non-Financial Business or Profession (DNFBP).',
      actionAr: 'التحقق من صحة الرخصة التجارية وسجل المستفيد الحقيقي (UBO) بنسبة 25% فما فوق، والتحقق من التسجيل الإلزامي للمنشأة في نظام goAML.',
      actionEn: 'Verify commercial trade license, identify Ultimate Beneficial Owners (UBOs >= 25%), and verify mandatory firm registration on goAML.',
      legalBasisAr: 'قرارات وزارة الاقتصاد بشأن التزامات قطاعات DNFBP لمكافحة غسل الأموال.',
      legalBasisEn: 'UAE Ministry of Economy AML/CFT Directives for DNFBP Sectors.',
      mandatory: false,
    });
  }

  const cashThresholdNote = {
    ar: 'تنبيه حد المعاملات النقدية (50,000 درهم): يلزم تجار المعادن الثمينة والأحجار الكريمة (DPMS) والوسطاء العقاريين بالإبلاغ الفوري عبر بوابة goAML عن أي معاملات نقدية أو شيكات تسوية تعادل أو تزيد عن 50,000 درهم إماراتي.',
    en: 'Statutory Cash Threshold Alert (AED 50,000): Dealers in Precious Metals & Stones (DPMS) and Real Estate brokers are legally mandated to report any single or linked cash transaction equal to or exceeding AED 50,000 via the goAML portal.',
  };

  const summaryAr = requiresImmediateAction
    ? 'يتطلب هذا الملف إجراءات إبلاغ رقابي عاجلة عبر goAML وتدابير فورية وفق التعليمات الرقابية.'
    : requiresEdd
    ? 'يتطلب هذا الملف تطبيق تدابير العناية الواجبة المعززة (EDD) والتحقق الإضافي من مصادر الأموال والشركاء.'
    : 'الملف يخضع لإجراءات العناية الواجبة الاعتيادية (CDD) مع المراقبة الدورية.';

  const summaryEn = requiresImmediateAction
    ? 'This profile requires immediate regulatory filing on goAML and urgent compliance actions under UAE directives.'
    : requiresEdd
    ? 'This profile mandates Enhanced Due Diligence (EDD) and source-of-wealth verification under UAE regulations.'
    : 'This profile is subject to Standard Customer Due Diligence (CDD) and ongoing monitoring.';

  return {
    requiresImmediateAction,
    requiresEdd,
    reports,
    cashThresholdAlert: cashAlert,
    cashThresholdNote,
    summaryAr,
    summaryEn,
  };
}

export type RiskAssessmentSummary = {
  rating: RiskRating;
  review: ReviewImpact;
  isPending: boolean;
  unresolvedCount: number;
  confirmedCount: number;
  dismissedCount: number;
  hasScreening: boolean;
  statusLabelKey: 'screenReviewPending' | 'screenReviewComplete' | 'screenReviewNone';
  riskLabelKey: 'riskPendingValue' | 'riskUnassessed' | 'assessed';
  goAml: GoAmlGuidance;
};

export function evaluateRiskAssessment(
  customer: Pick<Customer, 'country' | 'nationality' | 'industry' | 'delivery_channel'>,
  matches: ScreeningMatch[] = [],
  decisions: Record<string, DecisionRow> = {},
  hasScreening = false,
  adverseHit = false
): RiskAssessmentSummary {
  const review = reviewImpact(matches, decisions);
  const rating = computeRiskRating(customer, review.flags, false);
  const unresolvedCount = review.unreviewed + review.needsInfo;
  const isPending = hasScreening && unresolvedCount > 0;
  const statusLabelKey = isPending
    ? 'screenReviewPending'
    : matches.length > 0
    ? 'screenReviewComplete'
    : 'screenReviewNone';
  const riskLabelKey = isPending
    ? 'riskPendingValue'
    : hasScreening
    ? 'assessed'
    : 'riskUnassessed';

  const goAml = getGoAmlAdvice(customer, review.flags, adverseHit);

  return {
    rating,
    review,
    isPending,
    unresolvedCount,
    confirmedCount: review.confirmed,
    dismissedCount: review.dismissed,
    hasScreening,
    statusLabelKey,
    riskLabelKey,
    goAml,
  };
}

