// FATF (Financial Action Task Force) Jurisdiction Risk Module
// Provides authoritative classification of jurisdictions per latest FATF Plenary & UAE NAMLCFTC guidelines.

export type FatfRating = 'blacklist' | 'greylist' | 'standard';

export interface FatfJurisdictionInfo {
  code: string;
  nameEn: string;
  nameAr: string;
  rating: FatfRating;
  titleEn: string;
  titleAr: string;
  measuresEn: string;
  measuresAr: string;
  summaryEn: string;
  summaryAr: string;
}

// FATF High-Risk Jurisdictions subject to a Call for Action (Blacklist)
export const FATF_BLACKLIST_MAP: Record<string, { nameEn: string; nameAr: string; summaryEn: string; summaryAr: string }> = {
  KP: {
    nameEn: "Democratic People's Republic of Korea (DPRK)",
    nameAr: "كوريا الشمالية",
    summaryEn: "Significant money laundering and proliferation financing deficiencies; full countermeasures applied.",
    summaryAr: "أوجه قصور جوهرية في مكافحة غسيل الأموال وتمويل انتشار التسلح؛ تطبق بحقها تدابير مضادة كاملة."
  },
  IR: {
    nameEn: "Iran",
    nameAr: "إيران",
    summaryEn: "Substantial terrorist financing risks and failure to address strategic action plan items; full countermeasures applied.",
    summaryAr: "مخاطر جسيمة تتعلق بتمويل الإرهاب مع عدم استيفاء خطة العمل الاستراتيجية؛ تطبق بحقها تدابير مضادة كاملة."
  },
  MM: {
    nameEn: "Myanmar",
    nameAr: "ميانمار",
    summaryEn: "Strategic AML/CFT deficiencies; enhanced due diligence required proportionate to risks.",
    summaryAr: "أوجه قصور استراتيجية في مكافحة غسل الأموال وتمويل الإرهاب؛ تتطلب عناية واجبة مشددة تتناسب مع حجم المخاطر."
  }
};

