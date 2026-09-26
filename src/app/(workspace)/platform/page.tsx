import { notFound } from 'next/navigation';
import {
  Building2,
  CheckCircle2,
  Users,
  Sparkles,
  Layers,
} from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { isPlatformOwner } from '@/lib/platform-access';
import { listAllOrgs } from '@/lib/platform';
import { getLocale, getMessages } from '@/lib/i18n';
import { number } from '@/components/ui';
import PlatformOrgForm from '@/components/platform-org-form';

export const dynamic = 'force-dynamic';
export const revalidate = 0;



export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const actor = await requireActor();
  if (!isPlatformOwner(actor)) notFound();

  const [sp, locale, orgs] = await Promise.all([searchParams, getLocale(), listAllOrgs()]);
  await getMessages();
  const en = locale === 'en';

  const totalUsers = orgs.reduce((acc, o) => acc + (o.users || 0), 0);
  const totalLimit = orgs.reduce((acc, o) => acc + (o.member_limit || 0), 0);
  const enterpriseCount = orgs.filter((o) => o.plan === 'enterprise').length;
  const proCount = orgs.filter((o) => o.plan === 'pro').length;

  const isSingleOrg = orgs.length === 1;
  const singleOrg = isSingleOrg ? orgs[0] : null;

  return (
    <div className="platform-container">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <Building2 size={13} /> {en ? 'Platform Super-Admin' : 'إدارة النظام والمنصة'}
          </div>
          <h1>
            {isSingleOrg
              ? (en ? 'DRM System & Feature Configuration' : 'إعدادات المنظومة والمزايا — DRM')
              : (en ? 'Organizations & Subscriptions' : 'المؤسسات والاشتراكات')}
          </h1>
          <p>
            {isSingleOrg
              ? (en
                  ? 'Configure active modules, team limits, and system capabilities for DRM Diligence Risk Management. Core screening, risk scoring, and official reports are fully active.'
                  : 'التحكم في المزايا والوحدات المفعّلة وسقف أعضاء الفريق لمنظومة دي آر إم (DRM). كافة ميزات الفحص وتقييم المخاطر والتقارير مفعّلة بالكامل.')
              : (en
                  ? 'Manage client tenant plans, toggle add-on modules, and configure seat allocations. Core compliance screening, PEP/sanctions checks, risk scoring, and export reports are standard for all organizations.'
                  : 'إدارة باقات المؤسسات، وتخصيص المزايا الإضافية، وتحديد سقف أعضاء الفريق. الميزات الأساسية (فحص القوائم والعقوبات، تقييم المخاطر، والتقارير الرسمية) مفعّلة تلقائيًا.')}
          </p>
        </div>
      </div>

      {sp.saved && (
        <div className="success-message platform-success-banner" role="status">
          <CheckCircle2 size={18} />
          <div>
            <strong>{en ? 'Settings saved successfully' : 'تم حفظ إعدادات المؤسسة بنجاح'}</strong>
            <p>
              {en
                ? 'Plan privileges, add-ons, and team seat limits have been updated and are active immediately.'
                : 'تم تحديث صلاحيات الباقة، والوحدات الإضافية، وحد أعضاء الفريق، وسرت التغييرات فورياً.'}
            </p>
          </div>
        </div>
      )}

      {/* Metric Cards Overview */}
      <div className="platform-stats-grid">
        <div className="platform-stat-card">
          <div className="platform-stat-icon">
            <Building2 size={20} />
          </div>
          <div className="platform-stat-content">
            <span className="platform-stat-label">
              {isSingleOrg
                ? (en ? 'Active Organization' : 'المؤسسة المعتمدة')
                : (en ? 'Subscribed Firms' : 'المؤسسات المشتركة')}
            </span>
            <strong className="platform-stat-val">
              {isSingleOrg ? 'DRM UAE' : number(orgs.length)}
            </strong>
            <span className="platform-stat-sub">
              {isSingleOrg
                ? (en ? 'Diligence Risk Management' : 'دي آر إم لإدارة المخاطر والخدمات المهنية')
                : (en ? `${enterpriseCount} Enterprise · ${proCount} Pro` : `${enterpriseCount} مؤسسة كبرى · ${proCount} متقدمة`)}
            </span>
          </div>
        </div>

        <div className="platform-stat-card">
          <div className="platform-stat-icon tint-emerald">
            <Users size={20} />
          </div>
          <div className="platform-stat-content">
            <span className="platform-stat-label">
              {en ? 'Active Users / Total Seats' : 'المستخدمون النشطون / المقاعد'}
            </span>
            <strong className="platform-stat-val">
              {number(totalUsers)}{' '}
              <span className="platform-stat-val-sub">/ {number(totalLimit)}</span>
            </strong>
            <span className="platform-stat-sub">
              {isSingleOrg
                ? (en ? 'DRM team accounts' : 'حسابات فريق عمل DRM')
                : (en ? 'Across all tenant organizations' : 'إجمالي الحسابات المفعلة بالمؤسسات')}
            </span>
          </div>
        </div>

        <div className="platform-stat-card">
          <div className="platform-stat-icon tint-gold">
            <Sparkles size={20} />
          </div>
          <div className="platform-stat-content">
            <span className="platform-stat-label">
              {isSingleOrg ? (en ? 'Subscription Tier' : 'مستوى الباقة الحالي') : (en ? 'Multi-Tenant Security' : 'أمان عزل البيانات (RLS)')}
            </span>
            <strong className="platform-stat-val text-emerald">
              {isSingleOrg ? (singleOrg?.plan?.toUpperCase() || 'ENTERPRISE') : (en ? 'Strict Isolation' : 'عزل تام ومحمي')}
            </strong>
            <span className="platform-stat-sub">
              {isSingleOrg
                ? (en ? 'Full enterprise suite & add-ons enabled' : 'شاملة جميع المزايا والوحدات المتقدمة')
                : (en ? 'Zero data leakage between clients' : 'فصل مستقل لكل مؤسسة وسجلاتها')}
            </span>
          </div>
        </div>
      </div>

      {/* Organizations Grid */}
      <div className="platform-orgs">
        {orgs.map((o) => (
          <PlatformOrgForm key={o.id} org={o} locale={locale} />
        ))}
      </div>
    </div>
  );
}
