import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { hasFeature } from '@/lib/features';
import { getCustomerByHandle, getActivity } from '@/lib/customers';
import { getLastScreening } from '@/lib/screening';
import { getMatchDecisions } from '@/lib/decisions';
import {
  evaluateRiskAssessment,
  getFatfStatus,
  isSanctionedCountry,
  isCashThresholdSector,
} from '@/lib/risk-rating';
import { countryName, DateText, DateTimeText, number, flag } from '@/components/ui';
import { getMessages, getLocale } from '@/lib/i18n';
import PrintButton from '@/components/print-button';
import { DeveloperCredit } from '@/components/developer-credit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const actor = await requireActor();
    const { id } = await params;
    if (!/^[\w-]{4,60}$/.test(id)) return { title: 'تقرير فحص الامتثال | DRM' };
    const customer = await getCustomerByHandle(actor.organizationId, id);
    if (!customer) return { title: 'تقرير فحص الامتثال | DRM' };

    return {
      title: customer.name,
    };
  } catch {
    return { title: 'تقرير فحص الامتثال | DRM' };
  }
}

export default async function Report({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  if (!/^[\w-]{4,60}$/.test(id)) notFound();

  const customer = await getCustomerByHandle(actor.organizationId, id);
  if (!customer) notFound();
  if (actor.role === 'analyst' && customer.created_by && customer.created_by !== actor.id) {
    notFound();
  }

  const [last, decisions, activities, m, locale] = await Promise.all([
    getLastScreening(actor.organizationId, customer.id),
    getMatchDecisions(actor.organizationId, customer.id),
    getActivity(actor.organizationId, customer.id),
    getMessages(),
    getLocale(),
  ]);

  const isEn = locale === 'en';
  const isCompany = customer.entity_type === 'company';

  const bandLabel = (b: string) =>
    ({ none: m.bandNone, low: m.bandLow, medium: m.bandMedium, high: m.bandHigh } as Record<string, string>)[b] ?? b;

  const catLabel = (c: string) => {
    if (isEn) {
      return ({
        sanctions: 'Sanction',
        pep: 'Politically Exposed Person',
        crime: 'Special Interest Person',
        debarment: 'Debarment / Exclusion',
        regulatory: 'Regulatory Enforcement',
        other: 'Other Watchlist'
      } as Record<string, string>)[c] ?? c;
    }
    return ({
      sanctions: m.catSanctions,
      pep: m.catPep,
      crime: m.catCrime,
      debarment: m.catDebarment,
      regulatory: m.catRegulatory,
      other: m.catOther
    } as Record<string, string>)[c] ?? c;
  };

  const dcLabel = (c: string) => {
    if (c === 'face_to_face') return isEn ? 'Face to Face' : 'وجهاً لوجه';
    if (c === 'non_face_to_face') return isEn ? 'Non Face to Face' : 'عن بُعد (غير مباشر)';
    if (c === 'online') return isEn ? 'Online / Electronic' : 'إلكتروني (أونلاين)';
    return '—';
  };

  const adverseHit = hasFeature(actor, 'adverse_media') && !!last?.adverse_media && last.adverse_media.status === 'searched' && last.adverse_media.count > 0;
  const riskAssessment = evaluateRiskAssessment(customer, last?.top_matches ?? [], decisions, !!last, adverseHit);
  const rating = riskAssessment.rating;
  const reviewPending = riskAssessment.isPending;
  const goAml = riskAssessment.goAml;

  // Filter to essential / material hits only:
  // 1. High confidence hits (percent >= 80)
  // 2. Or hits with an explicit confirmed decision
  // Secondary / coincidental matches (< 80% without confirmed decision) are auto-excluded noise and kept out of the official report
  const allMatches = last?.top_matches ?? [];
  const relevantHits = allMatches.filter(mt => {
    const d = decisions[mt.recordId]?.decision;
    if (d === 'confirmed') return true;
    if (d === 'dismissed' && (mt.percent ?? 100) >= 80) return true;
    return (mt.percent ?? 100) >= 80;
  });

  // Clean deduplication for display so the same person/list isn't repeated multiple times
  const seenEntities = new Set<string>();
  const displayHits = relevantHits.filter(mt => {
    const key = `${mt.name.toLowerCase().trim()}:${mt.category}`;
    if (seenEntities.has(key)) return false;
    seenEntities.add(key);
    return true;
  }).slice(0, 25);

  const decided = last ? displayHits.map(mt => decisions[mt.recordId]?.decision).filter(Boolean) : [];
  const genuineCount = decided.filter(d => d === 'confirmed').length;
  const notGenuineCount = decided.filter(d => d === 'dismissed').length;
  const unresolvedCount = displayHits.length - genuineCount - notGenuineCount;

  const resSanctioned = isSanctionedCountry(customer.country);
  const natSanctioned = isSanctionedCountry(customer.nationality);
  const hasSanctionHit = !!riskAssessment.review.flags.sanctions || displayHits.some(m => m.category === 'sanctions' && decisions[m.recordId]?.decision !== 'dismissed');
  const hasPepHit = !!riskAssessment.review.flags.pep || displayHits.some(m => m.category === 'pep' && decisions[m.recordId]?.decision !== 'dismissed');
  const hasCrimeHit = !!riskAssessment.review.flags.crime || displayHits.some(m => m.category === 'crime' && decisions[m.recordId]?.decision !== 'dismissed');

  // Clean source list name formatter (short and readable)
  const cleanSourceName = (src: string) => {
    return src
      .replace(/Specially Designated Nationals And Blocked Persons List \(SDN\)/i, 'SDN')
      .replace(/Specially Designated Nationals \(SDN\) List/i, 'SDN')
      .replace(/Consolidated Screening List \(CSL\)/i, 'CSL')
      .replace(/Financial Sanctions Files \(FSF\)/i, 'FSF')
      .replace(/United Kingdom — Sanctions/i, 'UK Sanctions')
      .replace(/UN — Security Council/i, 'UN Security Council')
      .trim();
  };

  return (
    <div className="report idenfo-styled-report">
      <div className="report-actions no-print">
        <Link href={`/profiles/${id}`} className="back-link">
          {locale === 'en' ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}
          <span>{m.backToProfile}</span>
        </Link>
        <PrintButton label={m.printPdf} filename={customer.name} />
      </div>

      <article className="report-doc idenfo-doc">
        {/* Top Header & Brand */}
        <header className="idenfo-header">
          <div className="idenfo-brand">
            <img src="/logo.webp" alt="DRM" className="idenfo-logo-img" />
            <div className="idenfo-brand-text">
              <span className="idenfo-brand-title" translate="no">DRM</span>
              <span className="idenfo-brand-sub">
                {isEn ? 'Diligence Risk Management · Compliance & Screening' : 'إدارة المخاطر والخدمات المهنية · نظام الفحص والامتثال'}
              </span>
            </div>
          </div>
          <div className="idenfo-doc-badge">
            <span className="idenfo-doc-type">
              {isCompany ? (isEn ? 'Company Information' : 'بيانات الشركة') : (isEn ? 'Customer Information' : 'بيانات العميل')}
            </span>
            <span className="idenfo-doc-ref" dir="ltr">{customer.reference}</span>
          </div>
        </header>

        {/* 1. Customer Information Table */}
        <section className="idenfo-section">
          <h2 className="idenfo-section-title">
            {isCompany ? (isEn ? 'Company Information' : 'بيانات الشركة والمؤسسة') : (isEn ? 'Customer Information' : 'بيانات العميل الشخصية')}
          </h2>
          <table className="idenfo-kv-table">
            <tbody>
              <tr>
                <th scope="row">{isEn ? 'Customer / Profile ID' : 'معرّف العميل (Reference)'}</th>
                <td dir="ltr" className="font-mono">{customer.reference}</td>
                <th scope="row">{isEn ? 'External Reference Number' : 'الرقم المرجعي الخارجي'}</th>
                <td dir="ltr">N/A</td>
              </tr>
              <tr>
                <th scope="row">{isEn ? (isCompany ? 'Company Name' : 'Full Name') : (isCompany ? 'اسم المنشأة / الشركة' : 'الاسم الكامل')}</th>
                <td dir="auto" className="highlight-cell"><strong>{customer.name}</strong></td>
                <th scope="row">{isCompany ? (isEn ? 'Country of Domicile' : 'دولة التأسيس / المقر') : (isEn ? 'Country of Residence' : 'دولة الإقامة')}</th>
                <td>
                  <span className="flag">{flag(customer.country) || '🌐'}</span>
                  <span>{countryName(customer.country, locale)}</span>
                </td>
              </tr>
              <tr>
                <th scope="row">{isCompany ? (isEn ? 'Founding / Inception Date' : 'تاريخ التأسيس') : (isEn ? 'Date of Birth' : 'تاريخ الميلاد')}</th>
                <td dir="ltr">{customer.date_of_birth || 'N/A'}</td>
                <th scope="row">{isCompany ? (isEn ? 'Country of Operations' : 'نطاق العمليات') : (isEn ? 'Nationality' : 'الجنسية')}</th>
                <td>
                  {customer.nationality ? (
                    <>
                      <span className="flag">{flag(customer.nationality) || '🌐'}</span>
                      <span>{countryName(customer.nationality, locale)}</span>
                    </>
                  ) : (isCompany ? countryName(customer.country, locale) : 'N/A')}
                </td>
              </tr>
              <tr>
                <th scope="row">{isEn ? 'Delivery Channel' : 'قناة تقديم الخدمة'}</th>
                <td>{dcLabel(customer.delivery_channel)}</td>
                <th scope="row">{isCompany ? (isEn ? 'Trade License / CR Number' : 'رقم الرخصة / السجل التجاري') : (isEn ? 'Passport / ID Document Number' : 'رقم جواز السفر / الهوية')}</th>
                <td dir="ltr" className="font-mono">{customer.identifier || 'N/A'}</td>
              </tr>
              <tr>
                <th scope="row">{isEn ? 'Customer Met Face-To-Face ?' : 'هل تم اللقاء وجهاً لوجه؟'}</th>
                <td className="capitalize">{customer.delivery_channel === 'face_to_face' ? (isEn ? 'yes' : 'نعم') : (isEn ? 'no' : 'لا')}</td>
                <th scope="row">{isEn ? 'Industry / Activity' : 'النشاط / القطاع'}</th>
                <td>
                  {customer.industry || 'N/A'}
                  {isCashThresholdSector(customer.industry) && (
                    <span className="idenfo-dnfbp-chip"> · {isEn ? 'DNFBP' : 'مهن غير مالية محددة'}</span>
                  )}
                </td>
              </tr>
              <tr>
                <th scope="row">{isEn ? 'Name Screening Hit' : 'مطابقات فحص الأسماء'}</th>
                <td>
                  <span className={`idenfo-tag ${displayHits.length > 0 ? 'hit-yes' : 'hit-no'}`}>
                    {displayHits.length > 0 ? (isEn ? 'YES' : 'نعم (يوجد مطابقات)') : (isEn ? 'NO' : 'لا (سليم)')}
                  </span>
                </td>
                <th scope="row">{isEn ? 'Risk Rating Hit' : 'مؤشر مخاطر الفحص'}</th>
                <td>
                  <span className={`idenfo-tag ${rating.band === 'high' ? 'hit-sanction' : rating.band === 'medium' ? 'hit-warning' : 'hit-no'}`}>
                    {hasSanctionHit
                      ? (isEn ? 'YES (SANCTION)' : 'نعم (عقوبات)')
                      : hasPepHit
                      ? (isEn ? 'YES (PEP)' : 'نعم (شخص سياسي)')
                      : hasCrimeHit
                      ? (isEn ? 'YES (CRIME / ENFORCEMENT)' : 'نعم (إنفاذ / ملاحقة)')
                      : (isEn ? 'NO' : 'لا')}
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">{isEn ? 'Status' : 'حالة الملف'}</th>
                <td className="capitalize">
                  <span className={`idenfo-status-badge ${reviewPending ? 'status-pending' : 'status-approved'}`}>
                    {reviewPending ? (isEn ? 'pending' : 'قيد المراجعة') : (isEn ? 'approved' : 'معتمد')}
                  </span>
                </td>
                <th scope="row">{isEn ? 'Onboarded by (user)' : 'المسؤول عن الإدخال'}</th>
                <td>{customer.creator_name || actor.displayName}</td>
              </tr>
              <tr>
                <th scope="row">{isEn ? 'Onboarded by (company)' : 'المؤسسة / الجهة'}</th>
                <td>{actor.organizationName}</td>
                <th scope="row">{isEn ? 'Registered At' : 'تاريخ التسجيل'}</th>
                <td><DateText value={customer.created_at} locale={locale} /></td>
              </tr>
              <tr>
                <th scope="row">{isEn ? 'Report Generated On' : 'تاريخ ووقت إصدار التقرير'}</th>
                <td colSpan={3}><DateTimeText value={new Date()} locale={locale} /></td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 2. Key Findings Summary Bar */}
        <section className="idenfo-section">
          <h2 className="idenfo-section-title">{isEn ? 'Key Findings' : 'النتائج والمطابقات الرئيسية'}</h2>
          <div className="idenfo-findings-grid">
            <div className="idenfo-finding-col">
              <span className="finding-label">{isEn ? 'Total Matches' : 'إجمالي المطابقات المفحوصة'}</span>
              <strong className="finding-val">{displayHits.length}</strong>
            </div>
            <div className="idenfo-finding-col">
              <span className="finding-label">{isEn ? 'Resolved Matches' : 'المطابقات المحسومة'}</span>
              <strong className="finding-val">{genuineCount + notGenuineCount}</strong>
              <small className="finding-sub">
                {isEn ? `Genuine: ${genuineCount}` : `مؤكدة: ${genuineCount}`} &nbsp;|&nbsp; {isEn ? `Not Genuine: ${notGenuineCount}` : `مستبعدة: ${notGenuineCount}`}
              </small>
            </div>
            <div className="idenfo-finding-col">
              <span className="finding-label">{isEn ? 'Unresolved Matches' : 'مطابقات بانتظار المراجعة'}</span>
              <strong className={`finding-val ${unresolvedCount > 0 ? 'text-amber' : ''}`}>{unresolvedCount}</strong>
            </div>
          </div>
        </section>

        {/* 3. Risk Ratings Matrix */}
        <section className="idenfo-section">
          <h2 className="idenfo-section-title">{isEn ? 'Risk Ratings' : 'مصفوفة تقييم المخاطر (الأساسية)'}</h2>
          <table className="idenfo-data-table">
            <thead>
              <tr>
                <th style={{ width: '60%' }}>{isEn ? 'Risk factor matrix' : 'عامل المخاطر'}</th>
                <th style={{ width: '20%' }}>{isEn ? 'Score' : 'الدرجة'}</th>
                <th style={{ width: '20%' }}>{isEn ? 'Level' : 'المستوى'}</th>
              </tr>
            </thead>
            <tbody>
              {rating.factors.map(f => {
                const label = f.key === 'residence'
                  ? (isCompany ? (isEn ? 'Country of Domicile' : 'دولة المقر / التأسيس') : (isEn ? 'Country of Residence' : 'دولة الإقامة'))
                  : f.key === 'nationality'
                  ? (isCompany ? (isEn ? 'Country of Operations' : 'نطاق العمليات') : (isEn ? 'Nationality' : 'الجنسية'))
                  : f.key === 'industry'
                  ? (isEn ? 'Industry / Sector' : 'النشاط الاقتصادي')
                  : (isEn ? 'Delivery Channel' : 'قناة تقديم الخدمة');
                return (
                  <tr key={f.key}>
                    <td>{label}</td>
                    <td dir="ltr">{f.score}</td>
                    <td className="capitalize"><span className={`level-pill ${f.band}`}>{f.band}</span></td>
                  </tr>
                );
              })}
              <tr>
                <td>{isEn ? 'Product' : 'نوع المنتج / الخدمة'}</td>
                <td dir="ltr">0</td>
                <td><span className="level-pill low">low</span></td>
              </tr>
              <tr>
                <td>{isEn ? 'Anti Spoofing' : 'التحقق من التزييف والتحايل'}</td>
                <td dir="ltr">0</td>
                <td><span className="level-pill low">low</span></td>
              </tr>
              <tr className="idenfo-total-row">
                <td><strong>{isEn ? 'Base Rating' : 'التقييم الأساسي (Base Rating)'}</strong></td>
                <td dir="ltr"><strong>{rating.base}</strong></td>
                <td><strong><span className={`level-pill ${rating.baseBand}`}>{rating.baseBand}</span></strong></td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 4. Risk Factor Override Table */}
        <section className="idenfo-section">
          <h2 className="idenfo-section-title">{isEn ? 'Risk factor override' : 'تجاوزات عوامل المخاطر (Overrides)'}</h2>
          <table className="idenfo-data-table">
            <thead>
              <tr>
                <th style={{ width: '60%' }}>{isEn ? 'Risk factor override' : 'عامل التجاوز الرقابي'}</th>
                <th style={{ width: '20%' }}>{isEn ? 'Override To' : 'التجاوز إلى'}</th>
                <th style={{ width: '20%' }}>{isEn ? 'Level' : 'المستوى'}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{isEn ? 'Suspicious Transaction Report filed' : 'بلاغ معاملة مشبوهة مسجل (STR)'}</td>
                <td>{goAml.requiresImmediateAction ? 'STR' : 'N/A'}</td>
                <td><span className={`level-pill ${goAml.requiresImmediateAction ? 'high' : 'low'}`}>{goAml.requiresImmediateAction ? 'high' : 'low'}</span></td>
              </tr>
              <tr>
                <td>{isEn ? 'Non Resident' : 'عميل غير مقيم'}</td>
                <td>{customer.country !== 'AE' ? (isEn ? 'Non-Resident' : 'غير مقيم') : 'N/A'}</td>
                <td><span className={`level-pill ${customer.country !== 'AE' ? 'medium' : 'low'}`}>{customer.country !== 'AE' ? 'medium' : 'low'}</span></td>
              </tr>
              <tr>
                <td>{isEn ? 'Residence Country is Sanctioned' : 'دولة الإقامة خاضعة لعقوبات'}</td>
                <td>{resSanctioned ? 'high' : 'N/A'}</td>
                <td><span className={`level-pill ${resSanctioned ? 'high' : 'low'}`}>{resSanctioned ? 'high' : 'low'}</span></td>
              </tr>
              <tr>
                <td>{isEn ? 'Nationality Country is Sanctioned' : 'دولة الجنسية خاضعة لعقوبات'}</td>
                <td>{natSanctioned ? 'high' : 'N/A'}</td>
                <td><span className={`level-pill ${natSanctioned ? 'high' : 'low'}`}>{natSanctioned ? 'high' : 'low'}</span></td>
              </tr>
              <tr>
                <td>{isEn ? 'Contact No. Code Country is Sanctioned' : 'رمز اتصال الدولة خاضع لعقوبات'}</td>
                <td>N/A</td>
                <td><span className="level-pill low">low</span></td>
              </tr>
              <tr>
                <td>{isEn ? 'Sanction Hit' : 'مطابقة عقوبات (Sanction Hit)'}</td>
                <td>{hasSanctionHit ? 'sanction' : 'N/A'}</td>
                <td><span className={`level-pill ${hasSanctionHit ? 'high' : 'low'}`}>{hasSanctionHit ? 'sanction' : 'low'}</span></td>
              </tr>
              <tr>
                <td>{isEn ? 'PEP' : 'شخص سياسي ممثل / قريب (PEP)'}</td>
                <td>{hasPepHit ? 'high' : 'N/A'}</td>
                <td><span className={`level-pill ${hasPepHit ? 'high' : 'low'}`}>{hasPepHit ? 'high' : 'low'}</span></td>
              </tr>
              <tr>
                <td>{isEn ? 'Special Interest Hit' : 'ملاحقة أمنية / جهات إنفاذ القانون'}</td>
                <td>{hasCrimeHit ? 'high' : 'N/A'}</td>
                <td><span className={`level-pill ${hasCrimeHit ? 'high' : 'low'}`}>{hasCrimeHit ? 'high' : 'low'}</span></td>
              </tr>
              <tr>
                <td>{isEn ? 'Adverse Media Hit' : 'أخبار ووسائط إعلامية سلبية'}</td>
                <td>{adverseHit ? 'medium' : 'N/A'}</td>
                <td><span className={`level-pill ${adverseHit ? 'medium' : 'low'}`}>{adverseHit ? 'medium' : 'low'}</span></td>
              </tr>
              <tr>
                <td>{isEn ? 'Transaction' : 'معاملات نقدية تتجاوز السقف'}</td>
                <td>{goAml.cashThresholdAlert ? 'DCR Alert' : 'N/A'}</td>
                <td><span className={`level-pill ${goAml.cashThresholdAlert ? 'medium' : 'low'}`}>{goAml.cashThresholdAlert ? 'medium' : 'low'}</span></td>
              </tr>
              <tr className="idenfo-total-row">
                <td><strong>{isEn ? 'Overall Rating' : 'التقييم الشامل النهائي (Overall Rating)'}</strong></td>
                <td><strong>{rating.band === 'high' && hasSanctionHit ? 'sanction' : rating.band}</strong></td>
                <td><strong><span className={`level-pill ${rating.band}`}>{rating.band === 'high' && hasSanctionHit ? 'sanction' : rating.band}</span></strong></td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 5. Screening Hit Details Table */}
        <section className="idenfo-section">
          <h2 className="idenfo-section-title">{isEn ? 'Screening Hit Details' : 'تفاصيل مطابقات الفحص (Screening Hit Details)'}</h2>
          <table className="idenfo-data-table idenfo-hit-table">
            <thead>
              <tr>
                <th style={{ width: '26%' }}>{isEn ? 'Hit Details' : 'الكيان / الاسم المطابق'}</th>
                <th style={{ width: '18%' }}>{isEn ? 'Category' : 'التصنيف'}</th>
                <th style={{ width: '22%' }}>{isEn ? 'Source' : 'القائمة / المصدر'}</th>
                <th style={{ width: '8%' }}>{isEn ? 'Score' : 'النسبة'}</th>
                <th style={{ width: '14%' }}>{isEn ? 'Hit Determination' : 'القرار والتحقق'}</th>
                <th style={{ width: '12%' }}>{isEn ? 'Comments' : 'الملاحظات'}</th>
              </tr>
            </thead>
            <tbody>
              {displayHits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="idenfo-empty-cell" style={{ textAlign: 'center', padding: '1.75rem 1rem' }}>
                    <div style={{ color: 'var(--success, #10b981)', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                      {isEn ? '✓ No Material Matches / Clear' : '✓ لا توجد مطابقات جوهرية / الملف سليم'}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted, #64748b)' }}>
                      {isEn
                        ? 'No high-confidence hits (>= 80%) found. All minor secondary matches (< 80%) are auto-excluded. The customer is clear of active sanctions and PEP watchlists.'
                        : 'لا توجد مطابقات جوهرية بنسبة 80% فما فوق. جميع النتائج الثانوية مستبعدة تلقائياً لضعف نسبة التشابه. ملف العميل سليم من قوائم العقوبات والملاحقة والسياسيين.'}
                    </p>
                  </td>
                </tr>
              ) : (
                displayHits.map(mt => {
                  const d = decisions[mt.recordId];
                  const determination = d
                    ? d.decision === 'confirmed'
                      ? (isEn ? 'Genuine' : 'مؤكدة (Genuine)')
                      : d.decision === 'dismissed'
                      ? (isEn ? 'Not Genuine' : 'مستبعدة (Not Genuine)')
                      : (isEn ? 'Needs Info' : 'تحت الاستيضاح')
                    : (isEn ? 'Potential' : 'محتملة (Potential)');

                  const detBadgeClass = d
                    ? d.decision === 'confirmed'
                      ? 'det-genuine'
                      : 'det-notgenuine'
                    : 'det-potential';

                  const extraCount = (mt.sourceCount ?? 1) - 1;

                  return (
                    <tr key={mt.recordId}>
                      <td dir="auto" className="hit-name-cell">
                        <strong>{mt.name}</strong>
                      </td>
                      <td>
                        <span className={`idenfo-cat-chip cat-${mt.category}`}>{catLabel(mt.category)}</span>
                      </td>
                      <td dir="auto" className="hit-source-cell">
                        <span>{cleanSourceName(mt.source)}</span>
                        {extraCount > 0 && (
                          <span className="extra-source-pill" title={mt.relatedSources?.map(s => s.source).join(', ')}>
                            +{extraCount} {isEn ? 'lists' : 'قوائم'}
                          </span>
                        )}
                      </td>
                      <td dir="ltr" className="hit-score-cell">{mt.percent}</td>
                      <td>
                        <span className={`idenfo-det-badge ${detBadgeClass}`}>{determination}</span>
                      </td>
                      <td dir="auto" className="hit-comment-cell">
                        {d?.reason ? d.reason : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>

        {/* 6. Audit Trail Table */}
        <section className="idenfo-section">
          <h2 className="idenfo-section-title">{isEn ? 'Audit' : 'سجل التدقيق والإجراءات (Audit Trail)'}</h2>
          <table className="idenfo-data-table idenfo-audit-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>{isEn ? 'Date' : 'التاريخ والوقت'}</th>
                <th style={{ width: '25%' }}>{isEn ? 'Actioned By' : 'المستخدم / النظام'}</th>
                <th style={{ width: '53%' }}>{isEn ? 'Action' : 'الإجراء المتخذ'}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="audit-date"><DateText value={customer.created_at} locale={locale} /></td>
                <td className="audit-actor">{customer.creator_name || actor.displayName}</td>
                <td className="audit-action">{isEn ? 'Registered new customer into the system.' : 'تسجيل ملف عميل جديد بالنظام.'}</td>
              </tr>
              {last && (
                <tr>
                  <td className="audit-date"><DateTimeText value={last.created_at} locale={locale} /></td>
                  <td className="audit-actor">{isEn ? 'Screening Engine' : 'محرك الفحص الآلي'}</td>
                  <td className="audit-action">
                    {isEn
                      ? `Automated screening executed across ${last.source_versions.length} watchlists (${displayHits.length} potential hits identified).`
                      : `تنفيذ الفحص الأمني عبر ${last.source_versions.length} قائمة رسمية (${displayHits.length} مطابقة محتملة).`}
                  </td>
                </tr>
              )}
              {activities
                .filter(a => a.action === 'match.decided' || a.action === 'customer.updated')
                .map((a, i) => (
                  <tr key={a.id || i}>
                    <td className="audit-date"><DateTimeText value={a.created_at} locale={locale} /></td>
                    <td className="audit-actor">{a.actor_name || customer.creator_name || actor.displayName}</td>
                    <td className="audit-action" dir="auto">{a.summary}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>

        {/* 7. Watchlists Glossary & Definitions (Idenfo Standard) */}
        <section className="idenfo-section idenfo-glossary-section">
          <div className="idenfo-glossary-grid">
            <div><strong>HMT</strong> – {isEn ? 'His Majesty’s Treasury, UK, Financial sanctions targets: list of all asset freeze targets' : 'الخزانة البريطانية (HMT): القائمة الموحدة لتجميد الأصول والعقوبات المالية'}</div>
            <div><strong>EU</strong> – {isEn ? 'Consolidated list of persons, groups and entities subject to European Union financial sanctions' : 'الاتحاد الأوروبي (EU): القائمة الموحدة للأشخاص والكيانات الخاضعة للعقوبات'}</div>
            <div><strong>OFAC</strong> – {isEn ? 'US Treasury, Office of Foreign Assets Control, Specially Designated Nationals And Blocked Persons List (SDN)' : 'مكتب مراقبة الأصول الأجنبية الأمريكي (OFAC - SDN)'}</div>
            <div><strong>UN</strong> – {isEn ? 'United Nations Security Council Consolidated Sanction list' : 'الأمم المتحدة (UN): قائمة عقوبات مجلس الأمن الدولي الموحدة'}</div>
            <div><strong>MOI</strong> – {isEn ? 'Qatari unified record of persons and entities designated on Sanction List' : 'وزارة الداخلية القطرية (MOI): السجل الموحد لقرارات العقوبات'}</div>
            <div><strong>NACTA</strong> – {isEn ? 'Pakistani National Counter Terrorism Authority Sanction List' : 'الهيئة الوطنية الباكستانية لمكافحة الإرهاب (NACTA)'}</div>
            <div><strong>UAE Local Terrorist</strong> – {isEn ? 'List produced by UAE Executive Office for Control & Non-Proliferation' : 'قائمة الإرهاب المحلية المعتمدة الصادرة عن المكتب التنفيذي لدولة الإمارات'}</div>
            <div><strong>PEP</strong> – {isEn ? 'A hit from any key global PEP list or checking for politicians and their relatives or close associates' : 'الأشخاص المعرضون سياسياً (PEP): النواب والسياسيون وأقاربهم ومساعدوهم'}</div>
            <div><strong>Special Interest</strong> – {isEn ? 'A hit from a key global enforcement list' : 'شخص ذو اهتمام خاص: ملاحق من الإنتربول والجهات الأمنية وإنفاذ القانون'}</div>
            <div><strong>Adverse Media</strong> – {isEn ? 'A hit from an adverse media public search checking for financial crime' : 'الإعلام السلبي: مسح للتحقيقات والأخبار الموثوقة عن الجرائم المالية وغسل الأموال'}</div>
          </div>
        </section>

        {/* 8. UAE Statutory Compliance Sign-off & DRM Audit Seal */}
        <section className="idenfo-section compliance-signoff-block">
          <h2 className="idenfo-section-title">{isEn ? 'Compliance Sign-off & Official Audit Seal' : 'اعتماد ومصادقة مسؤول الامتثال والختم الرقابي'}</h2>
          <div className="signoff-grid">
            <div className="signoff-field">
              <span className="signoff-label">{isEn ? 'Compliance Officer Name' : 'اسم المحلل الرقابي المسؤول'}</span>
              <strong className="signoff-value">{actor.displayName}</strong>
              <small className="muted">{actor.role === 'admin' ? (isEn ? 'Compliance Admin' : 'مدير الامتثال') : (isEn ? 'Compliance Analyst' : 'محلل الامتثال')}</small>
            </div>
            <div className="signoff-field">
              <span className="signoff-label">{isEn ? 'Review & Sign Date' : 'تاريخ المراجعة والاعتماد'}</span>
              <strong className="signoff-value" dir="ltr"><DateTimeText value={new Date()} locale={locale} /></strong>
              <small className="muted">{isEn ? 'UAE Standard Time (GST)' : 'التوقيت المعتمد: دولة الإمارات (GST)'}</small>
            </div>
            <div className="signoff-field signoff-signature-field">
              <span className="signoff-label">{isEn ? 'Authorized Signature' : 'التوقيع والاعتماد'}</span>
              <div className="signature-line" />
              <small className="muted">{isEn ? 'Digitally Documented Sign-off' : 'توقيع معتمد وموثق نظاميًا'}</small>
            </div>
            <div className="signoff-seal-field">
              <div className="audit-seal">
                <span className="seal-org" translate="no">DRM UAE</span>
                <span className="seal-text">{isEn ? 'AUDIT VERIFIED' : 'تم التدقيق'}</span>
                <span className="seal-id" dir="ltr">DRM-AUTH-{customer.reference.replace(/[^a-zA-Z0-9]/g, '')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="idenfo-footer">
          <p>{m.rptFooter}</p>
          <div className="report-foot-drm">
            <span>{isEn ? 'Diligence Risk Management (DRM) · Risk Management & Pro Services' : 'دي آر إم لإدارة المخاطر والخدمات المهنية (DRM)'}</span>
            <span>{isEn ? 'Office 404, Sultan Group Investment Bldg, Deira, Dubai, UAE · www.drmuae.com' : 'مكتب 404، بناية سلطان للاستثمار، ديرة، دبي، الإمارات العربية المتحدة · www.drmuae.com'}</span>
          </div>
          <DeveloperCredit as="div" className="report-foot-dev no-print" />
        </footer>
      </article>
    </div>
  );
}
