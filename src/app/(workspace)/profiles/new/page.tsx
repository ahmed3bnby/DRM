import Link from 'next/link';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { hasFeature } from '@/lib/features';
import { canManageCustomers, localizedCountries } from '@/lib/validation';
import { getMessages, getLocale } from '@/lib/i18n';
import CustomerForm from '@/components/customer-form';
type NewProfileParams = { name?: string; type?: string; country?: string; sourceRecordId?: string };

export default async function NewProfile({
  searchParams
}: {
  searchParams?: Promise<NewProfileParams>;
}) {
  const actor = await requireActor();
  const [m, locale, params] = await Promise.all([
    getMessages(),
    getLocale(),
    (searchParams ?? Promise.resolve({})) as Promise<NewProfileParams>
  ]);
  if (!canManageCustomers(actor.role)) return <div className="panel empty"><LockKeyhole/><h1>{m.viewOnlyTitle}</h1><p>{m.viewOnlyBody}</p><Link className="button secondary" href="/profiles">{m.backToCustomers}</Link></div>;
  const defaults = {
    name: params.name ? String(params.name).trim() : undefined,
    entity_type: (params.type === 'individual' ? 'individual' : 'company') as 'individual' | 'company',
    country: params.country ? String(params.country).trim().toUpperCase() : 'AE',
    notes: params.sourceRecordId ? `تم إنشاء الملف استناداً إلى سجل المصادر (${params.sourceRecordId})` : undefined,
  };
  return <><Link href="/profiles" className="back-link"><ArrowRight size={17}/>{m.navCustomers}</Link><div className="page-heading"><div><h1>{m.newTitle}</h1><p>{m.newSub}</p></div><span className="small-tag">{m.newTag}</span></div><CustomerForm defaults={defaults} countryList={localizedCountries(locale)} canUseOcr={hasFeature(actor, 'document_ocr')}/></>;
}
