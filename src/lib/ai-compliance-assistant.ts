// AI Compliance Decision Assistant & False Positive Analyzer
// Analyzes customer vs watchlist record attributes (DOB, Country, Nationality, Identifiers, Name tokens)
// and produces compliance recommendations with formal audit justifications.

export interface AiCustomerProfile {
  name: string;
  country: string;
  nationality?: string | null;
  date_of_birth?: string | null;
  identifier?: string | null;
  entity_type?: string;
}

export interface AiMatchRecord {
  name: string;
  source: string;
  category: string;
  percent: number;
  recordCountry?: string | null;
  recordDob?: string | null;
  recordIdNumber?: string | null;
  dobMatch?: boolean;
  dobConflict?: boolean;
  idMatch?: boolean;
  recordAliases?: string[];
}

export interface FactorComparison {
  key: 'name' | 'dob' | 'country' | 'id';
  labelAr: string;
  labelEn: string;
  status: 'match' | 'conflict' | 'partial' | 'missing';
  customerVal?: string | null;
  recordVal?: string | null;
  detailAr: string;
  detailEn: string;
}

export interface AiDecisionRecommendation {
  recommendation: 'dismissed' | 'confirmed' | 'needs_info';
  recommendationBadgeAr: string;
  recommendationBadgeEn: string;
  headlineAr: string;
  headlineEn: string;
  confidence: number; // 0 - 100
  summaryAr: string;
  summaryEn: string;
  auditRationaleAr: string;
  auditRationaleEn: string;
  factors: FactorComparison[];
  isFalsePositive: boolean;
  isConfirmed: boolean;
  isNeedsInfo: boolean;
}

// Common Arabic given names that frequently cause superficial false-positive collisions
const COMMON_ARABIC_NAMES = new Set([
  'محمد علي', 'أحمد علي', 'محمد أحمد', 'أحمد محمد', 'عبدالله محمد',
  'محمد حسن', 'علي محمد', 'محمود أحمد', 'عمر أحمد', 'خالد محمد',
  'mohamed ali', 'ahmed ali', 'mohammed ali', 'muhammad ali', 'ahmed mohamed',
  'john smith', 'david miller', 'michael brown', 'alexander ivanov'
]);

function extractYear(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? parseInt(match[1], 10) : null;
}

function cleanStr(s?: string | null): string {
  if (!s) return '';
  return s.trim().toLowerCase().replace(/[\s\-_.]+/g, ' ');
}

