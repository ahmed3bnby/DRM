'use client';

import { useState } from 'react';
import {
  Building2,
  Users,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Activity,
  Sliders,
  ShieldAlert,
  CheckCircle2,
  Info,
} from 'lucide-react';
import type {
  PlatformOrg,
  SystemLockdown,
  PlatformChecksSummary,
  AccountQuotaItem,
  PlatformQuotaHistoryItem,
} from '@/lib/platform';
import { number } from '@/components/ui';
import PlatformQuotaManager from '@/components/platform-quota-manager';
import PlatformOrgForm from '@/components/platform-org-form';
import SystemLockdownControl from '@/components/system-lockdown-control';

export default function PlatformView({
  initialTab = 'quota',
  locale,
  orgs,
  lockdown,
  summary,
  accounts,
  history,
  saved,
  lockdownSaved,
  quotaUpdated,
}: {
  initialTab?: string;
  locale: string;
  orgs: PlatformOrg[];
  lockdown: SystemLockdown;
  summary: PlatformChecksSummary;
  accounts: AccountQuotaItem[];
  history: PlatformQuotaHistoryItem[];
  saved?: boolean;
  lockdownSaved?: boolean;
  quotaUpdated?: boolean;
}) {
  const isAr = locale === 'ar';
  const en = !isAr;

  // Determine active tab: priority to explicit action outcomes if present
  const defaultTab = lockdownSaved ? 'lockdown' : saved ? 'plan' : initialTab || 'quota';
  const [activeTab, setActiveTab] = useState<'quota' | 'plan' | 'lockdown'>(
    defaultTab === 'plan' || defaultTab === 'lockdown' ? defaultTab : 'quota'
  );

  const totalUsers = orgs.reduce((acc, o) => acc + (o.users || 0), 0);
  const totalLimit = orgs.reduce((acc, o) => acc + (o.member_limit || 0), 0);
  const isSingleOrg = orgs.length === 1;
  const singleOrg = isSingleOrg ? orgs[0] : null;

  const handleTabChange = (tab: 'quota' | 'plan' | 'lockdown') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      url.searchParams.delete('saved');
      url.searchParams.delete('lockdown_saved');
      url.searchParams.delete('quota_updated');
      window.history.replaceState({}, '', url.toString());
    }
  };

  return (
    <div className="platform-container">
      {/* ── Page Header ── */}
      <div className="platform-hero-header">
        <div className="platform-hero-info">
          <div className="eyebrow">
            <Building2 size={13} /> {en ? 'Platform Super-Admin' : 'إدارة النظام والمنصة'}
          </div>
          <h1>
            {isSingleOrg
              ? (en ? 'DRM System & Feature Configuration' : 'إعدادات المنظومة والمزايا — DRM')
              : (en ? 'Organizations & Subscriptions' : 'المؤسسات والاشتراكات')}
          </h1>
          <p>
            {isAr
              ? 'لوحة التحكم المركزية للمشرف العام: متابعة استهلاك وفحوصات الحسابات، إدارة باقات المنشآت والمزايا، والتحكم في تشغيل وأمان المنظومة.'
              : 'Central Super-Admin hub: monitor account screening quotas, configure client subscription tiers & add-ons, and manage platform operational status.'}
          </p>
        </div>

        {/* System Health Status Indicator */}
        <div className="platform-hero-badge-wrap">
          <button
            type="button"
            onClick={() => handleTabChange('lockdown')}
            className={`platform-status-pill ${lockdown.enabled ? 'status-pill-locked' : 'status-pill-ok'}`}
            title={isAr ? 'اضغط لإدارة حالة تشغيل النظام' : 'Click to manage operational status'}
          >
            <span className="status-ping-dot" />
            <span>
              {lockdown.enabled
                ? (isAr ? 'وضع الصيانة مفعّل (الوصول معطّل)' : 'System Locked Down')
                : (isAr ? 'المنظومة تعمل بصورة طبيعية' : 'System Operational')}
            </span>
          </button>
        </div>
      </div>

      {/* ── Action Success Banners ── */}
      {saved && activeTab === 'plan' && (
        <div className="success-message platform-success-banner" role="status">
          <CheckCircle2 size={18} />
          <div>
            <strong>{en ? 'Settings saved successfully' : 'تم حفظ إعدادات المؤسسة بنجاح'}</strong>
            <p>
              {en
                ? 'Plan privileges, add-ons, and team seat limits have been updated and are active immediately.'
                : 'تم تحديث صلاحيات الباقة، والوحدات الإضافية، وسقف المقاعد، وسرت التغييرات فورياً.'}
            </p>
          </div>
        </div>
      )}

      {lockdownSaved && activeTab === 'lockdown' && (
        <div className="success-message platform-success-banner" role="status">
          <CheckCircle2 size={18} />
          <div>
            <strong>{en ? 'Operational status updated' : 'تم تحديث حالة تشغيل المنظومة بنجاح'}</strong>
            <p>
              {lockdown.enabled
                ? (en ? 'System lockdown is now active. Regular users cannot sign in.' : 'تم تفعيل وضع الصيانة وتعطيل وصول المستخدمين بنجاح.')
                : (en ? 'System has been re-enabled. Regular user access is restored.' : 'تم تشغيل النظام واستئناف العمل لكافة المستخدمين بنجاح.')}
            </p>
          </div>
        </div>
      )}

      {quotaUpdated && activeTab === 'quota' && (
        <div className="success-message platform-success-banner" role="status">
          <CheckCircle2 size={18} />
          <div>
            <strong>{en ? 'Quota updated successfully' : 'تم شحن وتعديل رصيد الفحص بنجاح'}</strong>
            <p>
              {en
                ? 'Account allowance has been updated and the change has been recorded in the credit audit trail.'
                : 'تم تعديل رصيد الحساب وسرت التغييرات فورياً، وتم توثيق العملية بالكامل في سجل التدقيق التاريخي.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Unified 4-Metric Overview Bar ── */}
      <div className="platform-stats-grid platform-unified-kpi-grid">
        {/* Metric 1: Platform Total Checks */}
        <div className="platform-stat-card">
          <div className="platform-stat-icon tint-emerald">
            <ShieldCheck size={22} />
          </div>
          <div className="platform-stat-content">
            <span className="platform-stat-label">
              {isAr ? 'إجمالي الفحوصات المنفذة' : 'Total Platform Checks'}
            </span>
            <strong className="platform-stat-val text-emerald">
              {number(summary.totalChecks)}
            </strong>
            <span className="platform-stat-sub">
              {isAr
                ? `اليوم: ${number(summary.todayChecks)} · آخر 7 أيام: ${number(summary.weekChecks)}`
                : `Today: ${number(summary.todayChecks)} · 7d: ${number(summary.weekChecks)}`}
            </span>
          </div>
        </div>

        {/* Metric 2: Active Accounts / Seats */}
        <div className="platform-stat-card">
          <div className="platform-stat-icon">
            <Users size={22} />
          </div>
          <div className="platform-stat-content">
            <span className="platform-stat-label">
              {isAr ? 'الحسابات النشطة / المقاعد' : 'Active Users / Total Seats'}
            </span>
            <strong className="platform-stat-val">
              {number(totalUsers)}{' '}
              <span className="platform-stat-val-sub">/ {number(totalLimit)}</span>
            </strong>
            <span className="platform-stat-sub">
              {isAr
                ? `${summary.activeAccounts} حساب أجرى عمليات فحص`
                : `${summary.activeAccounts} accounts performed screenings`}
            </span>
          </div>
        </div>

        {/* Metric 3: Quota Checks Allocated */}
        <div className="platform-stat-card">
          <div className="platform-stat-icon tint-gold">
            <TrendingUp size={22} />
          </div>
          <div className="platform-stat-content">
            <span className="platform-stat-label">
              {isAr ? 'إجمالي الحصص المشحونة' : 'Allocated Quota Checks'}
            </span>
            <strong className="platform-stat-val text-gold">
              {number(summary.totalAllocatedQuota)}
            </strong>
            <span className="platform-stat-sub">
              {isAr
                ? `${summary.totalAccountsWithQuota} بحصة محددة · ${summary.unlimitedAccounts} غير محدود`
                : `${summary.totalAccountsWithQuota} capped · ${summary.unlimitedAccounts} unlimited`}
            </span>
          </div>
        </div>

        {/* Metric 4: Subscription Tier & Health */}
        <div className="platform-stat-card">
          <div className="platform-stat-icon tint-indigo">
            <Sparkles size={22} />
          </div>
          <div className="platform-stat-content">
            <span className="platform-stat-label">
              {isAr ? 'مستوى الباقة والتشغيل' : 'Tier & Operational State'}
            </span>
            <strong className="platform-stat-val">
              {singleOrg?.plan?.toUpperCase() || 'ENTERPRISE'}
            </strong>
            <span className="platform-stat-sub">
              {lockdown.enabled
                ? (isAr ? 'وضع الصيانة معطّل للمستخدمين' : 'Maintenance active')
                : (isAr ? 'كافة الوحدات والخدمات نشطة' : 'All modules operational')}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Tab Navigation Bar ── */}
      <div className="platform-main-tabs-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'quota'}
          onClick={() => handleTabChange('quota')}
          className={`platform-main-tab-item ${activeTab === 'quota' ? 'active' : ''}`}
        >
          <Activity size={17} />
          <span className="tab-title">
            {isAr ? 'إدارة الفحوصات والحصص وسجل الشحن' : 'Screening Checks & Quotas'}
          </span>
          <span className="tab-pill-badge">{accounts.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'plan'}
          onClick={() => handleTabChange('plan')}
          className={`platform-main-tab-item ${activeTab === 'plan' ? 'active' : ''}`}
        >
          <Sliders size={17} />
          <span className="tab-title">
            {isAr ? 'باقة المنشأة والمزايا البرمجية' : 'Plan & Add-on Modules'}
          </span>
          <span className="tab-pill-badge uppercase">
            {singleOrg?.plan || 'Plan'}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'lockdown'}
          onClick={() => handleTabChange('lockdown')}
          className={`platform-main-tab-item ${activeTab === 'lockdown' ? 'active' : ''}`}
        >
          <ShieldAlert size={17} />
          <span className="tab-title">
            {isAr ? 'حالة التشغيل والأمان' : 'System Lockdown & Status'}
          </span>
          <span className={`tab-status-dot ${lockdown.enabled ? 'dot-locked' : 'dot-ok'}`} />
        </button>
      </div>

      {/* ── TAB 1: SCREENING CHECKS & QUOTA MANAGEMENT ── */}
      {activeTab === 'quota' && (
        <PlatformQuotaManager
          summary={summary}
          accounts={accounts}
          history={history}
          locale={locale}
          isSingleOrg={isSingleOrg}
        />
      )}

      {/* ── TAB 2: ORGANIZATION PLAN & MODULE TOGGLES ── */}
      {activeTab === 'plan' && (
        <div className="platform-tab-content">
          <div className="platform-orgs">
            {orgs.map((o) => (
              <PlatformOrgForm key={o.id} org={o} locale={locale} />
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: SYSTEM LOCKDOWN & MAINTENANCE ── */}
      {activeTab === 'lockdown' && (
        <div className="platform-tab-content">
          <SystemLockdownControl lockdown={lockdown} locale={locale} />
        </div>
      )}
    </div>
  );
}
