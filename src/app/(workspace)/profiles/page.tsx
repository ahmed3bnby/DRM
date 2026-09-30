import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { listCustomers, countCustomers, getStats, CUSTOMER_SORTS } from '@/lib/customers';
import { CustomerTable, number, PAGE_SIZE, Pagination, parsePage, withQuery } from '@/components/ui';
import CustomerRegistryTable from '@/components/customer-registry-table';
import { canManageCustomers } from '@/lib/validation';
import { getMessages, getLocale } from '@/lib/i18n';
import ProfileFilters from '@/components/profile-filters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Profiles({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    page?: string;
    sort?: string;
    status?: string;
    screening?: string;
    deleted?: string;
  }>;
}) {
  const actor = await requireActor();
  const search = await searchParams;
  const q = typeof search.q === 'string' ? search.q : '';
  const type = typeof search.type === 'string' ? search.type : '';
  const sort = typeof search.sort === 'string' && search.sort in CUSTOMER_SORTS ? search.sort : 'recent';
  const status = ['draft', 'awaiting_information'].includes(search.status ?? '') ? search.status! : '';
  const screening = ['not_run', 'no_match', 'screened', 'potential_match'].includes(search.screening ?? '') ? search.screening! : '';
  const actorId = actor.role === 'analyst' ? actor.id : undefined;

  const [stats, m, locale, total] = await Promise.all([
    getStats(actor.organizationId, actorId),
    getMessages(),
    getLocale(),
    countCustomers(actor.organizationId, q, type, { status, screening, actorId }),
  ]);

  const page = parsePage(search.page, total);
  const customers = await listCustomers(actor.organizationId, q, type, {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    sort,
    status,
    screening,
    actorId,
  });

  const keep = {
    q: q || undefined,
    type: type || undefined,
    sort: sort !== 'recent' ? sort : undefined,
    status: status || undefined,
    screening: screening || undefined,
  };

  const href = (next: number) => withQuery('/profiles', { ...keep, page: next > 1 ? String(next) : undefined });
  const typeHref = (t?: string) => withQuery('/profiles', { ...keep, type: t, page: undefined });

  return (
    <>
      {search.deleted === '1' && (
        <div role="status" className="success-message">
          {locale === 'en' ? 'Customer profile deleted successfully.' : 'تم حذف ملف العميل نهائياً بنجاح.'}
        </div>
      )}
      <div className="page-heading profiles-heading">
        <div>
          <div className="eyebrow">{m.registryLabel}</div>
          <div className="profiles-title-row">
            <h1>{m.profilesTitle}</h1>
            <span className="heading-count">{number(stats.total)}</span>
          </div>
          <p>{m.profilesSub}</p>
        </div>
        <div className="heading-actions">
          {canManageCustomers(actor.role) && (
            <Link href="/profiles/new" className="button primary">
              <Plus size={18} />
              {m.addCustomer}
            </Link>
          )}
        </div>
      </div>

      <section className="panel profiles-registry">
        <div className="registry-topline">
          <span>{type === 'company' ? m.tabCompanies : type === 'individual' ? m.tabIndividuals : m.tabAll}</span>
          <small>{number(total)} {m.profilesWord}</small>
        </div>
        <div className="list-tabs">
          <Link className={!type ? 'selected' : ''} href={typeHref()}>
            {m.tabAll} <span>{stats.total}</span>
          </Link>
          <Link className={type === 'company' ? 'selected' : ''} href={typeHref('company')}>
            {m.tabCompanies} <span>{stats.companies}</span>
          </Link>
          <Link className={type === 'individual' ? 'selected' : ''} href={typeHref('individual')}>
            {m.tabIndividuals} <span>{stats.individuals}</span>
          </Link>
        </div>

        <ProfileFilters q={q} type={type} sort={sort} status={status} screening={screening} />
        <CustomerRegistryTable customers={customers} m={m} locale={locale} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} makeHref={href} m={m} />
      </section>
    </>
  );
}
