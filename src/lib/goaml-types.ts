import type { Customer } from './customers';

export type SarReportType = 'SAR' | 'STR' | 'REAR' | 'FARI' | 'DPMSR' | 'HRC' | 'AIF';

export type SarReasonCategory =
  | 'sanctions_match'
  | 'fatf_high_risk'
  | 'adverse_media_crime'
  | 'pep_wealth_source'
  | 'fraud_forgery'
  | 'unusual_transaction'
  | 'cash_threshold_exceeded'
  | 'real_estate_cash_threshold'
  | 'real_estate_corporate_buyer'
  | 'virtual_asset_crypto_payment'
  | 'precious_metals_cash_threshold'
  | 'other_suspicion';

export type SarActionTaken =
  | 'freeze_assets'
  | 'refuse_business'
  | 'terminate_relationship'
  | 'escalate_senior_management'
  | 'enhanced_monitoring'
  | 'pending_investigation';

export interface SarReportRecord {
  id: string;
  organization_id: string;
  customer_id: string;
  reference_number: string;
  report_type: SarReportType;
  reason_category: SarReasonCategory;
  narrative: string;
  action_taken: SarActionTaken;
  created_by?: string | null;
  creator_name?: string | null;
  created_at: string;
  status: 'draft' | 'submitted' | 'archived';
  fiu_payload: {
    customerSnapshot: Partial<Customer>;
    officerName: string;
    officerRole: string;
    screeningSummary?: string;
    suspiciousAmount?: number;
    currency?: string;
    submissionDate: string;
    xmlGenerated?: string;
    // DNFBP / REAR / FARI Specific Fields:
    propertyDetails?: {
      titleDeedNumber?: string;
      propertyType?: 'residential' | 'commercial' | 'industrial' | 'land';
      emirate?: string;
      projectOrBuilding?: string;
      developerOrSeller?: string;
    };
    paymentMode?: 'cash' | 'crypto_virtual_asset' | 'bank_transfer' | 'cheque' | 'mixed';
    virtualAssetDetails?: {
      cryptoType?: string;
      walletAddress?: string;
      txHash?: string;
    };
    dnfbpSector?: string;
  };
}

export const SAR_REPORT_TYPE_LABELS: Record<SarReportType, { ar: string; en: string; code: string; descAr: string; descEn: string }> = {
  SAR: {
    code: 'SAR',
    ar: 'تقرير نشاط مشبوه (Suspicious Activity Report)',
    en: 'Suspicious Activity Report (SAR)',
    descAr: 'الإبلاغ عن سلوك أو اشتباه عام دون اشتراط حدوث حركة مالية منجزة.',
    descEn: 'Reporting suspicious behavior without completed transaction prerequisite.',
  },
  STR: {
    code: 'STR',
    ar: 'تقرير معاملة مشبوهة (Suspicious Transaction Report)',
    en: 'Suspicious Transaction Report (STR)',
    descAr: 'الإبلاغ عن حوالة أو عملية مالية محددة يشتبه في ارتباطها بغسل الأموال.',
    descEn: 'Reporting a specific transaction suspected of money laundering or illicit origin.',
  },
  REAR: {
    code: 'REAR',
    ar: 'تقرير الصفقات العقارية (Real Estate Activity Report)',
    en: 'Real Estate Activity Report (REAR)',
    descAr: 'إلزامي للوسطاء والمطورين لصفقات العقارات النقدية (≥ 55 ألف درهم) أو الكيانات الاعتبارية أو الكريبتو.',
    descEn: 'Mandatory for real estate brokers & developers for cash (≥ 55k AED), corporate, or crypto deals.',
  },
  FARI: {
    code: 'FARI',
    ar: 'تقرير التدفقات النقدية والأصول الافتراضية (Funds & Virtual Assets Report)',
    en: 'Funds & Virtual Assets Report (FARI)',
    descAr: 'إلزامي لقطاعات DNFBP للمعاملات النقدية الكبيرة (≥ 55,000 درهم) أو الدفع بالعملات الرقمية.',
    descEn: 'Mandatory report for high-value cash transactions (≥ 55k AED) or virtual assets.',
  },
  DPMSR: {
    code: 'DPMSR',
    ar: 'تقرير تجار المعادن الثمينة والأحجار الكريمة (Precious Metals & Stones)',
    en: 'Dealers in Precious Metals and Stones Report (DPMSR)',
    descAr: 'إلزامي لتجار الذهب والمجوهرات والألماس عند استلام مدفوعات نقدية ≥ 55 ألف درهم.',
    descEn: 'Mandatory for gold and jewelry dealers receiving cash payments ≥ 55,000 AED.',
  },
  HRC: {
    code: 'HRC',
    ar: 'تقرير التعامل مع دول عالية المخاطر (High Risk Country Report)',
    en: 'High Risk Country Report (HRC)',
    descAr: 'الإبلاغ عن أي تعامل مالي مع جهات تابعة لدول القائمة الرمادية أو السوداء لـ FATF.',
    descEn: 'Reporting transactions with parties originating from FATF high-risk jurisdictions.',
  },
  AIF: {
    code: 'AIF',
    ar: 'ملف معلومات إضافية لوحدة المعلومات المالية (Additional Information File)',
    en: 'Additional Information File (AIF)',
    descAr: 'إرسال مستندات أو إيضاحات إضافية طلبتها وحدة المعلومات المالية الإماراتية (FIU).',
    descEn: 'Supplementary documentation requested by the UAE Financial Intelligence Unit.',
  },
};

