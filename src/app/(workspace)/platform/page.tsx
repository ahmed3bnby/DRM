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
    searchParams,
    getLocale(),
    listAllOrgs(),
    getSystemLockdown(),
    getPlatformChecksSummary(),
    listAllAccountsQuota(),
    listQuotaHistory(150),
  ]);
  await getMessages();

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
