'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  FileText,
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Building,
  User,
  ExternalLink,
  ChevronDown,
  History,
  ShieldCheck,
  Building2,
  Coins,
  Landmark,
  Sparkles,
  MapPin,
  Receipt,
} from 'lucide-react';
import type { Customer } from '@/lib/customers';
import type { SarReportRecord, SarReportType, SarReasonCategory, SarActionTaken } from '@/lib/goaml-types';
import { SAR_REPORT_TYPE_LABELS, SAR_REASON_LABELS, SAR_ACTION_LABELS } from '@/lib/goaml-types';
import { countryName, flag } from '@/components/ui';
import type { Locale } from '@/lib/i18n';

export default function SarFilingView({
  customer,
  initialReports,
  initialReportType,
  actor,
  locale = 'ar',
}: {
  customer: Customer;
  initialReports: SarReportRecord[];
  initialReportType?: string;
  actor: { id: string; displayName: string; role: string; organizationName: string };
  locale: Locale;
}) {
  const isEn = locale === 'en';
  const [reports, setReports] = useState<SarReportRecord[]>(initialReports);
  const [selectedReport, setSelectedReport] = useState<SarReportRecord | null>(
    initialReports.length > 0 ? initialReports[0] : null
  );

  const parsedInitType: SarReportType =
    initialReportType === 'REAR' ? 'REAR' :
    initialReportType === 'FARI' ? 'FARI' :
    initialReportType === 'DPMSR' ? 'DPMSR' :
    initialReportType === 'STR' ? 'STR' : 'SAR';

  const [activeMode, setActiveMode] = useState<'view' | 'new'>(
    initialReportType || initialReports.length === 0 ? 'new' : 'view'
  );

  // Form State
  const [reportType, setReportType] = useState<SarReportType>(parsedInitType);
  const [reasonCategory, setReasonCategory] = useState<SarReasonCategory>(
    parsedInitType === 'REAR' ? 'real_estate_cash_threshold' :
    parsedInitType === 'FARI' ? 'virtual_asset_crypto_payment' :
    customer.screening_status === 'potential_match' ? 'sanctions_match' : 'unusual_transaction'
  );
  const [actionTaken, setActionTaken] = useState<SarActionTaken>('escalate_senior_management');
  const [suspiciousAmount, setSuspiciousAmount] = useState<string>(
    parsedInitType === 'REAR' || parsedInitType === 'FARI' ? '55000' : ''
  );
  const [narrative, setNarrative] = useState<string>('');

  // DNFBP / REAR / FARI Specific Fields
  const [propertyDetails, setPropertyDetails] = useState({
    titleDeedNumber: '',
    propertyType: 'residential' as 'residential' | 'commercial' | 'industrial' | 'land',
    emirate: 'Dubai',
    projectOrBuilding: '',
    developerOrSeller: '',
  });

  const [paymentMode, setPaymentMode] = useState<'cash' | 'crypto_virtual_asset' | 'bank_transfer' | 'cheque' | 'mixed'>(
    parsedInitType === 'FARI' ? 'crypto_virtual_asset' : 'cash'
  );

  const [virtualAssetDetails, setVirtualAssetDetails] = useState({
    cryptoType: 'USDT (TRC-20)',
    walletAddress: '',
    txHash: '',
  });

  const [dnfbpSector, setDnfbpSector] = useState<string>(
    parsedInitType === 'REAR' ? 'Real Estate Brokerage / Development' :
    parsedInitType === 'FARI' ? 'DNFBP / Virtual Asset Service' :
    'Financial Institution'
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const applyPreset = (type: SarReportType) => {
    setReportType(type);
    if (type === 'REAR') {
      setReasonCategory('real_estate_cash_threshold');
      setDnfbpSector('Real Estate Brokerage / Development');
      if (!suspiciousAmount || suspiciousAmount === '0') setSuspiciousAmount('55000');
      if (!narrative) {
        setNarrative(
          isEn
            ? `Mandatory statutory REAR filing for freehold real estate transaction. Pursuant to UAE Ministry of Economy and FIU directives for cash payments >= AED 55,000, corporate buyers, or virtual asset settlement.`
            : `إبلاغ إلزامي عن صفقة عقارية (goAML REAR) تنفيذاً لتعاميم وزارة الاقتصاد ووحدة المعلومات المالية الإماراتية بشأن التعاملات العقارية المتضمنة دفعات نقدية ≥ 55,000 درهم إماراتي أو أطراف اعتبارية.`
        );
      }
    } else if (type === 'FARI') {
      setReasonCategory('virtual_asset_crypto_payment');
      setPaymentMode('crypto_virtual_asset');
      setDnfbpSector('DNFBP / Virtual Asset Service');
      if (!suspiciousAmount || suspiciousAmount === '0') setSuspiciousAmount('75000');
      if (!narrative) {
        setNarrative(
          isEn
            ? `Mandatory statutory FARI filing for transaction involving virtual assets (crypto) or high-value physical cash payments pursuant to UAE AML/CFT regulations.`
            : `إبلاغ إلزامي عن تدفقات نقدية أو أصول افتراضية (goAML FARI) لقطاع الأعمال والمهن غير المالية المحددة (DNFBPs) للمعاملات المنفذة عبر العملات الرقمية أو النقدية عالية القيمة.`
        );
      }
    } else if (type === 'SAR') {
      setReasonCategory(customer.screening_status === 'potential_match' ? 'sanctions_match' : 'unusual_transaction');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!narrative.trim()) {
      setErrorMessage(isEn ? 'Please provide the suspicion narrative and findings.' : 'يرجى كتابة حيثيات ومبررات الاشتباه في الحقل المخصص.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/profiles/${customer.reference}/sar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          reasonCategory,
          narrative,
          actionTaken,
          suspiciousAmount: suspiciousAmount ? parseFloat(suspiciousAmount) : undefined,
          currency: 'AED',
          propertyDetails: reportType === 'REAR' ? propertyDetails : undefined,
          paymentMode,
          virtualAssetDetails: (paymentMode === 'crypto_virtual_asset' || reportType === 'FARI') ? virtualAssetDetails : undefined,
          dnfbpSector,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit SAR');
      }

      setReports([data.report, ...reports]);
      setSelectedReport(data.report);
      setActiveMode('view');
      setSuccessBanner(
        isEn
          ? `Report ${data.report.reference_number} officially recorded and ready for goAML export.`
          : `تم اعتماد وتوثيق التقرير ${data.report.reference_number} بنجاح وهو جاهز للرفع على goAML.`
      );
    } catch (err: any) {
      setErrorMessage(err.message || (isEn ? 'Failed to file report' : 'حدث خطأ أثناء حفظ التقرير'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="sar-filing-container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Navigation Topbar */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Link
          href={`/profiles/${customer.reference}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '14px', textDecoration: 'none', fontWeight: 500 }}
        >
          {isEn ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
          <span>{isEn ? 'Back to Customer Profile' : 'العودة لملف العميل'}</span>
        </Link>

        <div style={{ display: 'flex', gap: '10px' }}>
          {reports.length > 0 && activeMode === 'new' && (
            <button
              onClick={() => setActiveMode('view')}
              className="button secondary sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <History size={16} />
              <span>{isEn ? 'View Filed Reports' : 'عرض التقارير المعتمدة'} ({reports.length})</span>
            </button>
          )}

          {activeMode === 'view' && (
            <button
              onClick={() => {
                setActiveMode('new');
                setSuccessBanner(null);
                setErrorMessage(null);
              }}
              className="button primary sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ShieldAlert size={16} />
              <span>{isEn ? 'File New SAR Report' : 'إعداد بلاغ اشتباه جديد (SAR)'}</span>
            </button>
          )}
        </div>
      </div>

      {successBanner && (
        <div className="no-print success-message" role="status" style={{ marginBottom: '20px' }}>
          <CheckCircle2 size={18} />
          <span>{successBanner}</span>
        </div>
      )}

      {errorMessage && (
        <div className="no-print error-message" role="alert" style={{ marginBottom: '20px' }}>
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Mode 1: CREATE NEW SAR FORM */}
      {activeMode === 'new' && (
        <section className="panel" style={{ background: '#ffffff', borderRadius: '12px', padding: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#fef2f2', color: '#991b1b', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
              <ShieldAlert size={15} />
              <span>UAE FIU - goAML STATUTORY REPORTING</span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
              {isEn ? 'File Suspicious Activity / Transaction Report (SAR / STR)' : 'إعداد ورفع تقرير اشتباه لوحدة المعلومات المالية (goAML)'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
              {isEn
                ? 'Generate official reporting dossiers and compliant XML schemas for immediate filing with the UAE Financial Intelligence Unit (goAML) in accordance with Federal Decree-Law No. (20) of 2018.'
                : 'توليد التقارير الرسمية ونماذج XML المتوافقة مع بوابة goAML التابعة لوحدة المعلومات المالية الإماراتية، تنفيذاً للمرسوم بقانون اتحادي رقم (20) لسنة 2018 وتعديلاته.'}
            </p>
          </div>

          {/* Customer Summary Mini-Card */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', fontSize: '13px' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Customer Name' : 'اسم العميل'}</span>
              <strong style={{ color: '#0f172a' }}>{customer.name}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Reference' : 'المرجع'}</span>
              <span style={{ fontFamily: 'monospace' }}>{customer.reference}</span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Jurisdiction' : 'الدولة'}</span>
              <span>{flag(customer.country)} {countryName(customer.country, locale)}</span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Identifier / CR' : 'الهوية / السجل'}</span>
              <span style={{ fontFamily: 'monospace' }}>{customer.identifier || 'N/A'}</span>
            </div>
          </div>

          {/* Quick Presets Bar */}
          <div className="sar-presets">
            <div className="sar-presets-title">
              <Sparkles size={15} />
              <strong>{isEn ? 'Quick-fill presets (UAE)' : 'نماذج التعبئة السريعة'}</strong>
            </div>
            <div className="sar-presets-row" role="group">
              <button type="button" className={`sar-preset${reportType === 'REAR' ? ' active' : ''}`} aria-pressed={reportType === 'REAR'} onClick={() => applyPreset('REAR')}>
                <Building2 size={14} />
                <span>{isEn ? 'Real Estate Deal (REAR)' : 'الصفقات العقارية (REAR)'}</span>
              </button>
              <button type="button" className={`sar-preset${reportType === 'FARI' ? ' active' : ''}`} aria-pressed={reportType === 'FARI'} onClick={() => applyPreset('FARI')}>
                <Coins size={14} />
                <span>{isEn ? 'Funds & Virtual Assets (FARI)' : 'التدفقات النقدية والأصول الافتراضية (FARI)'}</span>
              </button>
              <button type="button" className={`sar-preset${reportType === 'SAR' ? ' active' : ''}`} aria-pressed={reportType === 'SAR'} onClick={() => applyPreset('SAR')}>
                <ShieldAlert size={14} />
                <span>{isEn ? 'Suspicious Activity (SAR / STR)' : 'بلاغ اشتباه عام (SAR / STR)'}</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '20px' }}>
              {/* Report Type */}
              <div>
                <label htmlFor="sar-field-1" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {isEn ? 'goAML Report Code / Type *' : 'نوع البلاغ الرقابي (goAML Code) *'}
                </label>
                <select id="sar-field-1"
                  value={reportType}
                  onChange={e => applyPreset(e.target.value as SarReportType)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#fff' }}
                  required
                >
                  <option value="SAR">{isEn ? 'SAR - Suspicious Activity Report' : 'SAR — بلاغ نشاط مشبوه (بدون معاملة منجزة)'}</option>
                  <option value="STR">{isEn ? 'STR - Suspicious Transaction Report' : 'STR — بلاغ معاملة مشبوهة مالياً'}</option>
                  <option value="REAR">{isEn ? 'REAR - Real Estate Activity Report' : 'REAR — تقرير الصفقات العقارية (وزارة الاقتصاد/FIU)'}</option>
                  <option value="FARI">{isEn ? 'FARI - Funds & Virtual Assets Report' : 'FARI — تقرير التدفقات النقدية والأصول الافتراضية (≥55k/Crypto)'}</option>
                  <option value="DPMSR">{isEn ? 'DPMSR - Dealers in Precious Metals' : 'DPMSR — تقرير تجار المعادن الثمينة والأحجار'}</option>
                  <option value="HRC">{isEn ? 'HRC - High Risk Country Report' : 'HRC — تقرير ارتباط بدولة عالية المخاطر (القائمة السوداء)'}</option>
                  <option value="AIF">{isEn ? 'AIF - Additional Information File' : 'AIF — ملف معلومات إضافية لبلاغ سابق'}</option>
                </select>
              </div>

              {/* Suspicious Amount (optional) */}
              <div>
                <label htmlFor="sar-field-2" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {isEn ? 'Estimated Amount in Suspicion (AED)' : 'قيمة المعاملة المشتبه بها (درهم إماراتي - اختياري)'}
                </label>
                <input id="sar-field-2"
                  type="number"
                  placeholder="0.00"
                  value={suspiciousAmount}
                  onChange={e => setSuspiciousAmount(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>
            </div>

            {/* Reason Category */}
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="sar-field-3" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {isEn ? 'Reason for Suspicion Category *' : 'تصنيف ومؤشر سبب الاشتباه (Reason Category) *'}
              </label>
              <select id="sar-field-3"
                value={reasonCategory}
                onChange={e => setReasonCategory(e.target.value as SarReasonCategory)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#fff' }}
                required
              >
                {Object.entries(SAR_REASON_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {isEn ? v.en : v.ar}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Taken */}
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="sar-field-4" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {isEn ? 'Action Taken by Reporting Entity *' : 'الإجراء المتخذ من قِبل المنشأة المبلّغة *'}
              </label>
              <select id="sar-field-4"
                value={actionTaken}
                onChange={e => setActionTaken(e.target.value as SarActionTaken)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#fff' }}
                required
              >
                {Object.entries(SAR_ACTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {isEn ? v.en : v.ar}
                  </option>
                ))}
              </select>
            </div>

            {/* REAR - Real Estate Deal Details */}
            {reportType === 'REAR' && (
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '18px 20px', marginBottom: '22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Building2 size={16} style={{ color: '#0284c7' }} />
                  <strong style={{ fontSize: '13.5px', color: '#0369a1' }}>
                    {isEn ? 'Real Estate Property & Transaction Particulars (REAR Requirements):' : 'بيانات العقار والصفقة العقارية (المتطلبات الإلزامية لـ REAR):'}
                  </strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label htmlFor="sar-field-5" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      {isEn ? 'Title Deed No. *' : 'رقم سند الملكية / العقد *'}
                    </label>
                    <input id="sar-field-5"
                      type="text"
                      placeholder="e.g. 2024-TD-89211"
                      value={propertyDetails.titleDeedNumber}
                      onChange={e => setPropertyDetails({ ...propertyDetails, titleDeedNumber: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="sar-field-6" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      {isEn ? 'Emirate *' : 'الإمارة *'}
                    </label>
                    <select id="sar-field-6"
                      value={propertyDetails.emirate}
                      onChange={e => setPropertyDetails({ ...propertyDetails, emirate: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                      required
                    >
                      <option value="Dubai">{isEn ? 'Dubai' : 'دبي'}</option>
                      <option value="Abu Dhabi">{isEn ? 'Abu Dhabi' : 'أبوظبي'}</option>
                      <option value="Sharjah">{isEn ? 'Sharjah' : 'الشارقة'}</option>
                      <option value="Ajman">{isEn ? 'Ajman' : 'عجمان'}</option>
                      <option value="Ras Al Khaimah">{isEn ? 'Ras Al Khaimah' : 'رأس الخيمة'}</option>
                      <option value="Umm Al Quwain">{isEn ? 'Umm Al Quwain' : 'أم القيوين'}</option>
                      <option value="Fujairah">{isEn ? 'Fujairah' : 'الفجيرة'}</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="sar-field-7" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      {isEn ? 'Property Type *' : 'نوع العقار *'}
                    </label>
                    <select id="sar-field-7"
                      value={propertyDetails.propertyType}
                      onChange={e => setPropertyDetails({ ...propertyDetails, propertyType: e.target.value as any })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                      required
                    >
                      <option value="residential">{isEn ? 'Residential (سكني)' : 'سكني (شقة / فيلا / تاون هاوس)'}</option>
                      <option value="commercial">{isEn ? 'Commercial (تجاري)' : 'تجاري (مكتب / محل / مول)'}</option>
                      <option value="industrial">{isEn ? 'Industrial (صناعي)' : 'صناعي / مستودعات'}</option>
                      <option value="land">{isEn ? 'Land Plot (أرض فضاء)' : 'أرض فضاء / تطوير عقاري'}</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                  <div>
                    <label htmlFor="sar-field-8" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      {isEn ? 'Project / Building / Community' : 'اسم المشروع أو البرج أو المجمع'}
                    </label>
                    <input id="sar-field-8"
                      type="text"
                      placeholder="e.g. Burj Crown / Palm Residences"
                      value={propertyDetails.projectOrBuilding}
                      onChange={e => setPropertyDetails({ ...propertyDetails, projectOrBuilding: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label htmlFor="sar-field-9" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      {isEn ? 'Developer / Seller Entity' : 'المطور العقاري أو البائع'}
                    </label>
                    <input id="sar-field-9"
                      type="text"
                      placeholder="e.g. Emaar Properties PJSC"
                      value={propertyDetails.developerOrSeller}
                      onChange={e => setPropertyDetails({ ...propertyDetails, developerOrSeller: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* FARI / REAR Payment & Virtual Assets Details */}
            {(reportType === 'REAR' || reportType === 'FARI') && (
              <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '10px', padding: '18px 20px', marginBottom: '22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Coins size={16} style={{ color: '#7c3aed' }} />
                  <strong style={{ fontSize: '13.5px', color: '#6d28d9' }}>
                    {isEn ? 'Payment Mode & Virtual Asset Settlement Details:' : 'وسيلة السداد وتفاصيل الأصول الافتراضية / الكريبتو:'}
                  </strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label htmlFor="sar-field-10" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      {isEn ? 'Settlement / Payment Mode *' : 'طريقة وتصنيف السداد *'}
                    </label>
                    <select id="sar-field-10"
                      value={paymentMode}
                      onChange={e => setPaymentMode(e.target.value as any)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                      required
                    >
                      <option value="cash">{isEn ? 'Cash Payment (دفع نقدي ≥ 55,000 درهم)' : 'دفع نقدي (فيزا/كاش يبلغ أو يتجاوز 55 ألف درهم)'}</option>
                      <option value="crypto_virtual_asset">{isEn ? 'Virtual Asset / Cryptocurrency (أصول افتراضية)' : 'أصول افتراضية / عملات رقمية مشفرة (Crypto)'}</option>
                      <option value="bank_transfer">{isEn ? 'Bank Transfer (تحويل مصرفي)' : 'تحويل مصرفي'}</option>
                      <option value="cheque">{isEn ? 'Manager Cheque (شيك مصرفي)' : 'شيك مدير مصرفي'}</option>
                      <option value="mixed">{isEn ? 'Mixed (نقدي + تحويل أو كريبتو)' : 'سداد مختلط (نقدي + أصول أخرى)'}</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="sar-field-11" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      {isEn ? 'DNFBP Reporting Sector' : 'قطاع الأعمال والمهن غير المالية المحددة (DNFBP)'}
                    </label>
                    <input id="sar-field-11"
                      type="text"
                      value={dnfbpSector}
                      onChange={e => setDnfbpSector(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                {(paymentMode === 'crypto_virtual_asset' || reportType === 'FARI') && (
                  <div style={{ background: '#ffffff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '14px', marginTop: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                      <div>
                        <label htmlFor="sar-field-12" style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#4c1d95', marginBottom: '4px' }}>
                          {isEn ? 'Cryptocurrency / Token *' : 'نوع العملة المشفرة / الرمز *'}
                        </label>
                        <input id="sar-field-12"
                          type="text"
                          placeholder="e.g. USDT, BTC, ETH"
                          value={virtualAssetDetails.cryptoType}
                          onChange={e => setVirtualAssetDetails({ ...virtualAssetDetails, cryptoType: e.target.value })}
                          style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                        />
                      </div>

                      <div>
                        <label htmlFor="sar-field-13" style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#4c1d95', marginBottom: '4px' }}>
                          {isEn ? 'Receiving Wallet Address' : 'عنوان المحفظة المستلمة (Wallet)'}
                        </label>
                        <input id="sar-field-13"
                          type="text"
                          placeholder="0x... or T..."
                          value={virtualAssetDetails.walletAddress}
                          onChange={e => setVirtualAssetDetails({ ...virtualAssetDetails, walletAddress: e.target.value })}
                          style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12.5px', fontFamily: 'monospace' }}
                        />
                      </div>

                      <div>
                        <label htmlFor="sar-field-14" style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#4c1d95', marginBottom: '4px' }}>
                          {isEn ? 'Blockchain TxHash' : 'معرف العملية بالبلوكشين (TxHash)'}
                        </label>
                        <input id="sar-field-14"
                          type="text"
                          placeholder="0xabc123..."
                          value={virtualAssetDetails.txHash}
                          onChange={e => setVirtualAssetDetails({ ...virtualAssetDetails, txHash: e.target.value })}
                          style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12.5px', fontFamily: 'monospace' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Narrative */}
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="sar-field-15" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {isEn ? 'Detailed Grounds of Suspicion Narrative *' : 'حيثيات ومبررات الاشتباه وسرد الوقائع التفصيلي *'}
              </label>
              <textarea id="sar-field-15"
                rows={6}
                value={narrative}
                onChange={e => setNarrative(e.target.value)}
                placeholder={
                  isEn
                    ? 'Detail the specific indicators, watchlist match details, source of funds inquiries, unusual behavior, or inconsistencies that justified filing this report...'
                    : 'اشرح بالتفصيل مؤشرات الاشتباه المرصودة، نتائج الفحص الآلي وقوائم الحظر المتطابقة، ردود العميل، ومبررات مسؤول الامتثال في تصنيف الواقعة كمشتبه بها...'
                }
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', lineHeight: 1.6, resize: 'vertical' }}
                required
              />
              <small style={{ color: '#64748b', fontSize: '12px' }}>
                {isEn
                  ? 'Note: All narratives are strictly archived with immutable audit trails. Anti-tipping-off rules strictly apply.'
                  : 'ملاحظة: هذا التقرير يتم حفظه بأعلى درجات السرية ولا يُكشف عنه للعميل إطلاقاً تطبيقاً لحظر التنبيه (No Tipping-off).'}
              </small>
            </div>

            {/* Reporting Officer Signature Box */}
            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{isEn ? 'Authorizing Officer' : 'مسؤول الإبلاغ والامتثال'}</span>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{actor.displayName}</strong>
                <small style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>{actor.organizationName} · {actor.role.toUpperCase()}</small>
              </div>
              <div style={{ textAlign: isEn ? 'right' : 'left' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{isEn ? 'Statutory Reference' : 'السند القانوني'}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  {isEn ? 'UAE AML Law No. 20 (2018)' : 'قانون مكافحة غسل الأموال رقم (20) لسنة 2018'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="submit"
                disabled={isSubmitting}
                className="button primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#dc2626', borderColor: '#dc2626' }}
              >
                <ShieldAlert size={18} />
                <span>{isSubmitting ? (isEn ? 'Saving...' : 'جاري الحفظ والاعتماد...') : (isEn ? 'Authorize & File Report' : 'اعتماد وتوثيق بلاغ الاشتباه')}</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Mode 2: VIEW EXISTING FILED SAR REPORT & EXPORT OPTIONS */}
      {activeMode === 'view' && selectedReport && (
        <div>
          {/* Action Toolbar */}
          <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                {isEn ? 'Select Filed Report:' : 'اختر التقرير المعروض:'}
              </span>
              <select
                value={selectedReport.id}
                onChange={e => {
                  const r = reports.find(x => x.id === e.target.value);
                  if (r) setSelectedReport(r);
                }}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff', fontWeight: 500 }}
              >
                {reports.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.reference_number} ({r.report_type}) - {new Date(r.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <a
                href={`/api/profiles/${customer.reference}/sar-export?reportId=${selectedReport.id}&format=xml`}
                download
                className="button secondary sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
              >
                <Download size={15} />
                <span>{isEn ? 'Download goAML XML' : 'تحميل ملف XML لـ goAML'}</span>
              </a>

              <a
                href={`/api/profiles/${customer.reference}/sar-export?reportId=${selectedReport.id}&format=json`}
                download
                className="button secondary sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
              >
                <Download size={15} />
                <span>{isEn ? 'Download JSON' : 'تحميل JSON'}</span>
              </a>

              <button
                onClick={handlePrint}
                className="button primary sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
              >
                <Printer size={15} />
                <span>{isEn ? 'Print Official Report' : 'طباعة التقرير الرسمي'}</span>
              </button>
            </div>
          </div>

          {/* Official UAE FIU SAR Printable Document */}
          <article className="report-doc sar-printable-doc" style={{ background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '12px', padding: '44px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
            {/* Header */}
            <div style={{ borderBottom: '3px solid #991b1b', paddingBottom: '24px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#991b1b', background: '#fef2f2', padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>
                  <ShieldAlert size={16} />
                  <span>
                    {selectedReport.report_type === 'REAR'
                      ? 'UNITED ARAB EMIRATES · MINISTRY OF ECONOMY / DNFBP (goAML REAR)'
                      : selectedReport.report_type === 'FARI'
                      ? 'UNITED ARAB EMIRATES · FINANCIAL INTELLIGENCE UNIT (goAML FARI)'
                      : 'UNITED ARAB EMIRATES · FINANCIAL INTELLIGENCE UNIT (goAML)'}
                  </span>
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                  {selectedReport.report_type === 'REAR'
                    ? (isEn ? 'STATUTORY REAL ESTATE ACTIVITY REPORT (REAR)' : 'تقرير المعاملات والصفقات العقارية الإلزامي (goAML REAR)')
                    : selectedReport.report_type === 'FARI'
                    ? (isEn ? 'FUNDS & VIRTUAL ASSETS COMPLIANCE REPORT (FARI)' : 'تقرير التدفقات النقدية والأصول الافتراضية (goAML FARI)')
                    : (isEn ? 'CONFIDENTIAL SUSPICIOUS ACTIVITY REPORT' : 'تقرير إبلاغ عن معاملة / نشاط مشبوه (سري ومحمي)')}
                </h1>
                <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                  {selectedReport.report_type === 'REAR'
                    ? (isEn ? 'Mandatory filing pursuant to UAE Ministry of Economy and FIU regulations for freehold real estate transactions. Strictly Confidential.' : 'إفادة رقابية إلزامية للقطاع العقاري وفقاً لقرارات وزارة الاقتصاد ووحدة المعلومات المالية. سري ومحمي.')
                    : selectedReport.report_type === 'FARI'
                    ? (isEn ? 'Mandatory DNFBP cash & virtual assets filing pursuant to UAE AML Law No. 20 (2018). Strictly Confidential.' : 'إبلاغ إلزامي عن المعاملات النقدية والأصول الرقمية تنفيذاً للمرسوم بقانون اتحادي رقم (20) لسنة 2018. سري ومحمي.')
                    : (isEn ? 'Statutory filing submitted pursuant to Article 15 of Federal Decree-Law No. (20) of 2018. Strictly Confidential - No Tipping-off.' : 'إفادة رقابية محررة وفقاً للمادة (15) من المرسوم بقانون اتحادي رقم (20) لسنة 2018 بشأن مواجهة غسل الأموال. سري للغاية ويحظر إفشاؤه.')}
                </p>
              </div>

              <div style={{ textAlign: isEn ? 'right' : 'left' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{isEn ? 'Filing Reference' : 'الرقم المرجعي للبلاغ'}</span>
                <strong style={{ fontSize: '16px', fontFamily: 'monospace', color: '#991b1b', display: 'block' }}>{selectedReport.reference_number}</strong>
                <span style={{ display: 'inline-block', marginTop: '4px', padding: '2px 8px', borderRadius: '4px', background: '#0f172a', color: '#fff', fontSize: '11px', fontWeight: 700 }}>
                  {selectedReport.report_type}
                </span>
              </div>
            </div>

            {/* Section 1: Reporting Entity & Officer */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px' }}>
                1. {isEn ? 'Reporting Entity & Authorized Officer' : 'بيانات المنشأة المبلّغة ومسؤول الامتثال'}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', fontSize: '13px', background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Reporting Entity' : 'الجهة المبلّغة'}</span>
                  <strong style={{ color: '#0f172a' }}>{actor.organizationName}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Filing Officer' : 'اسم المحلل / مسؤول الامتثال'}</span>
                  <span style={{ fontWeight: 600 }}>{selectedReport.creator_name || actor.displayName}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Submission Date & Time' : 'تاريخ وتوقيت التوثيق'}</span>
                  <span style={{ fontFamily: 'monospace' }}>{new Date(selectedReport.created_at).toLocaleString('ar-AE-u-nu-latn')}</span>
                </div>
              </div>
            </div>

            {/* Section 2: Subject Particulars */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px' }}>
                2. {isEn ? 'Subject Entity Particulars (Suspect)' : 'بيانات العميل / الطرف المشتبه به'}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', fontSize: '13px', background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Subject Name' : 'اسم العميل'}</span>
                  <strong style={{ color: '#0f172a', fontSize: '14px' }}>{customer.name}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Entity Type' : 'نوع الكيان'}</span>
                  <span>{customer.entity_type === 'company' ? (isEn ? 'Corporate / Legal Entity' : 'شركة / شخص اعتباري') : (isEn ? 'Individual' : 'فرد')}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Country / Residence' : 'الدولة / المقر'}</span>
                  <span>{flag(customer.country)} {countryName(customer.country, locale)}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'ID / Trade License' : 'رقم الهوية / الرخصة'}</span>
                  <span style={{ fontFamily: 'monospace' }}>{customer.identifier || '—'}</span>
                </div>
              </div>
            </div>

            {/* Section 3: Reason for Suspicion & Legal Triggers */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px' }}>
                3. {isEn ? 'Suspicion Category & Legal Triggers' : 'تصنيف ومؤشرات سبب الاشتباه'}
              </h2>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '16px', borderRadius: '8px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#991b1b', fontWeight: 700, display: 'block' }}>
                    {isEn ? 'Primary goAML Indicator:' : 'مؤشر الاشتباه الرئيسي:'}
                  </span>
                  <strong style={{ fontSize: '15px', color: '#7f1d1d' }}>
                    {isEn ? SAR_REASON_LABELS[selectedReport.reason_category]?.en : SAR_REASON_LABELS[selectedReport.reason_category]?.ar}
                  </strong>
                </div>

                {selectedReport.fiu_payload?.suspiciousAmount && (
                  <div style={{ marginTop: '8px', fontSize: '13px', color: '#991b1b' }}>
                    <span>{isEn ? 'Suspicious Transaction Sum: ' : 'المبلغ المرتبط بالشبهة: '}</span>
                    <strong>{selectedReport.fiu_payload.suspiciousAmount.toLocaleString()} AED</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3.1: Property & Payment Particulars (REAR / FARI) */}
            {(selectedReport.fiu_payload?.propertyDetails || selectedReport.fiu_payload?.paymentMode || selectedReport.fiu_payload?.virtualAssetDetails) && (
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px' }}>
                  3.1 {isEn ? 'Transaction, Real Estate & Settlement Particulars' : 'تفاصيل الصفقة والعقار وطريقة السداد (REAR / FARI)'}
                </h2>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', fontSize: '13px' }}>
                  {selectedReport.fiu_payload.propertyDetails?.titleDeedNumber && (
                    <div>
                      <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Title Deed No.' : 'رقم سند الملكية'}</span>
                      <strong style={{ fontFamily: 'monospace' }}>{selectedReport.fiu_payload.propertyDetails.titleDeedNumber}</strong>
                    </div>
                  )}
                  {selectedReport.fiu_payload.propertyDetails?.emirate && (
                    <div>
                      <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Emirate' : 'الإمارة'}</span>
                      <strong style={{ color: '#0f172a' }}>{selectedReport.fiu_payload.propertyDetails.emirate}</strong>
                    </div>
                  )}
                  {selectedReport.fiu_payload.propertyDetails?.propertyType && (
                    <div>
                      <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Property Type' : 'نوع العقار'}</span>
                      <span style={{ textTransform: 'capitalize' }}>{selectedReport.fiu_payload.propertyDetails.propertyType}</span>
                    </div>
                  )}
                  {selectedReport.fiu_payload.paymentMode && (
                    <div>
                      <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Payment Mode' : 'وسيلة السداد'}</span>
                      <span style={{ fontWeight: 600, color: '#0369a1' }}>{selectedReport.fiu_payload.paymentMode.toUpperCase()}</span>
                    </div>
                  )}
                  {selectedReport.fiu_payload.virtualAssetDetails?.cryptoType && (
                    <div>
                      <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Crypto Asset' : 'العملة الرقمية'}</span>
                      <strong style={{ color: '#7c3aed' }}>{selectedReport.fiu_payload.virtualAssetDetails.cryptoType}</strong>
                    </div>
                  )}
                  {selectedReport.fiu_payload.virtualAssetDetails?.walletAddress && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Wallet / Tx' : 'عنوان المحفظة / المعاملة'}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>{selectedReport.fiu_payload.virtualAssetDetails.walletAddress}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 4: Narrative Description */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px' }}>
                4. {isEn ? 'Detailed Suspicion Narrative & Compliance Findings' : 'شرح الوقائع وحيثيات الاشتباه (Narrative)'}
              </h2>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '18px', fontSize: '13px', lineHeight: 1.8, color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                {selectedReport.narrative}
              </div>
            </div>

            {/* Section 5: Action Taken */}
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px' }}>
                5. {isEn ? 'Action Taken & Risk Mitigation' : 'الإجراء المتخذ وتدابير التحوط'}
              </h2>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 18px', fontSize: '13px' }}>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Institutional Measure Executed:' : 'التدبير المؤسسي المنفّذ فوراً:'}</span>
                <strong style={{ color: '#0f172a', fontSize: '14px' }}>
                  {isEn ? SAR_ACTION_LABELS[selectedReport.action_taken]?.en : SAR_ACTION_LABELS[selectedReport.action_taken]?.ar}
                </strong>
              </div>
            </div>

            {/* Official Signatures & Digital Seals */}
            <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{isEn ? 'Reporting Officer' : 'مسؤول الإبلاغ المعتمد'}</span>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>{selectedReport.creator_name || actor.displayName}</strong>
                <small style={{ display: 'block', color: '#94a3b8', fontSize: '10px' }}>{selectedReport.fiu_payload?.officerRole || 'Compliance Officer'}</small>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'inline-block', border: '2px dashed #991b1b', borderRadius: '8px', padding: '8px 14px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#991b1b', display: 'block' }}>goAML STATUTORY SAR</span>
                  <span style={{ fontSize: '9px', color: '#7f1d1d' }}>OFFICIALLY FILED</span>
                </div>
              </div>

              <div style={{ textAlign: isEn ? 'right' : 'left' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{isEn ? 'Jurisdiction & Time' : 'الدائرة والتوثيق الزمني'}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>United Arab Emirates</span>
                <small style={{ display: 'block', color: '#94a3b8', fontSize: '10px' }}>GST (UTC+4)</small>
              </div>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