export const SAR_REASON_LABELS: Record<SarReasonCategory, { ar: string; en: string }> = {
  sanctions_match: {
    ar: 'مطابقة مؤكدة مع قوائم العقوبات / الإرهاب (Sanctions / Counter-Terrorism)',
    en: 'Confirmed match against Sanctions / Counter-Terrorism List'
  },
  fatf_high_risk: {
    ar: 'ارتباط بدولة عالية المخاطر / القائمة السوداء لـ FATF (High Risk Jurisdiction)',
    en: 'Linkage to High Risk Jurisdiction / FATF Call for Action'
  },
  adverse_media_crime: {
    ar: 'أخبار سلبية عن جرائم مالية أو فساد أو غسل أموال (Adverse Media / Financial Crime)',
    en: 'Adverse Media / Public Allegations of Financial Crime'
  },
  pep_wealth_source: {
    ar: 'شخصية سياسية (PEP) مع تعذر إثبات مشروعية مصدر الثروة (PEP / Unexplained Wealth)',
    en: 'Politically Exposed Person with Unsubstantiated Source of Wealth'
  },
  fraud_forgery: {
    ar: 'تزوير مستندات هوية أو تقديم بيانات مضللة (Identity Fraud / Forgery)',
    en: 'Identity Fraud, Forgery, or Misleading Information'
  },
  unusual_transaction: {
    ar: 'نمط معاملات غير مبرر اقتصادياً أو مشبوه (Unusual Transaction Pattern)',
    en: 'Unusual, Complex, or Economically Unjustified Pattern'
  },
  cash_threshold_exceeded: {
    ar: 'معاملة نقدية تتجاوز الحد الإلزامي (Cash Threshold Exceeded >= AED 50k)',
    en: 'Cash Transaction Exceeding Mandatory Threshold'
  },
  real_estate_cash_threshold: {
    ar: 'صفقة عقارية تتضمن دفعات نقدية ≥ 55,000 درهم إماراتي (REAR Cash Threshold)',
    en: 'Real estate transaction involving cash payments >= AED 55,000'
  },
  real_estate_corporate_buyer: {
    ar: 'شراء عقار بواسطة شركة أو كيان اعتباري أو صندوق ائتماني (REAR Corporate/Trust)',
    en: 'Freehold real estate purchase by a legal entity or trust'
  },
  virtual_asset_crypto_payment: {
    ar: 'سداد صفقة كلياً أو جزئياً بواسطة أصول افتراضية / عملات مشفرة (Crypto Payment)',
    en: 'Payment made using Virtual Assets or Cryptocurrencies'
  },
  precious_metals_cash_threshold: {
    ar: 'شراء ذهب ومعادن ثمينة نقداً بمبلغ ≥ 55,000 درهم (DPMSR Cash Threshold)',
    en: 'Purchase of gold/precious metals/stones in cash >= AED 55,000'
  },
  other_suspicion: {
    ar: 'شبهات غسل أموال أو تمويل إرهاب أخرى (Other AML/CFT Suspicion)',
    en: 'Other General AML/CFT Grounds of Suspicion'
  }
};

export const SAR_ACTION_LABELS: Record<SarActionTaken, { ar: string; en: string }> = {
  freeze_assets: {
    ar: 'تجميد فوري للأموال والأصول وإخطار المكتب التنفيذي (Immediate Asset Freeze)',
    en: 'Immediate Asset Freeze & Notification to EOCN'
  },
  refuse_business: {
    ar: 'رفض فتح الحساب أو رفض بدء علاقة العمل (Refusal of Business)',
    en: 'Refusal to Establish Business Relationship'
  },
  terminate_relationship: {
    ar: 'إنهاء علاقة العمل القائمة وتصفية المعاملات (Termination of Relationship)',
    en: 'Termination of Existing Customer Relationship'
  },
  escalate_senior_management: {
    ar: 'تصعيد إلى مسؤول الامتثال والإدارة العليا لاتخاذ القرار (Senior Escalation)',
    en: 'Escalation to MLRO and Senior Management'
  },
  enhanced_monitoring: {
    ar: 'وضع العميل تحت المراقبة المشددة المستمرة 24/7 (Intensive Surveillance)',
    en: 'Placed under Intensive Continuous 24/7 Surveillance'
  },
  pending_investigation: {
    ar: 'قيد التحري وجمع الأدلة والمستندات الإضافية (Under Investigation)',
    en: 'Pending Internal Investigation & Evidence Gathering'
  }
};
