import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { getCustomerByHandle } from '@/lib/customers';
import { canManageCustomers, localizedCountries } from '@/lib/validation';
import { getMessages, getLocale } from '@/lib/i18n';
import CustomerForm from '@/components/customer-form';

// Customer records and authorization are request-specific.  Never reuse a cached
// not-found result for an edit route after a profile is created or its session changes.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EditCustomer({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor(); const { id } = await params;
  if (!/^[\w-]{4,60}$/.test(id) || !canManageCustomers(actor.role)) notFound();
  const customer = await getCustomerByHandle(actor.organizationId, id); if (!customer) notFound();
  const [m, locale] = await Promise.all([getMessages(), getLocale()]);

  if (actor.role !== 'admin' && customer.created_by && customer.created_by !== actor.id) {
    return (
      <div className="panel empty">
        <LockKeyhole size={36} />
        <h1>{locale === 'en' ? 'Edit Restricted' : 'صلاحية التعديل مقيدة'}</h1>
        <p>
          {locale === 'en'
            ? `This customer profile was created by ${customer.creator_name || 'another team member'}. Under enterprise compliance rules, profile modifications are limited to the record creator or workspace admin.`
            : `تم تسجيل هذا الملف بواسطة ${customer.creator_name || 'زميل آخر في الفريق'}. وفقاً لسياسات الامتثال، يُسمح بتعديل الملف فقط لمنشئه أو لمدير النظام.`}
        </p>
        <Link className="button secondary" href={`/profiles/${customer.reference}`}>
          {m.backToProfile}
        </Link>
      </div>
    );
  }

  return <><Link href={`/profiles/${customer.reference}`} className="back-link"><ArrowRight size={17}/>{m.backToProfile}</Link>
    <div className="page-heading"><div><div className="eyebrow" dir="ltr">{customer.reference}</div><h1>{m.editTitle}</h1><p>{m.editSub}</p></div></div>
    <CustomerForm customer={customer} countryList={localizedCountries(locale)}/></>;
}
