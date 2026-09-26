import { notFound } from 'next/navigation';
import { Building2, Save } from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { isPlatformOwner } from '@/lib/platform-access';
import { listAllOrgs } from '@/lib/platform';
import { PREMIUM_FEATURES, FEATURE_LABELS } from '@/lib/features';
import { updateOrgPlanAction } from '@/app/actions';
import { getLocale, getMessages } from '@/lib/i18n';
import { number } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PlatformPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const actor = await requireActor();
  if (!isPlatformOwner(actor)) notFound();
  const [sp, locale, orgs] = await Promise.all([searchParams, getLocale(), listAllOrgs()]);
  await getMessages();
  const en = locale === 'en';
  return <>
    <div className="page-heading"><div><div className="eyebrow"><Building2 size={13}/> {en ? 'Platform management' : 'إدارة المنصة'}</div><h1>{en ? 'Organizations & plans' : 'المؤسسات والباقات'}</h1><p>{en ? 'Enable premium features per client. Base features (search, profiles, screening, reports, capped team) are always on.' : 'فعّل المزايا المدفوعة لكل عميل. المزايا الأساسية (البحث، الملفات، الفحص، التقارير، فريق محدود) دايمًا شغّالة.'}</p></div></div>
    {sp.saved && <div className="success-message">{en ? 'Plan updated.' : 'تم تحديث الباقة.'}</div>}
    <div className="platform-orgs">
      {orgs.map(o => <form key={o.id} action={updateOrgPlanAction} className="panel platform-org">
        <input type="hidden" name="orgId" value={o.id}/>
        <div className="platform-org-head">
          <div><h2 dir="auto">{o.name}</h2><small dir="ltr">{o.reference} · {number(o.users)} {en ? 'users' : 'مستخدم'}</small></div>
          <label className="platform-plan"><span>{en ? 'Plan' : 'الباقة'}</span>
            <select name="plan" defaultValue={o.plan}><option value="base">Base</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></select>
          </label>
        </div>
        <div className="platform-features">
          {PREMIUM_FEATURES.map(k => <label key={k} className="platform-feature">
            <input type="checkbox" name={`f_${k}`} defaultChecked={o.features?.[k] === true}/>
            <span>{en ? FEATURE_LABELS[k].en : FEATURE_LABELS[k].ar}</span>
          </label>)}
          <label className="platform-feature platform-limit">
            <span className="platform-limit-label">{en ? 'Team member limit' : 'حد عدد المستخدمين'}</span>
            <input type="number" name="member_limit" min={1} max={1000} defaultValue={o.member_limit}/>
          </label>
        </div>
        <button className="button primary platform-save"><Save size={16}/>{en ? 'Save' : 'حفظ'}</button>
      </form>)}
    </div>
  </>;
}