// FATF Jurisdictions under Increased Monitoring (Greylist)
export const FATF_GREYLIST_MAP: Record<string, { nameEn: string; nameAr: string; summaryEn: string; summaryAr: string }> = {
  DZ: { nameEn: "Algeria", nameAr: "الجزائر", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  AO: { nameEn: "Angola", nameAr: "أنغولا", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  BO: { nameEn: "Bolivia", nameAr: "بوليفيا", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  BG: { nameEn: "Bulgaria", nameAr: "بلغاريا", summaryEn: "Under increased monitoring for strategic AML/CFT deficiencies.", summaryAr: "خاضعة لمراقبة مشددة لمعالجة أوجه القصور الاستراتيجية." },
  BF: { nameEn: "Burkina Faso", nameAr: "بوركينا فاسو", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  CM: { nameEn: "Cameroon", nameAr: "الكاميرون", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  CD: { nameEn: "DR Congo", nameAr: "جمهورية الكونغو الديمقراطية", summaryEn: "Under increased monitoring for strategic deficiencies.", summaryAr: "خاضعة لمراقبة مشددة لمعالجة القصور الاستراتيجي." },
  CI: { nameEn: "Côte d'Ivoire", nameAr: "ساحل العاج", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  HT: { nameEn: "Haiti", nameAr: "هايتي", summaryEn: "Under increased monitoring for governance and compliance gaps.", summaryAr: "خاضعة لمراقبة مشددة لمعالجة فجوات الامتثال." },
  KE: { nameEn: "Kenya", nameAr: "كينيا", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  LA: { nameEn: "Laos", nameAr: "لاوس", summaryEn: "Under increased monitoring for strategic deficiencies.", summaryAr: "خاضعة لمراقبة مشددة لمعالجة القصور الاستراتيجي." },
  LB: { nameEn: "Lebanon", nameAr: "لبنان", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  ML: { nameEn: "Mali", nameAr: "مالي", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  MC: { nameEn: "Monaco", nameAr: "موناكو", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  MZ: { nameEn: "Mozambique", nameAr: "موزمبيق", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  NA: { nameEn: "Namibia", nameAr: "ناميبيا", summaryEn: "Under increased monitoring for strategic deficiencies.", summaryAr: "خاضعة لمراقبة مشددة لمعالجة القصور الاستراتيجي." },
  NP: { nameEn: "Nepal", nameAr: "نيبال", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  NG: { nameEn: "Nigeria", nameAr: "نيجيريا", summaryEn: "Under increased monitoring for strategic deficiencies.", summaryAr: "خاضعة لمراقبة مشددة لمعالجة القصور الاستراتيجي." },
  PH: { nameEn: "Philippines", nameAr: "الفلبين", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  SN: { nameEn: "Senegal", nameAr: "السنغال", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  ZA: { nameEn: "South Africa", nameAr: "جنوب أفريقيا", summaryEn: "Under increased monitoring for strategic deficiencies.", summaryAr: "خاضعة لمراقبة مشددة لمعالجة القصور الاستراتيجي." },
  SS: { nameEn: "South Sudan", nameAr: "جنوب السودان", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  SY: { nameEn: "Syria", nameAr: "سوريا", summaryEn: "Under increased monitoring for strategic deficiencies.", summaryAr: "خاضعة لمراقبة مشددة لمعالجة القصور الاستراتيجي." },
  TZ: { nameEn: "Tanzania", nameAr: "تنزانيا", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  VE: { nameEn: "Venezuela", nameAr: "فنزويلا", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  VN: { nameEn: "Vietnam", nameAr: "فيتنام", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  VG: { nameEn: "British Virgin Islands", nameAr: "جزر العذراء البريطانية", summaryEn: "Under increased monitoring with committed action plan.", summaryAr: "خاضعة لمراقبة مشددة بموجب خطة عمل متفق عليها." },
  YE: { nameEn: "Yemen", nameAr: "اليمن", summaryEn: "Under increased monitoring for strategic deficiencies.", summaryAr: "خاضعة لمراقبة مشددة لمعالجة القصور الاستراتيجي." }
};

export function evaluateFATFJurisdiction(code: string | null | undefined): FatfJurisdictionInfo {
  const c = (code || '').trim().toUpperCase();
  if (FATF_BLACKLIST_MAP[c]) {
    const item = FATF_BLACKLIST_MAP[c];
    return {
      code: c,
      nameEn: item.nameEn,
      nameAr: item.nameAr,
      rating: 'blacklist',
      titleEn: 'High-Risk Jurisdiction (Blacklist - Call for Action)',
      titleAr: 'اختصاص قضائي عالي المخاطر (القائمة السوداء - دعوة لإجراءات مضادة)',
      measuresEn: 'Enhanced Due Diligence (EDD) + Countermeasures & FIU / goAML Reporting mandatory.',
      measuresAr: 'إلزام تطبيق تدابير العناية الواجبة المشددة (EDD) مع اتخاذ إجراءات مضادة وإبلاغ وحدة المعلومات المالية (FIU/goAML).',
      summaryEn: item.summaryEn,
      summaryAr: item.summaryAr
    };
  }

  if (FATF_GREYLIST_MAP[c]) {
    const item = FATF_GREYLIST_MAP[c];
    return {
      code: c,
      nameEn: item.nameEn,
      nameAr: item.nameAr,
      rating: 'greylist',
      titleEn: 'Jurisdiction under Increased Monitoring (Greylist)',
      titleAr: 'اختصاص قضائي خاضع لمراقبة مشددة (القائمة الرمادية)',
      measuresEn: 'Enhanced Due Diligence (EDD) required. Verification of Source of Wealth & Source of Funds (SOW/SOF) mandated.',
      measuresAr: 'يتطلب تطبيق تدابير العناية الواجبة المشددة (EDD) والتحقق الإلزامي من مصدر الثروة ومصدر الأموال (SOW/SOF).',
      summaryEn: item.summaryEn,
      summaryAr: item.summaryAr
    };
  }

  return {
    code: c || '—',
    nameEn: c || 'Standard Jurisdiction',
    nameAr: c || 'اختصاص قياسي',
    rating: 'standard',
    titleEn: 'Standard Jurisdiction (Low / Managed Risk)',
    titleAr: 'اختصاص قضائي قياسي (مخاطر منخفضة / معتادة)',
    measuresEn: 'Standard Customer Due Diligence (CDD) applies.',
    measuresAr: 'تطبق تدابير العناية الواجبة المعتادة (CDD).',
    summaryEn: 'Not listed on FATF Blacklist or Greylist.',
    summaryAr: 'غير مدرجة ضمن القوائم السوداء أو الرمادية لمجموعة العمل المالي (FATF).'
  };
}
