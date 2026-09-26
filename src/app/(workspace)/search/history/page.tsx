import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  Clock3,
  Filter,
  History,
  RotateCcw,
  Search,
  Trash2,
  UserPlus
} from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { getLocale, getMessages } from '@/lib/i18n';
import { listSearchHistory, countSearchHistory, getSearchHistoryStats } from '@/lib/team';
import { clearMySearchHistoryAction, removeSearchHistoryItemAction } from '@/app/actions';
import { number, DateTimeText, Pagination, parsePage, withQuery } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SearchHistoryPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string; limit?: string; q?: string }>;
}) {
  const actor = await requireActor();
  const [sp, locale, m] = await Promise.all([searchParams, getLocale(), getMessages()]);
  const en = locale === 'en';

  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const allowedLimits = [10, 25, 50];
  const parsedLimit = Number(sp.limit);
  const pageSize = allowedLimits.includes(parsedLimit) ? parsedLimit : 10;

  const [stats, total] = await Promise.all([
    getSearchHistoryStats(actor),
    countSearchHistory(actor, q)
  ]);

  const page = parsePage(sp.page, total, pageSize);
  const offset = (page - 1) * pageSize;
  const rows = await listSearchHistory(actor, { limit: pageSize, offset, filter: q });

  const from = total > 0 ? offset + 1 : 0;
  const to = Math.min(offset + pageSize, total);

  const makePageHref = (next: number) =>
    withQuery('/search/history', {
      q: q || undefined,
      limit: pageSize !== 10 ? String(pageSize) : undefined,
      page: next > 1 ? String(next) : undefined,
    });

  return (
    <>
      {/* 1. Page Heading with Breadcrumb and Actions */}
      <div className="page-heading history-page-heading">
        <div>
          <div className="eyebrow">{en ? 'AML Screening & Due Diligence' : 'فحص القوائم ومكافحة غسل الأموال'}</div>
          <h1>{en ? 'Search History' : 'سجل عمليات البحث'}</h1>
          <p>
            {en
              ? 'Complete audit archive of screening queries with one-click re-verification and client onboarding.'
              : 'سجل شامل لكافة استعلامات الفحص والتحقق مع إمكانية إعادة الفحص أو إنشاء ملف عميل بضغطة واحدة.'}
          </p>
        </div>
        <div className="history-header-actions">
          <Link href="/search" className="button secondary">
            <ArrowRight size={17} className={en ? 'rtl-flip' : ''} />
            {en ? 'Back to Search' : 'العودة إلى شاشة البحث'}
          </Link>
          {stats.totalQueries > 0 && (
            <form action={clearMySearchHistoryAction}>
              <input type="hidden" name="returnTo" value="history" />
              <button
                type="submit"
                className="button danger outline clear-all-btn"
                title={en ? 'Clear all search history' : 'مسح سجل البحث بالكامل'}
              >
                <Trash2 size={15} />
                <span>{en ? 'Clear All' : 'مسح السجل'}</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 2. Top Metric Stats Overview (4 Cards) */}
      <section className="history-summary" aria-label={en ? 'Search Statistics' : 'إحصائيات البحث'}>
        <div className="history-summary-item lead">
          <span className="history-summary-icon emerald">
            <Search size={22} />
          </span>
          <div>
            <strong>{number(stats.totalQueries)}</strong>
            <span>{en ? 'Unique Queries' : 'استعلامات فريدة'}</span>
          </div>
        </div>

        <div className="history-summary-item">
          <span className="history-summary-icon blue">
            <History size={20} />
          </span>
          <div>
            <strong>{number(stats.totalRuns)}</strong>
            <small>{en ? 'Total Executions' : 'إجمالي مرات الفحص'}</small>
          </div>
        </div>

        <div className="history-summary-item">
          <span className="history-summary-icon amber">
            <Clock3 size={20} />
          </span>
          <div>
            <strong>{number(stats.todayRuns)}</strong>
            <small>{en ? "Today's Searches" : 'فحوصات اليوم'}</small>
          </div>
        </div>

        <div className="history-summary-item">
          <span className="history-summary-icon slate">
            <Calendar size={20} />
          </span>
          <div>
            {stats.lastSearchAt ? (
              <span className="history-last-date">
                <DateTimeText value={stats.lastSearchAt} locale={locale} />
              </span>
            ) : (
              <strong>—</strong>
            )}
            <small>{en ? 'Last Search Activity' : 'آخر نشاط استعلام'}</small>
          </div>
        </div>
      </section>

      {/* 3. Main Panel: Filter Bar, Table, and Pagination */}
      <section className="panel history-panel">
        <div className="panel-heading history-panel-heading">
          <div>
            <h2>
              <History size={18} /> {en ? 'Search Log & Activity' : 'سجل ونشاط الاستعلامات'}
            </h2>
            <p>
              {q
                ? en
                  ? `Showing results matching "${q}" (${number(total)} found)`
                  : `عرض النتائج المطابقة لـ «${q}» (${number(total)} استعلام)`
                : en
                ? `${number(total)} recorded queries, ordered by most recent`
                : `${number(total)} استعلام محفوظ، مرتبة من الأحدث إلى الأقدم`}
            </p>
          </div>

          {/* Filter Bar with limit selector */}
          <form method="GET" action="/search/history" className="history-filter-bar">
            <div className="history-search-input-wrap">
              <Search size={16} className="history-search-icon" aria-hidden />
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder={en ? 'Filter history by name or keyword...' : 'ابحث في السجل بالاسم أو الكلمة...'}
                className="history-filter-input"
              />
            </div>

            <div className="history-limit-wrap">
              <span className="history-limit-label">{en ? 'Per page:' : 'العرض:'}</span>
              <select name="limit" defaultValue={String(pageSize)} className="history-limit-select">
                <option value="10">{en ? '10 items' : '10 بالصفحة'}</option>
                <option value="25">{en ? '25 items' : '25 بالصفحة'}</option>
                <option value="50">{en ? '50 items' : '50 بالصفحة'}</option>
              </select>
            </div>

            <button type="submit" className="button primary history-filter-submit">
              <Filter size={14} />
              <span>{en ? 'Filter' : 'تصفية'}</span>
            </button>

            {(q || pageSize !== 10) && (
              <Link href="/search/history" className="button secondary history-filter-reset" title={en ? 'Reset filters' : 'إعادة ضبط الفلتر'}>
                <RotateCcw size={14} />
                <span>{en ? 'Reset' : 'إعادة ضبط'}</span>
              </Link>
            )}

            {total > pageSize && (
              <div className="history-quick-pager" aria-label="Pagination">
                <span className="quick-pager-text">
                  <span dir="ltr">{page} / {Math.ceil(total / pageSize)}</span>
                </span>
                {page > 1 ? (
                  <Link href={makePageHref(page - 1)} className="quick-pager-btn" title={en ? 'Previous page' : 'الصفحة السابقة'}>
                    ‹
                  </Link>
                ) : (
                  <span className="quick-pager-btn is-disabled" aria-hidden>‹</span>
                )}
                {page < Math.ceil(total / pageSize) ? (
                  <Link href={makePageHref(page + 1)} className="quick-pager-btn" title={en ? 'Next page' : 'الصفحة التالية'}>
                    ›
                  </Link>
                ) : (
                  <span className="quick-pager-btn is-disabled" aria-hidden>›</span>
                )}
              </div>
            )}
          </form>
        </div>

        {/* 4. Table or Empty State */}
        {rows.length === 0 ? (
          <div className="empty history-empty">
            <Search size={36} />
            <h3>{q ? (en ? 'No matching searches found' : 'لا توجد نتائج مطابقة لعبارة البحث') : (en ? 'No searches recorded yet' : 'لا يوجد سجل استعلامات بعد')}</h3>
            <p>
              {q
                ? en
                  ? `No search history matches "${q}". Try clearing the filter or checking another keyword.`
                  : `لم يتم العثور على أي استعلام في السجل يحتوي على «${q}». جرّب إفراغ خانة البحث أو كتابة كلمة أخرى.`
                : en
                ? 'Every name or company you verify will automatically be recorded here for instant re-checks and profile creation.'
                : 'كل اسم أو كيان تقوم بفحصه في شاشة الامتثال سيظهر هنا تلقائياً لسرعة الرجوع إليه أو إضافته كعميل.'}
            </p>
            {q ? (
              <Link href="/search/history" className="button secondary">
                <RotateCcw size={15} />
                {en ? 'View all searches' : 'عرض كافة الاستعلامات'}
              </Link>
            ) : (
              <Link href="/search" className="button primary">
                <Search size={16} />
                {en ? 'Start a New Search' : 'بدء فحص جديد الآن'}
              </Link>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table history-table" dir={en ? 'ltr' : 'rtl'}>
              <thead>
                <tr>
                  <th scope="col" className="th-seq">#</th>
                  <th scope="col" className="th-query">{en ? 'Queried Name / Entity' : 'الاسم / الكيان المستعلم عنه'}</th>
                  <th scope="col" className="th-times">{en ? 'Frequency' : 'مرات الفحص'}</th>
                  <th scope="col" className="th-date">{en ? 'Last Verification' : 'تاريخ ووقت آخر فحص'}</th>
                  <th scope="col" className="th-actions">{en ? 'Actions' : 'إجراءات سريعة'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const seq = offset + i + 1;
                  return (
                    <tr key={r.query + i} className="history-row">
                      <td className="td-seq" data-label="#">
                        <span className="seq-badge">{seq}</span>
                      </td>

                      <td className="td-query" data-label={en ? 'Queried Name' : 'الاسم المستعلم عنه'}>
                        <Link
                          className="history-query-link"
                          href={`/search?q=${encodeURIComponent(r.query)}`}
                          title={en ? `Run search for "${r.query}"` : `فحص «${r.query}» الآن`}
                        >
                          <span className="history-query-icon">
                            <Search size={15} />
                          </span>
                          <strong className="history-query-text" dir="auto">{r.query}</strong>
                        </Link>
                      </td>


                      <td className="td-times" data-label={en ? 'Frequency' : 'مرات الفحص'}>
                        <span className="history-frequency-pill">
                          <bdi>{number(r.count)}</bdi>
                          <small>{en ? (r.count === 1 ? 'run' : 'runs') : (r.count === 1 ? 'مرة' : 'مرات')}</small>
                        </span>
                      </td>

                      <td className="td-date" data-label={en ? 'Last Verification' : 'تاريخ ووقت آخر فحص'}>
                        <span className="history-date-wrapper">
                          <DateTimeText value={r.createdAt} locale={locale} />
                        </span>
                      </td>

                      <td className="td-actions" data-label={en ? 'Actions' : 'إجراءات'}>
                        <div className="history-actions-group">
                          {/* 1. Quick Re-screen button */}
                          <Link
                            href={`/search?q=${encodeURIComponent(r.query)}`}
                            className="history-action-btn action-rescreen"
                            title={en ? 'Re-screen this query' : 'إعادة الفحص الآن'}
                          >
                            <Search size={14} />
                            <span>{en ? 'Re-screen' : 'إعادة الفحص'}</span>
                          </Link>

                          {/* 2. Quick Add Customer button */}
                          <Link
                            href={`/profiles/new?name=${encodeURIComponent(r.query)}`}
                            className="history-action-btn action-add-client"
                            title={en ? 'Add as customer profile' : 'إضافة هذا الاسم كعميل'}
                          >
                            <UserPlus size={14} />
                            <span>{en ? 'Add Customer' : 'إضافة كعميل'}</span>
                          </Link>

                          {/* 3. Delete single row button */}
                          <form action={removeSearchHistoryItemAction} className="history-delete-form">
                            <input type="hidden" name="query" value={r.query} />
                            <button
                              type="submit"
                              className="history-action-btn action-delete"
                              title={en ? 'Delete from history' : 'حذف هذا السطر من السجل'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Comprehensive Pagination Component */}
        <div className="history-pagination-wrapper">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            makeHref={makePageHref}
            m={m}
            showAlways={total > 0}
            showNumbers={true}
          />
        </div>
      </section>
    </>
  );
}
