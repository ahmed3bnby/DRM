import type { Customer } from './customers';

export type SarReportType = 'SAR' | 'STR' | 'HRC' | 'AIF';

export type SarReasonCategory =
  | 'sanctions_match'
  | 'fatf_high_risk'
  | 'adverse_media_crime'
  | 'pep_wealth_source'
  | 'fraud_forgery'
  | 'unusual_transaction'
  | 'cash_threshold_exceeded'
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
  };
}

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
