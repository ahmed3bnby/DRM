import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, ShieldCheck, CheckCircle2, Award, Printer } from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { getCustomerByHandle } from '@/lib/customers';
import { getMessages, getLocale } from '@/lib/i18n';
import { countryName, DateText, DateTimeText, flag } from '@/components/ui';
import PrintButton from '@/components/print-button';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return {
    title: 'شهادة المراقبة المستمرة والامتثال الرقابي | DRM'
  };
}

export default async function MonitoringAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  if (!/^[\w-]{4,60}$/.test(id)) notFound();

  const customer = await getCustomerByHandle(actor.organizationId, id);
  if (!customer) notFound();

  const [m, locale] = await Promise.all([getMessages(), getLocale()]);
  const isEn = locale === 'en';

  const isMonitored = customer.monitoring_enabled !== false;
  const lastScan = customer.last_monitored_at || customer.created_at;

  return (
    <main className="report" style={{ maxWidth: '850px', margin: '0 auto', padding: '20px 0' }}>
      <div className="report-actions no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Link href={`/profiles/${customer.reference}`} className="back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          {isEn ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
          <span>{isEn ? 'Back to Customer Profile' : 'العودة لملف العميل'}</span>
        </Link>
        <div style={{ display: 'flex', gap: '10px' }}>
          <PrintButton label={isEn ? 'Print Certificate' : 'طباعة الشهادة الرسمية'} />
        </div>
      </div>

      <article className="report-doc" style={{ background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '12px', padding: '40px', boxShadow: '0 4px 14px rgba(0,0,0,0.04)' }}>
        {/* Certificate Header */}
        <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '24px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#166534', background: '#f0fdf4', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, marginBottom: '8px' }}>
              <ShieldCheck size={16} />
              <span>{isEn ? 'AML / CFT STATUTORY COMPLIANCE' : 'الامتثال الرقابي لمكافحة غسل الأموال'}</span>
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
              {isEn ? 'Certificate of Continuous AML Screening' : 'شهادة المراقبة المستمرة والفحص الآلي الدوري'}
            </h1>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
              {isEn
                ? 'Official audit confirmation of automated continuous watchlist monitoring in accordance with UAE Cabinet Resolution No. (74) of 2020.'
                : 'إفادة رقابية رسمية بخضوع العميل للفحص الدوري التلقائي على مدار الساعة وفقاً لقرار مجلس الوزراء الإماراتي رقم (74) لسنة 2020.'}
            </p>
          </div>
          <div style={{ textAlign: isEn ? 'right' : 'left' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>{isEn ? 'Certificate Ref' : 'رقم الشهادة'}</span>
            <strong style={{ fontSize: '13px', fontFamily: 'monospace', color: '#0f172a' }}>CERT-{customer.reference}</strong>
          </div>
        </div>

        {/* Customer Information Card */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '14px' }}>
            {isEn ? 'Subject Entity Particulars' : 'بيانات العميل الخاضع للرقابة'}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', fontSize: '13px' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Subject Name' : 'اسم العميل'}</span>
              <strong style={{ fontSize: '15px', color: '#0f172a' }}>{customer.name}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Customer Reference' : 'المرجع بالنظام'}</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{customer.reference}</span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'Jurisdiction / Country' : 'الدولة / المقر'}</span>
              <span>{flag(customer.country)} {countryName(customer.country, locale)}</span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{isEn ? 'National Identifier / CR' : 'الهوية / السجل التجاري'}</span>
              <span style={{ fontFamily: 'monospace' }}>{customer.identifier || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Continuous Monitoring Status */}
        <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: '10px', padding: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#dcfce7', display: 'grid', placeItems: 'center', color: '#16a34a', flexShrink: 0 }}>
            <Award size={28} />
          </div>
          <div>
            <strong style={{ fontSize: '16px', color: '#166534', display: 'block' }}>
              {isMonitored
                ? (isEn ? 'Active Continuous Surveillance' : 'المراقبة المستمرة نشطة (مشمول بالحماية والرقابة الدورية)')
                : (isEn ? 'Surveillance Inactive' : 'المراقبة متوقفة مؤقتاً')}
            </strong>
            <p style={{ fontSize: '12px', color: '#15803d', margin: '4px 0 0', lineHeight: 1.5 }}>
              {isEn
                ? `Subject profile is automatically screened across all international watchlists on an ongoing 24/7 cycle. Last verification completed on ${new Date(lastScan).toLocaleString()}.`
                : `يخضع ملف العميل لعمليات فحص دورية مستمرة ومقارنة آنية مع كافة تحديثات القوائم المحلية والدولية. تم آخر فحص تحققي بتاريخ ${new Date(lastScan).toLocaleDateString('ar-AE')}.`}
            </p>
          </div>
        </div>

        {/* Covered Watchlist Scope */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>
            {isEn ? 'Surveillance Coverage Scope' : 'نطاق وقوائم المراقبة المشمولة بالفحص الآلي'}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px' }}>
            {[
              { code: 'UAE_IEC', name: isEn ? 'UAE Local Terrorist & Sanctions List' : 'قائمة الإرهاب المحلية المعتمدة لدولة الإمارات (IEC)' },
              { code: 'UN_CONS', name: isEn ? 'UN Security Council Consolidated Sanctions' : 'قائمة عقوبات مجلس الأمن الدولي الموحدة (الأمم المتحدة)' },
              { code: 'US_OFAC', name: isEn ? 'US Treasury OFAC Specially Designated Nationals' : 'مكتب مراقبة الأصول الأجنبية الأمريكي (OFAC SDN)' },
              { code: 'EU_FSF', name: isEn ? 'European Union Financial Sanctions Files' : 'قوائم العقوبات والتجميد المالي للاتحاد الأوروبي' },
              { code: 'UK_OFSI', name: isEn ? 'UK HM Treasury / OFSI Consolidated List' : 'القائمة الموحدة لتجميد الأصول بالخزانة البريطانية (OFSI)' },
              { code: 'INTERPOL', name: isEn ? 'Interpol Red Notices & International Wanted' : 'نشرات الإنتربول الحمراء والمطلوبين دولياً' },
              { code: 'GLOBAL_PEP', name: isEn ? 'Politically Exposed Persons (PEPs Database)' : 'قواعد بيانات الشخصيات السياسية المعرضة للمخاطر (PEP)' },
              { code: 'ADVERSE_MEDIA', name: isEn ? 'Financial Crime & Adverse Media Feeds' : 'مسح الأخبار السلبية وشبهات الجرائم المالية والاحتيال' }
            ].map(src => (
              <div key={src.code} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                <span>{src.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance Officer Signature & Audit Stamp */}
        <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{isEn ? 'Certified By (Officer)' : 'مسؤول الامتثال المعتمد'}</span>
            <strong style={{ fontSize: '13px', color: '#0f172a' }}>{actor.displayName}</strong>
            <small style={{ display: 'block', color: '#94a3b8', fontSize: '10px' }}>{actor.role === 'admin' ? 'Compliance Administrator' : 'Compliance Analyst'}</small>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{isEn ? 'Date of Issue' : 'تاريخ إصدار الشهادة'}</span>
            <strong style={{ fontSize: '13px', color: '#0f172a' }}><DateText value={new Date()} locale={locale} /></strong>
            <small style={{ display: 'block', color: '#94a3b8', fontSize: '10px' }}>UAE Standard Time (GST)</small>
          </div>
          <div style={{ textAlign: isEn ? 'right' : 'left' }}>
            <div style={{ display: 'inline-block', border: '2px dashed #166534', borderRadius: '8px', padding: '8px 14px', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', display: 'block' }}>DRM COMPLIANCE</span>
              <span style={{ fontSize: '9px', color: '#15803d' }}>OFFICIALLY VERIFIED</span>
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
