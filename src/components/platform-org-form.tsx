'use client';

import { useState } from 'react';
import {
  Building2,
  Save,
  Users,
  Sparkles,
  Newspaper,
  Globe,
  ClipboardList,
  Shield,
  Layers,
  Sliders,
  CheckCircle2,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { PREMIUM_FEATURES, type PremiumFeature } from '@/lib/features';
import { updateOrgPlanAction } from '@/app/actions';
import { number } from '@/components/ui';

type OrgData = {
  id: string;
  name: string;
  reference: string;
  plan: string;
  member_limit: number;
  users: number;
  features?: Record<string, boolean>;
};

type PlatformOrgFormProps = {
  org: OrgData;
  locale: string;
};

const FEATURE_META: Record<
  PremiumFeature,
  {
    icon: typeof Newspaper;
    titleAr: string;
    titleEn: string;
    descAr: string;
    descEn: string;
  }
> = {
  adverse_media: {
    icon: Newspaper,
    titleAr: 'الإعلام والوسائط السلبية (Adverse Media)',
    titleEn: 'Adverse Media Screening',
    descAr: 'رصد التحقيقات الصحفية، الأخبار السلبية، وقضايا غسل الأموال ومكافحة تمويل الإرهاب.',
    descEn: 'Negative news tracking, financial crime news intelligence, and reputational risk coverage.',
  },
  company_search: {
    icon: Globe,
    titleAr: 'بحث الشركات وسجلات الكيانات (GLEIF)',
    titleEn: 'Company & LEI Search (GLEIF)',
    descAr: 'الاستعلام المباشر عن الكيانات والشركات عالميًا والتحقق من مُعرّف الكيان القانوني (LEI).',
    descEn: 'Direct international entity lookup and Legal Entity Identifier validation via GLEIF.',
  },
  reviews: {
    icon: ClipboardList,
    titleAr: 'صندوق ومسار تدقيق الحالات (Review Workflow)',
    titleEn: 'Review Inbox & Case Workflow',
    descAr: 'إدارة وتعيين ملفات الاشتباه للمحللين، توثيق مسار التدقيق، واعتماد القرارات رسميًا.',
    descEn: 'Escalation queue, hit adjudication, analyst case assignment, and formal audit trail.',
  },
  regional_sources: {
    icon: Globe,
    titleAr: 'القوائم الإقليمية والعربية (السعودية، مصر، الخليج)',
    titleEn: 'Regional & Arab Watchlists (MENA & GCC)',
    descAr: 'تضمين قوائم الإرهاب والمجالس النيابية في السعودية ومصر وقطر والبحرين وعُمان وباكستان.',
    descEn: 'Regional screening across Saudi Arabia, Egypt, Qatar, Bahrain, Oman, and Pakistan watchlists.',
  },
  enforcement_debarment: {
    icon: Shield,
    titleAr: 'الإنفاذ الدولي وحظر التعاقد (البنك الدولي، الإنتربول)',
    titleEn: 'International Enforcement & Debarment',
    descAr: 'تضمين قوائم منع التعاقد للبنك الدولي ومذكرات الإنتربول الحمراء واليوروبول ومكتب التحقيقات FBI.',
    descEn: 'World Bank debarment, Interpol Red Notices, Europol, and international law enforcement agencies.',
  },
  pep_screening: {
    icon: Users,
    titleAr: 'فحص الشخصيات السياسية البارزة عالمياً (PEP)',
    titleEn: 'Global PEP Screening Depth',
    descAr: 'قواعد بيانات السياسيين والبرلمانات الأوروبية والعالمية ورؤساء الدول وقادة العالم (CIA).',
    descEn: 'Deep coverage for world leaders, European parliamentarians, and global political figures.',
  },
};

// Preset configurations for each plan tier
const PLAN_PRESETS: Record<
  string,
  {
    features: Record<PremiumFeature, boolean>;
    memberLimit: number;
    badgeAr: string;
    badgeEn: string;
  }
> = {
  base: {
    features: {
      adverse_media: false,
      company_search: false,
      reviews: false,
      regional_sources: false,
      enforcement_debarment: false,
      pep_screening: false,
    },
    memberLimit: 5,
    badgeAr: 'الأساسية (Base)',
    badgeEn: 'Base Plan',
  },
  pro: {
    features: {
      reviews: true,
      company_search: true,
      regional_sources: true,
      adverse_media: false,
      enforcement_debarment: false,
      pep_screening: false,
    },
    memberLimit: 15,
    badgeAr: 'المتقدمة (Pro)',
    badgeEn: 'Pro Plan',
  },
  enterprise: {
    features: {
      reviews: true,
      adverse_media: true,
      company_search: true,
      regional_sources: true,
      enforcement_debarment: true,
      pep_screening: true,
    },
    memberLimit: 100,
    badgeAr: 'المؤسسات الكبرى (Enterprise)',
    badgeEn: 'Enterprise Plan',
  },
};

export default function PlatformOrgForm({ org, locale }: PlatformOrgFormProps) {
  const en = locale === 'en';

  const [currentPlan, setCurrentPlan] = useState<string>(org.plan || 'base');
  const [memberLimit, setMemberLimit] = useState<number>(org.member_limit || 5);
  const [features, setFeatures] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const key of PREMIUM_FEATURES) {
      initial[key] = org.features?.[key] === true;
    }
    return initial;
  });
  const [presetNotice, setPresetNotice] = useState<string | null>(null);

  // When user selects a new plan from dropdown, automatically update features and seats
  const handlePlanChange = (newPlan: string) => {
    setCurrentPlan(newPlan);
    const preset = PLAN_PRESETS[newPlan];
    if (preset) {
      setFeatures({ ...preset.features });
      setMemberLimit(preset.memberLimit);
      setPresetNotice(
        en
          ? `Switched to ${preset.badgeEn} defaults. You can still customize any toggle below.`
          : `تم تطبيق إعدادات باقة ${preset.badgeAr} تلقائياً. يمكنك تخصيص أي خيار أدناه بحرية.`
      );
    }
  };

  const handleFeatureToggle = (key: string, checked: boolean) => {
    setFeatures((prev) => ({ ...prev, [key]: checked }));
    setPresetNotice(null);
  };

  const isEnterprise = currentPlan === 'enterprise';
  const isPro = currentPlan === 'pro';
  const planBadgeClass = isEnterprise
    ? 'plan-tag enterprise'
    : isPro
    ? 'plan-tag pro'
    : 'plan-tag base';

  return (
    <form action={updateOrgPlanAction} className="panel platform-org-card">
      <input type="hidden" name="orgId" value={org.id} />

      {/* Card Header */}
      <div className="platform-card-header">
        <div className="platform-org-identity">
          <div className="platform-org-avatar">
            <Building2 size={22} />
          </div>
          <div>
            <h2 dir="auto" className="platform-org-name">
              {org.name}
            </h2>
            <div className="platform-org-meta">
              <span className="platform-ref-pill" dir="ltr">
                {org.reference}
              </span>
              <span className="platform-usage-pill">
                <Users size={12} />
                <span>
                  {number(org.users)} / {number(memberLimit)} {en ? 'seats' : 'مستخدم'}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="platform-plan-badge-wrapper">
          <span className={planBadgeClass}>
            {isEnterprise && <Sparkles size={11} />}
            {currentPlan.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Plan Selector */}
      <div className="platform-field-box">
        <div className="platform-box-header">
          <Sliders size={14} className="platform-box-icon" />
          <label htmlFor={`plan_${org.id}`} className="platform-box-label">
            {en ? 'Subscription Tier (Select Plan Preset)' : 'مستوى اشتراك المنشأة (اختر باقة لتطبيق مزاياها تلقائياً)'}
          </label>
        </div>
        <div className="platform-select-wrapper">
          <select
            id={`plan_${org.id}`}
            name="plan"
            value={currentPlan}
            onChange={(e) => handlePlanChange(e.target.value)}
            className="platform-plan-select"
          >
            <option value="base">
              {en
                ? 'Base Plan — Core Sanctions (OpenSanctions) + UAE Lists Standard'
                : 'الباقة الأساسية (Base) — فحص عقوبات OpenSanctions + قوائم دولة الإمارات تلقائياً'}
            </option>
            <option value="pro">
              {en
                ? 'Pro Plan — For active compliance teams (Reviews + GLEIF + Regional)'
                : 'الباقة المتقدمة (Pro) — لفرق الامتثال (صندوق الحالات + بحث الشركات + القوائم الإقليمية)'}
            </option>
            <option value="enterprise">
              {en
                ? 'Enterprise Plan — Full enterprise suite (All sources, PEP & Media)'
                : 'باقة المؤسسات الكبرى (Enterprise) — تفعيل شامل لكافة القوائم ومصادر PEP والإعلام'}
            </option>
          </select>
        </div>
      </div>

      {presetNotice && (
        <div className="platform-preset-alert" role="status">
          <CheckCircle2 size={15} />
          <span>{presetNotice}</span>
        </div>
      )}

      {/* Core Lists Built-in Notice */}
      <div className="platform-core-banner">
        <div className="platform-core-banner-icon">
          <ShieldCheck size={20} />
        </div>
        <div className="platform-core-banner-text">
          <strong>
            {en
              ? 'Core Watchlists Always Active (Included in all tiers)'
              : 'القوائم الأساسية مفعّلة تلقائياً في كافة الباقات (بدون أي تكلفة إضافية):'}
          </strong>
          <p>
            {en
              ? 'Global OpenSanctions (UN, OFAC, EU, UK, Canada, Australia, Switzerland) + UAE Official Lists (UAE Local Terrorist list & DFSA Prohibited) are permanently active for all screenings.'
              : 'عقوبات OpenSanctions الدولية (الأمم المتحدة، الخزانة الأمريكية OFAC، الاتحاد الأوروبي، بريطانيا، كندا، أستراليا، سويسرا) + قوائم دولة الإمارات الرسمية (قائمة الإرهاب المحلية وقائمة DFSA) مشمولة تلقائياً في كل فحص.'}
          </p>
        </div>
      </div>

      {/* Add-on Feature Toggles */}
      <div className="platform-features-section">
        <div className="platform-section-title">
          <Layers size={14} />
          <div>
            <h3>{en ? 'Optional Add-on Modules & Source Packs' : 'المزايا الإضافية وباقات المصادر المتقدمة'}</h3>
            <p>
              {en
                ? 'Toggle additional modules. When you change the plan above, these toggles adapt automatically.'
                : 'يتم ضبط هذه السويتشات تلقائياً عند تغيير الباقة بالأعلى، كما يمكنك تشغيل أو تعطيل أي ميزة يدوياً.'}
            </p>
          </div>
        </div>

        <div className="platform-features-list">
          {PREMIUM_FEATURES.map((k) => {
            const meta = FEATURE_META[k];
            const Icon = meta.icon;
            const isChecked = features[k] === true;
            const inputId = `f_${org.id}_${k}`;

            return (
              <label key={k} htmlFor={inputId} className="platform-feature-row">
                <div className="platform-feature-info">
                  <div className="platform-feature-icon">
                    <Icon size={16} />
                  </div>
                  <div>
                    <div className="platform-feature-title">
                      {en ? meta.titleEn : meta.titleAr}
                    </div>
                    <div className="platform-feature-desc">
                      {en ? meta.descEn : meta.descAr}
                    </div>
                  </div>
                </div>

                <div className="platform-toggle-wrapper">
                  <input
                    type="checkbox"
                    id={inputId}
                    name={`f_${k}`}
                    checked={isChecked}
                    onChange={(e) => handleFeatureToggle(k, e.target.checked)}
                    className="platform-toggle-input"
                  />
                  <span className="platform-toggle-track" aria-hidden="true">
                    <span className="platform-toggle-thumb" />
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Team Member Limit Allocation */}
      <div className="platform-field-box">
        <div className="platform-box-header">
          <Users size={14} className="platform-box-icon" />
          <label htmlFor={`limit_${org.id}`} className="platform-box-label">
            {en ? 'Maximum Team Seats Allocation' : 'الحد الأقصى لعدد مقاعد الفريق'}
          </label>
        </div>
        <div className="platform-limit-control">
          <input
            id={`limit_${org.id}`}
            type="number"
            name="member_limit"
            min={1}
            max={1000}
            value={memberLimit}
            onChange={(e) => setMemberLimit(Number(e.target.value) || 1)}
            className="platform-limit-input"
          />
          <span className="platform-limit-unit">
            {en ? 'Active team members allowed' : 'مستخدم ومحلل مسموح به في المؤسسة'}
          </span>
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="platform-card-footer">
        <button type="submit" className="button primary platform-save-btn">
          <Save size={15} />
          <span>{en ? 'Save Organization Settings' : 'حفظ تعديلات المؤسسة'}</span>
        </button>
      </div>
    </form>
  );
}
