import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Users,
  Layers,
  Globe2,
  Building2,
  Coins,
  FileSpreadsheet,
  ArrowUpRight,
  Clock3,
  Activity,
  Sparkles,
  AlertOctagon,
  KeyRound,
  LockKeyhole,
} from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { getLocale, getMessages } from '@/lib/i18n';
import { getComplianceAnalytics } from '@/lib/analytics';
import { number, DateText, DateTimeText } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'لوحة مؤشرات الامتثال والحوكمة التنفيذية | DRM',
  };
}

export default async function AnalyticsPage() {
  const actor = await requireActor();
  const locale = await getLocale();
  const isEn = locale === 'en';

  // Executive org-level dashboard: restricted to admins, like the Team and
  // Administration areas. Analysts/viewers get the same view-only notice used
  // elsewhere in the workspace.
  if (actor.role !== 'admin') {
    const m = await getMessages();
    return (
      <div className="panel empty">
        <LockKeyhole />
        <h1>{m.viewOnlyTitle}</h1>
        <p>{m.viewOnlyBody}</p>
      </div>
    );
  }

  const data = await getComplianceAnalytics(actor.organizationId);

  return (
    <main className="analytics-page">
      {/* Top Header Card */}
      <div className="analytics-header-card">
        <div className="analytics-header-left">
          <div className="analytics-icon-badge">
            <BarChart3 size={24} />
          </div>
          <div className="analytics-header-titles">
            <h1>
              <span>{isEn ? 'Compliance & Risk Executive Dashboard' : 'لوحة مؤشرات الامتثال والحوكمة التنفيذية'}</span>
              <span className="analytics-live-pill">
                {isEn ? 'Live Enterprise Feed' : 'مباشر · الحساب المؤسسي'}
              </span>
            </h1>
            <p>
              {isEn
                ? 'Consolidated view of customer screening volume, decision-assistant efficiency, FATF exposure, and goAML DNFBP statutory filings.'
                : 'رؤية مركزية لحجم عمليات الفحص، دقة استبعاد التشابه السطحي الذكي، توزيع مخاطر FATF، وبلاغات goAML الرسمية.'}
            </p>
          </div>
        </div>

        <div className="analytics-header-time">
          <Clock3 size={14} />
          <span>{isEn ? 'Last Updated:' : 'آخر تحديث:'} <strong><DateTimeText value={new Date()} locale={locale} /></strong></span>
        </div>
      </div>

      {/* 4 Primary KPI Summary Cards */}
      <div className="analytics-kpi-grid">
        {/* Card 1: Screened Customers */}
        <div className="analytics-kpi-card">
          <div className="analytics-kpi-top">
            <span className="analytics-kpi-title">{isEn ? 'Total Screened Profiles' : 'إجمالي الملفات المفحوصة'}</span>
            <div className="analytics-kpi-icon blue">
              <Users size={18} />
            </div>
          </div>
          <div className="analytics-kpi-value">
            {number(data.overview.totalCustomers)}
          </div>
          <div className="analytics-kpi-footer">
            <span>{isEn ? '24/7 Monitored:' : 'تحت المراقبة المستمرة:'}</span>
            <strong style={{ color: '#059669' }}>{number(data.overview.activeMonitored)}</strong>
          </div>
        </div>

        {/* Card 2: AI False Positive Assistant Clearance Rate */}
        <div className="analytics-kpi-card">
          <div className="analytics-kpi-top">
            <span className="analytics-kpi-title">{isEn ? 'Decision Assistant Efficiency' : 'دقة مساعد القرار (استبعاد التشابه)'}</span>
            <div className="analytics-kpi-icon emerald">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="analytics-kpi-value emerald">
            {data.decisionAccuracy.falsePositiveRate}%
          </div>
          <div className="analytics-kpi-footer">
            <span>{isEn ? 'Dismissed False Hits:' : 'مطابقات مستبعدة آلياً:'}</span>
            <strong>{number(data.decisionAccuracy.dismissedFalsePositive)}</strong>
          </div>
        </div>

        {/* Card 3: Pending Review Cases */}
        <div className="analytics-kpi-card">
          <div className="analytics-kpi-top">
            <span className="analytics-kpi-title">{isEn ? 'Review Inbox & Case Load' : 'صندوق الحالات قيد المراجعة'}</span>
            <div className="analytics-kpi-icon amber">
              <Clock3 size={18} />
            </div>
          </div>
          <div className="analytics-kpi-value amber">
            {number(data.overview.pendingReviews)}
          </div>
          <div className="analytics-kpi-footer">
            <Link href="/reviews" style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span>{isEn ? 'Open Review Cases' : 'فتح صندوق الحالات'}</span>
              <ArrowUpRight size={12} />
            </Link>
            <span>{number(data.overview.resolvedReviews)} {isEn ? 'resolved' : 'مكتملة'}</span>
          </div>
        </div>

        {/* Card 4: Official goAML & DNFBP Filings */}
        <div className="analytics-kpi-card">
          <div className="analytics-kpi-top">
            <span className="analytics-kpi-title">{isEn ? 'Official Regulatory Filings' : 'بلاغات goAML وDNFBP الرسمية'}</span>
            <div className="analytics-kpi-icon indigo">
              <FileSpreadsheet size={18} />
            </div>
          </div>
          <div className="analytics-kpi-value indigo">
            {number(data.dnfbpFilings.totalSarStr + data.dnfbpFilings.totalRear + data.dnfbpFilings.totalFari + data.dnfbpFilings.totalPreciousMetals)}
          </div>
          <div className="analytics-kpi-footer">
            <span>{isEn ? 'Real Estate (REAR):' : 'عقارات REAR:'}</span>
            <strong style={{ color: '#4f46e5' }}>{number(data.dnfbpFilings.totalRear)}</strong>
          </div>
        </div>
      </div>

      {/* Main 3 Analytical Breakdown Panels */}
      <div className="analytics-grid-3">
        {/* Panel 1: Institutional Risk Distribution */}
        <section className="analytics-card">
          <div className="analytics-card-header">
            <h3 className="analytics-card-title">
              <ShieldAlert size={17} style={{ color: '#e11d48' }} />
              <span>{isEn ? 'Screening Risk Bands' : 'توزيع مستويات المخاطر'}</span>
            </h3>
            <span className="analytics-card-tag">4-Tier Model</span>
          </div>

          <div className="analytics-bars-container">
            <div className="analytics-bar-item">
              <div className="analytics-bar-label-row">
                <span style={{ color: '#e11d48' }}>
                  {isEn ? 'High Risk (Sanctions / Maritime / Debarment)' : 'مخاطر عالية (عقوبات / حظر سفن / إنفاذ)'}
                </span>
                <span style={{ fontFamily: 'monospace' }}>{number(data.riskDistribution.high)}</span>
              </div>
              <div className="analytics-bar-track">
                <div
                  className="analytics-bar-fill rose"
                  style={{ width: `${Math.min(100, Math.max(5, (data.riskDistribution.high / (data.overview.totalCustomers || 1)) * 100))}%` }}
                />
              </div>
            </div>

            <div className="analytics-bar-item">
              <div className="analytics-bar-label-row">
                <span style={{ color: '#d97706' }}>
                  {isEn ? 'Medium Risk (PEP / Crime / Regulatory Alerts)' : 'مخاطر متوسطة (شخصيات سياسية / تنبيهات رقابية)'}
                </span>
                <span style={{ fontFamily: 'monospace' }}>{number(data.riskDistribution.medium)}</span>
              </div>
              <div className="analytics-bar-track">
                <div
                  className="analytics-bar-fill amber"
                  style={{ width: `${Math.min(100, Math.max(5, (data.riskDistribution.medium / (data.overview.totalCustomers || 1)) * 100))}%` }}
                />
              </div>
            </div>

            <div className="analytics-bar-item">
              <div className="analytics-bar-label-row">
                <span style={{ color: '#059669' }}>
                  {isEn ? 'Low / Screened Clean' : 'مخاطر منخفضة / سليم بدون مطابقات'}
                </span>
                <span style={{ fontFamily: 'monospace' }}>{number(data.riskDistribution.low)}</span>
              </div>
              <div className="analytics-bar-track">
                <div
                  className="analytics-bar-fill emerald"
                  style={{ width: `${Math.min(100, Math.max(20, (data.riskDistribution.low / (data.overview.totalCustomers || 1)) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Panel 2: FATF Country & Jurisdiction Risk */}
        <section className="analytics-card">
          <div className="analytics-card-header">
            <h3 className="analytics-card-title">
              <Globe2 size={17} style={{ color: '#0284c7' }} />
              <span>{isEn ? 'FATF Jurisdictional Exposure' : 'التعرض الجغرافي وقوائم FATF'}</span>
            </h3>
            <span className="analytics-card-tag">FATF Plenary</span>
          </div>

          <div className="analytics-fatf-matrix">
            <div className="fatf-matrix-box blacklist">
              <div className="fatf-matrix-title">
                <AlertOctagon size={13} />
                <span>{isEn ? 'Blacklist' : 'القائمة السوداء'}</span>
              </div>
              <div className="fatf-matrix-val" style={{ color: '#9f1239' }}>
                {number(data.fatfExposure.blacklistCount)}
              </div>
              <div className="fatf-matrix-sub">{isEn ? 'Call for Action' : 'عالية المخاطر / حظر'}</div>
            </div>

            <div className="fatf-matrix-box greylist">
              <div className="fatf-matrix-title">
                <Clock3 size={13} />
                <span>{isEn ? 'Greylist' : 'القائمة الرمادية'}</span>
              </div>
              <div className="fatf-matrix-val" style={{ color: '#92400e' }}>
                {number(data.fatfExposure.greylistCount)}
              </div>
              <div className="fatf-matrix-sub">{isEn ? 'Increased Monitoring' : 'مراقبة مشددة'}</div>
            </div>

            <div className="fatf-matrix-box gcc">
              <div className="fatf-matrix-title">
                <ShieldCheck size={13} />
                <span>{isEn ? 'GCC Hubs' : 'دول الخليج (GCC)'}</span>
              </div>
              <div className="fatf-matrix-val" style={{ color: '#166534' }}>
                {number(data.fatfExposure.gccCount)}
              </div>
              <div className="fatf-matrix-sub">{isEn ? 'Low Sovereign Risk' : 'مخاطر سيادية قياسية'}</div>
            </div>

            <div className="fatf-matrix-box other">
              <div className="fatf-matrix-title">
                <Globe2 size={13} />
                <span>{isEn ? 'Global Rest' : 'باقي الدول'}</span>
              </div>
              <div className="fatf-matrix-val" style={{ color: '#334155' }}>
                {number(data.fatfExposure.otherCount)}
              </div>
              <div className="fatf-matrix-sub">{isEn ? 'Standard Risk' : 'مخاطر دولية معتادة'}</div>
            </div>
          </div>
        </section>

        {/* Panel 3: UAE DNFBP & goAML Breakdown */}
        <section className="analytics-card">
          <div className="analytics-card-header">
            <h3 className="analytics-card-title">
              <Building2 size={17} style={{ color: '#4f46e5' }} />
              <span>{isEn ? 'UAE DNFBP Regulatory Filings' : 'تقارير المهن غير المالية (DNFBP)'}</span>
            </h3>
            <span className="analytics-card-tag">FIU goAML</span>
          </div>

          <div className="dnfbp-rows-container">
            <div className="dnfbp-row-item">
              <div className="dnfbp-row-left">
                <Building2 size={16} style={{ color: '#4f46e5' }} />
                <div className="dnfbp-row-title">
                  <strong>REAR</strong>
                  <p>{isEn ? 'Real Estate Deals (≥ 55k AED)' : 'صفقات عقارية نقدية / كيانات'}</p>
                </div>
              </div>
              <span className="dnfbp-row-val" style={{ color: '#4338ca' }}>{number(data.dnfbpFilings.totalRear)}</span>
            </div>

            <div className="dnfbp-row-item">
              <div className="dnfbp-row-left">
                <Coins size={16} style={{ color: '#d97706' }} />
                <div className="dnfbp-row-title">
                  <strong>FARI</strong>
                  <p>{isEn ? 'Virtual Assets & Cash (≥ 55k)' : 'تدفقات نقدية وعملات مشفرة'}</p>
                </div>
              </div>
              <span className="dnfbp-row-val" style={{ color: '#b45309' }}>{number(data.dnfbpFilings.totalFari)}</span>
            </div>

            <div className="dnfbp-row-item">
              <div className="dnfbp-row-left">
                <ShieldAlert size={16} style={{ color: '#e11d48' }} />
                <div className="dnfbp-row-title">
                  <strong>SAR / STR</strong>
                  <p>{isEn ? 'Suspicious Activity Reports' : 'بلاغات اشتباه غسل الأموال'}</p>
                </div>
              </div>
              <span className="dnfbp-row-val" style={{ color: '#be123c' }}>{number(data.dnfbpFilings.totalSarStr)}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Live Recent Compliance Audit Feed */}
      <section className="analytics-ledger-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">
            <Activity size={18} style={{ color: '#007527' }} />
            <span>{isEn ? 'Recent Compliance Actions & Audit Stream' : 'سجل نشاط الامتثال والتدقيق المباشر'}</span>
          </h3>
          <span className="analytics-card-tag">{isEn ? 'Immutable Ledger' : 'سجل رقابي غير قابل للتعديل'}</span>
        </div>

        <div className="analytics-ledger-feed">
          {data.recentActivities.length > 0 ? (
            data.recentActivities.map((act) => (
              <div key={act.id} className="analytics-ledger-row">
                <div className="analytics-ledger-info">
                  <div className="analytics-ledger-dot">
                    <CheckCircle2 size={14} />
                  </div>
                  <div className="analytics-ledger-text">
                    <strong>{act.summary}</strong>
                    <p>
                      <span>{isEn ? 'Officer:' : 'المحلل:'} {act.actorName}</span>
                      {act.customerName && (
                        <span> · {isEn ? 'Customer:' : 'العميل:'} <strong style={{ color: '#0f172a' }}>{act.customerName}</strong> ({act.customerRef})</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="analytics-ledger-time">
                  <DateTimeText value={new Date(act.createdAt)} locale={locale} />
                </div>
              </div>
            ))
          ) : (
            <p style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              {isEn ? 'No recent activities recorded.' : 'لا يوجد سجلات نشاط حديثة.'}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
