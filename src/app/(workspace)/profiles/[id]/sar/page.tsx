import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireActor } from '@/lib/auth';
import { getCustomerByHandle } from '@/lib/customers';
import { listSarReportsForCustomer } from '@/lib/goaml';
import { getLocale } from '@/lib/i18n';
import SarFilingView from '@/components/sar-filing-view';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return {
    title: 'إعداد تقرير معاملة مشبوهة (goAML SAR / STR) | DRM',
  };
}

export default async function SarPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
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
