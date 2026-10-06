import type { Metadata } from 'next';
import { requireActor } from '@/lib/auth';
import { hasFeature } from '@/lib/features';
import { getLocale } from '@/lib/i18n';
import FeatureLocked from '@/components/feature-locked';
import BulkScreeningClient from '@/components/bulk-screening-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${(await getLocale()) === 'en' ? 'Bulk Screening (Excel)' : 'الفحص الجماعي عبر ملفات الإكسل'} | ABC`
  };
}

export default async function BulkScreeningPage() {
  const actor = await requireActor();
  const locale = await getLocale();

  // Gate feature per plan
  if (!hasFeature(actor, 'bulk_screening')) {
    return (
      <FeatureLocked
        feature={locale === 'en' ? 'Bulk Excel/CSV Screening' : 'الفحص الجماعي عبر ملفات الإكسل'}
      />
    );
  }

  const hasMonitoring = hasFeature(actor, 'ongoing_monitoring');

  return (
    <BulkScreeningClient
      hasMonitoringFeature={hasMonitoring}
      locale={locale}
    />
  );
}
