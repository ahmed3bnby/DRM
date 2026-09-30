import { notFound } from 'next/navigation';
import { requireActor } from '@/lib/auth';
import { isPlatformOwner } from '@/lib/platform-access';
import {
  listAllOrgs,
  getSystemLockdown,
  getPlatformChecksSummary,
  listAllAccountsQuota,
  listQuotaHistory,
} from '@/lib/platform';
import { getLocale, getMessages } from '@/lib/i18n';
import PlatformView from '@/components/platform-view';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    saved?: string;
    lockdown_saved?: string;
    quota_updated?: string;
  }>;
}) {
  const actor = await requireActor();
  if (!isPlatformOwner(actor)) notFound();

  const [sp, locale, orgs, lockdown, checksSummary, accountsQuota, quotaHistory] = await Promise.all([
    searchParams.catch(() => ({} as { tab?: string; saved?: string; lockdown_saved?: string; quota_updated?: string })),
    getLocale().catch(() => 'ar'),
    listAllOrgs().catch(err => {
      console.error('PlatformPage: listAllOrgs error:', err);
      return [];
    }),
    getSystemLockdown().catch(err => {
      console.error('PlatformPage: getSystemLockdown error:', err);
      return { enabled: false };
    }),
    getPlatformChecksSummary().catch(err => {
      console.error('PlatformPage: getPlatformChecksSummary error:', err);
      return {
        totalChecks: 0,
        todayChecks: 0,
        weekChecks: 0,
        activeAccounts: 0,
        totalAllocatedQuota: 0,
        totalAccountsWithQuota: 0,
        unlimitedAccounts: 0,
        totalMonitoredCustomers: 0,
        totalMonitoringAlerts: 0,
      };
    }),
    listAllAccountsQuota().catch(err => {
      console.error('PlatformPage: listAllAccountsQuota error:', err);
      return [];
    }),
    listQuotaHistory(150).catch(err => {
      console.error('PlatformPage: listQuotaHistory error:', err);
      return [];
    }),
  ]);
  await getMessages().catch(() => ({}));

  return (
    <PlatformView
      initialTab={sp.tab}
      locale={locale}
      orgs={orgs}
      lockdown={lockdown}
      summary={checksSummary}
      accounts={accountsQuota}
      history={quotaHistory}
      saved={sp.saved === '1'}
      lockdownSaved={sp.lockdown_saved === '1'}
      quotaUpdated={sp.quota_updated === '1'}
    />
  );
}