export function analyzeMatchForDecision(
  customer: AiCustomerProfile,
  match: AiMatchRecord,
  locale: 'ar' | 'en' = 'ar'
): AiDecisionRecommendation {
  const isEn = locale === 'en';
  const factors: FactorComparison[] = [];

  const custDobYear = extractYear(customer.date_of_birth);
  const recDobYear = extractYear(match.recordDob);
  const custCountry = (customer.country || '').toUpperCase();
  const recCountry = (match.recordCountry || '').toUpperCase();
  const custNat = (customer.nationality || '').toUpperCase();
  const custNameClean = cleanStr(customer.name);
  const matchNameClean = cleanStr(match.name);

  // 1. DOB Analysis
  let dobStatus: FactorComparison['status'] = 'missing';
  let dobDetailAr = 'تاريخ الميلاد غير متوفر في أحد الطرفين للمقارنة.';
  let dobDetailEn = 'Date of birth unavailable on one or both records.';
  let dobDiffYears: number | null = null;

  if (match.dobMatch) {
    dobStatus = 'match';
    dobDetailAr = `تطابق تام في تاريخ الميلاد (${customer.date_of_birth}).`;
    dobDetailEn = `Exact date of birth match (${customer.date_of_birth}).`;
  } else if (custDobYear && recDobYear) {
    dobDiffYears = Math.abs(custDobYear - recDobYear);
    if (custDobYear === recDobYear) {
      dobStatus = 'match';
      dobDetailAr = `تطابق سنة الميلاد (${custDobYear}).`;
      dobDetailEn = `Birth year matches (${custDobYear}).`;
    } else {
      dobStatus = 'conflict';
      dobDetailAr = `اختلاف قاطع في سنة الميلاد (العميل: ${custDobYear} مقابل المدرج: ${recDobYear} بفارق ${dobDiffYears} سنة).`;
      dobDetailEn = `Definitive birth year discrepancy (Customer: ${custDobYear} vs Watchlist Entity: ${recDobYear}, difference of ${dobDiffYears} years).`;
    }
  } else if (match.dobConflict) {
    dobStatus = 'conflict';
    dobDetailAr = `تعارض مسجل في تاريخ الميلاد بين العميل وسجل القائمة.`;
    dobDetailEn = `Recorded date of birth conflict between customer and list record.`;
  }

  factors.push({
    key: 'dob',
    labelAr: customer.entity_type === 'company' ? 'تاريخ التأسيس' : 'تاريخ الميلاد',
    labelEn: customer.entity_type === 'company' ? 'Incorporation Date' : 'Date of Birth',
    status: dobStatus,
    customerVal: customer.date_of_birth || null,
    recordVal: match.recordDob || null,
    detailAr: dobDetailAr,
    detailEn: dobDetailEn,
  });

  // 2. Country & Jurisdiction Analysis
  let countryStatus: FactorComparison['status'] = 'missing';
  let countryDetailAr = 'الدولة أو النطاق الجغرافي غير محدد بدقة في سجل القائمة.';
  let countryDetailEn = 'Country or jurisdiction unspecified in the list record.';

  if (custCountry && recCountry) {
    if (custCountry === recCountry || (custNat && custNat === recCountry)) {
      countryStatus = 'match';
      countryDetailAr = `تطابق في الدولة والولاية القضائية (${custCountry}).`;
      countryDetailEn = `Jurisdiction and country match (${custCountry}).`;
    } else {
      countryStatus = 'conflict';
      countryDetailAr = `اختلاف النطاق الجغرافي ودولة التسجيل/الإقامة (العميل: ${custCountry} مقابل المدرج: ${recCountry}).`;
      countryDetailEn = `Geographic and jurisdiction discrepancy (Customer: ${custCountry} vs Watchlist Entity: ${recCountry}).`;
    }
  } else if (custCountry) {
    countryStatus = 'partial';
    countryDetailAr = `دولة العميل مسجلة (${custCountry})، بينما لم تذكر القائمة دولة قاطعة.`;
    countryDetailEn = `Customer country known (${custCountry}), but watchlist record has no primary country.`;
  }

  factors.push({
    key: 'country',
    labelAr: 'الدولة والجنسية',
    labelEn: 'Country & Nationality',
    status: countryStatus,
    customerVal: custCountry || null,
    recordVal: recCountry || null,
    detailAr: countryDetailAr,
    detailEn: countryDetailEn,
  });

  // 3. Identifier Analysis
  let idStatus: FactorComparison['status'] = 'missing';
  let idDetailAr = 'لا يتوفر رقم هوية أو جواز سفر للمقارنة المباشرة.';
  let idDetailEn = 'No primary ID or document number available for direct cross-match.';

  if (match.idMatch) {
    idStatus = 'match';
    idDetailAr = `تطابق قاطع في رقم الهوية/المعرف الرسمي.`;
    idDetailEn = `Definitive match on official identification number.`;
  } else if (customer.identifier && match.recordIdNumber) {
    const cId = cleanStr(customer.identifier);
    const rId = cleanStr(match.recordIdNumber);
    if (cId === rId) {
      idStatus = 'match';
      idDetailAr = `تطابق رقم الهوية/المستند (${customer.identifier}).`;
      idDetailEn = `Matching document ID (${customer.identifier}).`;
    } else {
      idStatus = 'conflict';
      idDetailAr = `اختلاف رقم المستند/الهوية بين العميل وسجل القائمة.`;
      idDetailEn = `Document/ID number mismatch between customer and list entry.`;
    }
  }

  factors.push({
    key: 'id',
    labelAr: 'رقم الهوية / المعرف',
    labelEn: 'ID / Identifier',
    status: idStatus,
    customerVal: customer.identifier || null,
    recordVal: match.recordIdNumber || null,
    detailAr: idDetailAr,
    detailEn: idDetailEn,
  });

  // 4. Name & Typology Analysis
  const isCommonName = COMMON_ARABIC_NAMES.has(custNameClean) || COMMON_ARABIC_NAMES.has(matchNameClean);
  let nameStatus: FactorComparison['status'] = 'partial';
  let nameDetailAr = `نسبة تطابق الاسم ${match.percent}%`;
  let nameDetailEn = `Name similarity score: ${match.percent}%`;

  if (match.percent >= 98) {
    nameStatus = 'match';
    nameDetailAr = `تطابق اسم تام أو شبه تام (${match.percent}%)${isCommonName ? '، مع كونه اسماً شائعاً جداً' : ''}.`;
    nameDetailEn = `Exact or near-exact name match (${match.percent}%)${isCommonName ? ' (common namesake pattern)' : ''}.`;
  } else if (isCommonName) {
    nameStatus = 'conflict';
    nameDetailAr = `تشابه سطحي ناجم عن كثرة الشيوع لاسم (${customer.name}) في سجلات المنطقة.`;
    nameDetailEn = `Superficial similarity due to very common namesake (${customer.name}).`;
  }

  factors.push({
    key: 'name',
    labelAr: 'تحليل الاسم والتشابه',
    labelEn: 'Name & Typology Analysis',
    status: nameStatus,
    customerVal: customer.name,
    recordVal: match.name,
    detailAr: nameDetailAr,
    detailEn: nameDetailEn,
  });

  // 5. Decision Synthesis & Scoring
  let recommendation: 'dismissed' | 'confirmed' | 'needs_info' = 'dismissed';
  let confidence = 92;
  let headlineAr = '';
  let headlineEn = '';
  let summaryAr = '';
  let summaryEn = '';
  let auditRationaleAr = '';
  let auditRationaleEn = '';

  // Rule A: Hard Confirmation (ID matches OR exact DOB + Country match)
  if (idStatus === 'match') {
    recommendation = 'confirmed';
    confidence = 99;
    headlineAr = 'توصية النظام: اشتباه حقيقي مؤكد (True Positive)';
    headlineEn = 'System Recommendation: Confirmed Match (True Positive)';
    summaryAr = `توصية النظام: اشتباه حقيقي مؤكد (True Positive) لتطابق الرقم المعرف الرسمي والاسم (${match.percent}%). يُوصى بتأكيد الاشتباه فوراً واتخاذ الإجراءات التحفظية المقررة ورفع بلاغ SAR.`;
    summaryEn = `System Recommendation: Confirmed Match (True Positive) based on matching official ID and name similarity (${match.percent}%). Immediate confirmation and SAR filing recommended.`;
    auditRationaleAr = `تم تأكيد المطابقة بعد التحقق الآلي المعزز: تطابق كامل في الاسم (${customer.name}) والرقم المعرف الرسمي (${customer.identifier || match.recordIdNumber}). الكيان مطابق تماماً لقوائم المراقبة ويُحال لمسؤول الامتثال لاتخاذ الإجراءات التحفظية ورفع تقرير SAR لوحدة المعلومات المالية.`;
    auditRationaleEn = `Match confirmed following automated compliance verification: Complete alignment on name (${customer.name}) and official identifier (${customer.identifier || match.recordIdNumber}). Direct hit confirmed against international watchlists.`;
  }
  else if (dobStatus === 'match' && (countryStatus === 'match' || match.percent >= 92)) {
    recommendation = 'confirmed';
    confidence = 95;
    headlineAr = 'توصية النظام: اشتباه حقيقي عالي الاحتمال (High-Confidence Match)';
    headlineEn = 'System Recommendation: High-Confidence True Match';
    summaryAr = `توصية النظام: اشتباه حقيقي عالي الاحتمال لتطابق الاسم بنسبة ${match.percent}% وتطابق تاريخ/سنة الميلاد (${custDobYear || customer.date_of_birth}) وتوافق النطاق الجغرافي. يُوصى بتأكيد المطابقة والمراجعة الدقيقة.`;
    summaryEn = `System Recommendation: High-confidence match based on ${match.percent}% name similarity, matching birth year (${custDobYear || customer.date_of_birth}), and jurisdictional compatibility. Confirmation recommended.`;
    auditRationaleAr = `تم تأكيد المطابقة استناداً إلى تطابق الاسم بنسبة ${match.percent}% مع توافق قاطع في تاريخ الميلاد (${custDobYear || customer.date_of_birth}) والدولة المعنية. استيفاء معايير التحقق الإيجابي المقررة وفق سياسة مكافحة غسل الأموال.`;
    auditRationaleEn = `Match confirmed based on ${match.percent}% name similarity along with exact alignment on birth date (${custDobYear || customer.date_of_birth}) and jurisdiction. Meets positive match threshold under AML policy.`;
  }
  // Rule B: Clear False Positive (DOB Conflict - e.g. 1991 vs 1965, or Country + ID Conflict)
  else if (dobStatus === 'conflict') {
    recommendation = 'dismissed';
    confidence = dobDiffYears && dobDiffYears >= 5 ? 97 : 93;
    headlineAr = 'توصية النظام: تشابه أسماء سطحي (False Positive)';
    headlineEn = 'System Recommendation: Superficial Name Match (False Positive)';

    const diffText = dobDiffYears ? ` (العميل ${custDobYear} والمدرج بقائمة العقوبات ${recDobYear} بفارق ${dobDiffYears} سنة)` : '';
    const diffTextEn = dobDiffYears ? ` (Customer: ${custDobYear} vs Watchlist Entity: ${recDobYear}, difference of ${dobDiffYears} years)` : '';
    const countryDiffText = countryStatus === 'conflict' ? ' واختلاف الجنسية والولاية القضائية' : '';
    const countryDiffTextEn = countryStatus === 'conflict' ? ' and differing nationality/jurisdiction' : '';

    summaryAr = `توصية النظام: تشابه أسماء سطحي (False Positive) نظراً لاختلاف سنة الميلاد${diffText}${countryDiffText}... يُقترح استبعاد المطابقة مع توثيق السبب آلياً.`;
    summaryEn = `System Recommendation: False Positive due to birth year discrepancy${diffTextEn}${countryDiffTextEn}... Dismissal recommended with automated audit justification.`;

    auditRationaleAr = `تم استبعاد المطابقة بعد الفحص الدقيق والتحقق الآلي المعزز بالذكاء الاصطناعي: ثبت وجود إيجابي كاذب (False Positive) وتشابه أسماء سطحي. حيث تبين تعارض قاطع في سنة الميلاد (سنة ميلاد العميل: ${custDobYear ?? 'غير مطابقة'} مقابل الكيان المدرج: ${recDobYear ?? 'غير مطابقة'}${dobDiffYears ? ` بفارق ${dobDiffYears} سنة` : ''})${countryStatus === 'conflict' ? `، مع اختلاف الدولة ودائرة الاختصاص (${custCountry} مقابل ${recCountry})` : ''}${isCommonName ? '، والاسم من الأسماء المركبة الشائعة' : ''}. وبناءً عليه لا يوجد أي ارتباط حقيقي بالكيان المدرج.`;
    auditRationaleEn = `Match dismissed following compliance verification: Confirmed False Positive due to definitive chronological birth year discrepancy (Customer: ${custDobYear ?? 'N/A'} vs List Record: ${recDobYear ?? 'N/A'}${dobDiffYears ? ` with ${dobDiffYears} years difference` : ''})${countryStatus === 'conflict' ? `, plus differing jurisdiction (${custCountry} vs ${recCountry})` : ''}. No actual nexus to the sanctioned entity.`;
  }
  // Rule C: Country Conflict with Common Name
  else if (countryStatus === 'conflict' && (isCommonName || match.percent < 90)) {
    recommendation = 'dismissed';
    confidence = 89;
    headlineAr = 'توصية النظام: تشابه سطحي لاختلاف الاختصاص الجغرافي';
    headlineEn = 'System Recommendation: Jurisdictional Mismatch (False Positive)';
    summaryAr = `توصية النظام: تشابه أسماء سطحي (False Positive) لاختلاف الدولة والاختصاص القضائي (${custCountry} مقابل ${recCountry}) مع كثرة شيوع الاسم... يُقترح استبعاد المطابقة مع توثيق السبب آلياً.`;
    summaryEn = `System Recommendation: False Positive due to clear jurisdictional mismatch (${custCountry} vs ${recCountry}) combined with common namesake pattern. Dismissal recommended.`;
    auditRationaleAr = `تم استبعاد المطابقة لاختلاف النطاق الجغرافي ودولة التسجيل (${custCountry} للعميل مقابل ${recCountry} للمدرج) وانتفاء أي صلة بالجهة المعنية، مع ثبوت كون التشابه عائداً لشيوع الاسم.`;
    auditRationaleEn = `Match dismissed due to jurisdictional divergence (${custCountry} for customer vs ${recCountry} for list record) with zero geographic nexus, confirming superficial name collision.`;
  }
  // Rule D: Missing Crucial Identifiers on High Score -> Needs More Info
  else if (match.percent >= 85 && dobStatus === 'missing' && countryStatus !== 'conflict') {
    recommendation = 'needs_info';
    confidence = 76;
    headlineAr = 'توصية النظام: حاجة لمستندات إضافية (Needs More Info)';
    headlineEn = 'System Recommendation: Additional Verification Required';
    summaryAr = `توصية النظام: تشابه في الاسم بنسبة ${match.percent}% مع غياب تاريخ الميلاد للمدرج في القائمة، يُوصى بطلب وثيقة رسمية إضافية لإجراء التحقق الدقيق قبل البت النهائي.`;
    summaryEn = `System Recommendation: High name similarity (${match.percent}%) but watchlist record lacks birth date. Requesting official identification documents is recommended before final resolution.`;
    auditRationaleAr = `تم تعليق القرار لطلب مستندات ثبوتية إضافية: وجود تشابه في الاسم بنسبة ${match.percent}% مع غياب تاريخ الميلاد والرقم المعرف في بيانات القائمة الرسمية. يتطلب تزويدنا بصورة جواز السفر وسجل العناوين للتأكد قبل استبعاد أو تأكيد الحالة.`;
    auditRationaleEn = `Decision suspended pending additional supporting documents: High name similarity of ${match.percent}%, but list record lacks date of birth or unique national ID. Additional passport/KYC documents requested.`;
  }
  // Rule E: Default Lower Confidence Discrepancy -> Dismiss
  else {
    recommendation = 'dismissed';
    confidence = 84;
    headlineAr = 'توصية النظام: تشابه أسماء سطحي (False Positive)';
    headlineEn = 'System Recommendation: Superficial Name Match (False Positive)';
    summaryAr = `توصية النظام: تشابه أسماء سطحي (False Positive) لعدم توافر أي مؤشرات إيجابية مؤيدة للمطابقة، يُقترح استبعاد المطابقة وتوثيق السبب.`;
    summaryEn = `System Recommendation: False Positive due to lack of corroborating identifying factors. Dismissal recommended.`;
    auditRationaleAr = `تم استبعاد المطابقة نظراً لكون نسبة التشابه غير معززة بأي بيانات ثبوتية مطابقة (تاريخ ميلاد أو رقم هوية أو صلة جغرافية)، مما يرجح تشابه الأسماء العرضي.`;
    auditRationaleEn = `Match dismissed as the similarity score is unsupported by corroborating secondary attributes (DOB, ID, or geography), confirming an incidental name collision.`;
  }

  const badgeAr = recommendation === 'confirmed'
    ? 'اشتباه حقيقي مؤكد (True Positive)'
    : recommendation === 'needs_info'
      ? 'حاجة لمستندات إضافية (Needs Info)'
      : 'تشابه أسماء سطحي (False Positive)';

  const badgeEn = recommendation === 'confirmed'
    ? 'Confirmed Match (True Positive)'
    : recommendation === 'needs_info'
      ? 'Additional Info Required'
      : 'Superficial Match (False Positive)';

  return {
    recommendation,
    recommendationBadgeAr: badgeAr,
    recommendationBadgeEn: badgeEn,
    headlineAr,
    headlineEn,
    confidence,
    summaryAr,
    summaryEn,
    auditRationaleAr,
    auditRationaleEn,
    factors,
    isFalsePositive: recommendation === 'dismissed',
    isConfirmed: recommendation === 'confirmed',
    isNeedsInfo: recommendation === 'needs_info',
  };
}
