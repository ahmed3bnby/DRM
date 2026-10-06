import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireActor } from '@/lib/auth';
import { hasFeature } from '@/lib/features';
import { getCustomerByHandle } from '@/lib/customers';
import { listSarReportsForCustomer } from '@/lib/goaml';
import { getLocale } from '@/lib/i18n';
import FeatureLocked from '@/components/feature-locked';
import SarFilingView from '@/components/sar-filing-view';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return {
    title: `${(await getLocale()) === 'en' ? 'goAML SAR / STR Filing' : 'إعداد تقرير معاملة مشبوهة (goAML SAR / STR)'} | ABC`,
  };
}

export default async function SarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ type?: string }>;
}) {
  const actor = await requireActor();
  const localeForGate = await getLocale();
  if (!hasFeature(actor, 'goaml_filing')) {
    return <FeatureLocked feature={localeForGate === 'en' ? 'goAML / SAR FIU filing' : 'بلاغات goAML / SAR لوحدة المعلومات المالية'} />;
  }
  const { id } = await params;
  const search = searchParams ? await searchParams : {};
  if (!/^[\w-]{4,60}$/.test(id)) notFound();

  const customer = await getCustomerByHandle(actor.organizationId, id);
  if (!customer) notFound();

  const [reports, locale] = await Promise.all([
    listSarReportsForCustomer(actor.organizationId, customer.id),
    getLocale(),
  ]);

  return (
    <main className="sar-page" style={{ minHeight: '85vh', paddingBottom: '40px' }}>
      <SarFilingView
        customer={customer}
        initialReports={reports}
        initialReportType={search?.type}
        actor={{
          id: actor.id,
          displayName: actor.displayName,
          role: actor.role,
          organizationName: actor.organizationName || 'Financial Institution',
        }}
        locale={locale}
      />
    </main>
  );
}
