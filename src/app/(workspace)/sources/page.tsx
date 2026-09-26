import Link from 'next/link';
import {
  Database,
  Info,
  Globe,
  LockKeyhole,
  ListChecks,
  CircleCheckBig,
  Layers3,
  ShieldAlert,
  Search,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { redirect } from 'next/navigation';
import { requireActor } from '@/lib/auth';
import {
  sourceCatalog,
  watchlistCodes,
  sourceChanges,
  importHistory,
  sourceSyncStatus,
} from '@/lib/sources';
import { searchCoverage } from '@/lib/search';
import { requestedSources, coverageStatus } from '@/lib/source-catalog';
import {
  number,
  DateText,
  flag,
  PAGE_SIZE,
  Pagination,
  parsePage,
  withQuery,
} from '@/components/ui';
import { getMessages, getLocale } from '@/lib/i18n';
import { syncRuns } from '@/lib/operations';
import { getScheduleConfig } from '@/lib/schedule-config';
import SourceSyncButton from '@/components/source-sync-button';
import {
  getSourceCategory,
  isSourceAllowed,
  getCategoryLabel,
  type SourceCategory,
} from '@/lib/source-categories';
import { hasFeature } from '@/lib/features';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Sources({
  searchParams,
}: {
  searchParams: Promise<{ req?: string; lists?: string; cat?: string; q?: string }>;
}) {
  const actor = await requireActor();
  if (actor.role !== 'admin') redirect('/');
  const search = await searchParams;

  const [catalog, watch, changes, history, activeVersions, syncStatus, runs, scheduleConfig, m, locale] =
    await Promise.all([
      sourceCatalog(),
      watchlistCodes(),
      sourceChanges(),
      importHistory(),
      searchCoverage(),
      sourceSyncStatus(),
      syncRuns(),
      getScheduleConfig(),
      getMessages(),
      getLocale(),
    ]);

  const active = new Set(activeVersions.map((v) => v.code));
  const byCode = new Map((catalog?.sources ?? []).map((s) => [s.code, s]));
  const allTracked = watch
    .map((code) => {
      const category = getSourceCategory(code);
      const allowed = isSourceAllowed(code, actor);
      const catMeta = getCategoryLabel(category, locale);
      return {
        code,
        meta: byCode.get(code),
        imported: history[code],
        category,
        allowed,
        catMeta,
      };
    })
    .filter((t) => t.meta);

  // STRICT PLAN FILTER: Only show sources allowed by the tenant's plan!
  const planTracked = allTracked.filter((t) => t.allowed);

  const hasCore = planTracked.some((x) => x.category === 'core');
  const hasRegional = planTracked.some((x) => x.category === 'regional');
  const hasEnforcement = planTracked.some((x) => x.category === 'enforcement');
  const hasPep = planTracked.some((x) => x.category === 'pep');

  // Filters
  let selectedCat = (search.cat || 'all') as 'all' | SourceCategory;
  if (selectedCat === 'regional' && !hasRegional) selectedCat = 'all';
  if (selectedCat === 'enforcement' && !hasEnforcement) selectedCat = 'all';
  if (selectedCat === 'pep' && !hasPep) selectedCat = 'all';

  const q = (search.q || '').trim().toLowerCase();

  const filteredTracked = planTracked.filter((item) => {
    if (selectedCat !== 'all' && item.category !== selectedCat) return false;
    if (q) {
      const matchTitle = item.meta?.title.toLowerCase().includes(q);
      const matchCode = item.code.toLowerCase().includes(q);
      if (!matchTitle && !matchCode) return false;
    }
    return true;
  });

  const updatedUpstream = changes?.updatedLists?.length ?? 0;

  // Searchable records STRICTLY for the plan's allowed sources
  const allowedCodeSet = new Set(planTracked.map((t) => t.code));
  const planSearchableRecords = activeVersions
    .filter((v) => allowedCodeSet.has(v.code))
    .reduce((total, version) => total + version.record_count, 0);

  const planActiveCount = planTracked.filter((t) => active.has(t.code)).length;

  const latestRun = runs[0];
  const isRunning = runs.some((r) => r.status === 'running');
  const lastSyncIso = latestRun?.finishedAt || latestRun?.startedAt || catalog?.retrievedAt || null;
  const nextScheduledDate = scheduleConfig?.nextRunEstimated || null;
  const scheduleEnabled = scheduleConfig?.enabled !== false;

  const covLabel = (c: string) =>
    ({ direct: m.covStDirect, notLinked: m.covStNotLinked, partial: m.covStPartial, inScope: m.covStInScope } as Record<string, string>)[c] ?? c;

  const reqTotal = requestedSources.length;
  const reqPage = parsePage(search.req, reqTotal);
  const reqRows = requestedSources.slice((reqPage - 1) * PAGE_SIZE, reqPage * PAGE_SIZE);

  const listsTotal = filteredTracked.length;
  const listsPage = parsePage(search.lists, listsTotal);
  const listRows = filteredTracked.slice((listsPage - 1) * PAGE_SIZE, listsPage * PAGE_SIZE);

  const sourcesHref = (params: { req?: number; lists?: number; cat?: string; q?: string }) =>
    withQuery('/sources', {
      req: (params.req ?? reqPage) > 1 ? String(params.req ?? reqPage) : undefined,
      lists: (params.lists ?? 1) > 1 ? String(params.lists ?? 1) : undefined,
      cat: params.cat !== undefined ? (params.cat === 'all' ? undefined : params.cat) : (selectedCat === 'all' ? undefined : selectedCat),
      q: params.q !== undefined ? (params.q ? params.q : undefined) : (q ? q : undefined),
    });

  // Feature checks for visual cards
  const regionalOn = hasFeature(actor, 'regional_sources');
  const enforcementOn = hasFeature(actor, 'enforcement_debarment');
  const pepOn = hasFeature(actor, 'pep_screening');
  const companyOn = hasFeature(actor, 'company_search');
  const adverseOn = hasFeature(actor, 'adverse_media');

  const covLive = [
    {
      ar: 'العقوبات وقوائم الحظر (الأساسي)',
      en: 'Core Sanctions & Watchlists',
      ar2: 'OFAC · UN · EU · UK · SECO · DFAT · نيوزيلندا · كندا · اليابان',
      en2: 'OFAC · UN · EU · UK · SECO · DFAT · Canada · Japan',
      active: true,
      badge: locale === 'en' ? 'Core: Active' : 'مفعّل (أساسي)',
    },
    {
      ar: 'قوائم دولة الإمارات (الأساسي)',
      en: 'UAE Official Lists',
      ar2: 'قائمة الإرهاب المحلية + الأشخاص المحظورون لدى DFSA',
      en2: 'Local Terrorist List + DFSA Prohibited Registry',
      active: true,
      badge: locale === 'en' ? 'Core: Active' : 'مفعّل (أساسي)',
    },
    {
      ar: 'قوائم الشرق الأوسط والعالم العربي',
      en: 'Regional & Arab Watchlists',
      ar2: 'السعودية (أمن الدولة) · مصر (الإرهاب والنواب) · قطر · البحرين · عُمان · باكستان',
      en2: 'Saudi Arabia · Egypt · Qatar · Bahrain · Oman · Pakistan',
      active: regionalOn,
      badge: locale === 'en' ? 'Active in Plan' : 'مفعّل بالخطة',
    },
    {
      ar: 'الحظر والإنفاذ التنظيمي ومكافحة الجرائم',
      en: 'Debarment & International Enforcement',
      ar2: 'البنك الدولي · الإنتربول · اليوروبول · IADB · EBRD · AfDB · BIS · FBI',
      en2: 'World Bank · Interpol · Europol · IADB · EBRD · AfDB · FBI',
      active: enforcementOn,
      badge: locale === 'en' ? 'Active in Plan' : 'مفعّل بالخطة',
    },
    {
      ar: 'الأشخاص السياسيون البارزون (PEP)',
      en: 'Politically Exposed Persons (PEP)',
      ar2: 'قادة العالم ورؤساء الدول (CIA) · البرلمان الأوروبي · سياسيو العالم',
      en2: 'World Leaders (CIA) · European Parliament · Global Politicians',
      active: pepOn,
      badge: locale === 'en' ? 'Active in Plan' : 'مفعّل بالخطة',
    },
    {
      ar: 'بيانات الشركات والملكية (GLEIF)',
      en: 'Corporate Search (GLEIF)',
      ar2: 'استعلام مباشر عن الكيانات العالمية ومُعرّفات LEI',
      en2: 'Direct LEI query and legal corporate entity lookup',
      active: companyOn,
      badge: locale === 'en' ? 'Active in Plan' : 'مفعّل بالخطة',
    },
  ];

  const activeCovCards = covLive.filter((item) => item.active);

  const labels =
    locale === 'en'
      ? {
          liveSources: 'Approved Plan Watchlists',
          searchable: 'Plan Searchable Records',
          coverage: 'Screening Scope',
          tracked: 'Tracked Lists',
          attention: 'Needs review',
          attentionNone: 'Up to date',
          guide: 'Active Compliance Coverage & Scope',
          guideSub: 'Official watchlists, international sanctions, and regulatory registers currently active under your firm’s plan.',
          details: 'Extended coverage & optional sources',
          requested: 'Requested-source coverage and gaps',
          requestedSub: 'A transparent map of sources and coverage scopes.',
          filterAll: 'All Active Lists',
          filterCore: 'Core & UAE',
          filterRegional: 'Regional & Arab',
          filterEnforcement: 'Enforcement',
          filterPep: 'PEP',
          searchListsPh: 'Search sources by name or code…',
        }
      : {
          liveSources: 'قوائم فحص معتمدة بالخطة',
          searchable: 'سجل قابل للبحث بالخطة',
          coverage: 'تغطية الفحص المعتمدة',
          tracked: 'قوائم تحت المتابعة',
          attention: 'يحتاج مراجعة',
          attentionNone: 'محدّث بالكامل',
          guide: 'ما الذي تشمله مصادر الفحص المعتمدة بخطتك؟',
          guideSub: 'القوائم الرسمية وسجلات العقوبات المعتمدة والمفعّلة بالكامل للاستعلام والتدقيق وفق باقة المنشأة الحالية.',
          details: 'تفاصيل التغطية والمصادر الإضافية',
          requested: 'تغطية المصادر المطلوبة والفجوات',
          requestedSub: 'خريطة واضحة للمصادر ونطاق تغطيتها المباشرة.',
          filterAll: 'كافة القوائم المتاحة',
          filterCore: 'الأساسي: العقوبات والإمارات',
          filterRegional: 'القوائم الإقليمية والعربية',
          filterEnforcement: 'الإنفاذ الدولي وحظر التعاقد',
          filterPep: 'الشخصيات السياسية (PEP)',
          searchListsPh: 'ابحث عن قائمة بالاسم أو الرمز…',
        };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{m.srcPageEyebrow}</div>
          <h1>{m.srcPageTitle}</h1>
          <p>{m.srcPageSub}</p>
        </div>
        <span className="small-tag">{m.srcPageTag}</span>
      </div>

      <section className="source-overview panel stack-gap">
        <div className="source-overview-intro">
          <div>
            <span className="cov-badge live">
              <CircleCheckBig size={13} />
              {m.covLiveBadge}
            </span>
            <h2>{labels.guide}</h2>
            <p>{labels.guideSub}</p>
          </div>

          {/* Interactive Source Sync Button with Automatic Sync Countdown */}
          <SourceSyncButton
            lastSyncDate={lastSyncIso}
            isRunning={isRunning}
            locale={locale}
            isAdmin={actor.role === 'admin'}
            nextScheduledDate={nextScheduledDate}
            scheduleEnabled={scheduleEnabled}
          />
        </div>

        <div className="source-metrics">
          <div>
            <span className="source-metric-icon blue">
              <Database size={19} />
            </span>
            <strong>
              <bdi>{number(planSearchableRecords)}</bdi>
            </strong>
            <small>{labels.searchable}</small>
          </div>
          <div>
            <span className="source-metric-icon green">
              <ListChecks size={19} />
            </span>
            <strong>
              <bdi>{number(planActiveCount)}</bdi>
            </strong>
            <small>{labels.liveSources}</small>
          </div>
          <div>
            <span className="source-metric-icon slate">
              <ShieldCheck size={19} />
            </span>
            <strong>
              <bdi>100%</bdi>
            </strong>
            <small>{labels.coverage}</small>
          </div>
          <div>
            <span className={`source-metric-icon ${updatedUpstream ? 'amber' : 'green'}`}>
              <ShieldAlert size={19} />
            </span>
            <strong>
              <bdi>{updatedUpstream ? number(updatedUpstream) : (locale === 'en' ? 'Active' : 'محدث بالكامل')}</bdi>
            </strong>
            <small>{updatedUpstream ? labels.attention : labels.attentionNone}</small>
          </div>
        </div>

        {/* Categorized Coverage Scope Cards - ONLY ACTIVE PLAN CARDS */}
        <div className="source-scope-grid">
          {activeCovCards.map((item) => (
            <div
              key={item.en}
              className="source-scope-card active"
            >
              <div className="source-scope-card-top">
                <span className="cov-badge live">
                  {item.badge}
                </span>
              </div>
              <strong dir="auto">{locale === 'en' ? item.en : item.ar}</strong>
              <small dir="auto">{locale === 'en' ? item.en2 : item.ar2}</small>
            </div>
          ))}
        </div>
      </section>

      {/* Public Lists Table with Category Tabs & Search */}
      {catalog && (
        <section className="panel stack-gap source-lists-panel">
          <div className="panel-heading">
            <div>
              <h2>
                <Database size={18} /> {m.publicListsTitle}
              </h2>
              <p>{m.publicListsSub}</p>
            </div>
            <span className="small-tag">{m.covLiveBadge}</span>
          </div>

          {/* Category Filter Toolbar */}
          <div className="sources-toolbar">
            <div className="team-filter-pills">
              <Link
                className={`pill-btn ${selectedCat === 'all' ? 'active' : ''}`}
                href={sourcesHref({ cat: 'all', lists: 1 })}
              >
                {labels.filterAll} <span className="pill-count">{number(planTracked.length)}</span>
              </Link>
              {hasCore && (
                <Link
                  className={`pill-btn ${selectedCat === 'core' ? 'active' : ''}`}
                  href={sourcesHref({ cat: 'core', lists: 1 })}
                >
                  {labels.filterCore}{' '}
                  <span className="pill-count">
                    {number(planTracked.filter((x) => x.category === 'core').length)}
                  </span>
                </Link>
              )}
              {hasRegional && (
                <Link
                  className={`pill-btn ${selectedCat === 'regional' ? 'active' : ''}`}
                  href={sourcesHref({ cat: 'regional', lists: 1 })}
                >
                  {labels.filterRegional}{' '}
                  <span className="pill-count">
                    {number(planTracked.filter((x) => x.category === 'regional').length)}
                  </span>
                </Link>
              )}
              {hasEnforcement && (
                <Link
                  className={`pill-btn ${selectedCat === 'enforcement' ? 'active' : ''}`}
                  href={sourcesHref({ cat: 'enforcement', lists: 1 })}
                >
                  {labels.filterEnforcement}{' '}
                  <span className="pill-count">
                    {number(planTracked.filter((x) => x.category === 'enforcement').length)}
                  </span>
                </Link>
              )}
              {hasPep && (
                <Link
                  className={`pill-btn ${selectedCat === 'pep' ? 'active' : ''}`}
                  href={sourcesHref({ cat: 'pep', lists: 1 })}
                >
                  {labels.filterPep}{' '}
                  <span className="pill-count">
                    {number(planTracked.filter((x) => x.category === 'pep').length)}
                  </span>
                </Link>
              )}
            </div>

            <form method="get" action="/sources" className="sources-search-form">
              {selectedCat !== 'all' && <input type="hidden" name="cat" value={selectedCat} />}
              <div className="search-field">
                <Search size={15} />
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  placeholder={labels.searchListsPh}
                  className="sources-search-input"
                />
              </div>
            </form>
          </div>

          <div className="table-scroll">
            <table className="data-table sources-table">
              <thead>
                <tr>
                  <th className="th-src-list">{m.thList}</th>
                  <th className="th-src-country">{m.thCountryCol}</th>
                  <th>{locale === 'en' ? 'Category / Tier' : 'الفئة / الباقة'}</th>
                  <th className="th-src-records">{m.thSearchable}</th>
                  <th className="th-src-version">{m.thSourceVersion}</th>
                  <th className="th-src-change">{m.thUpstreamChange}</th>
                  <th className="th-src-import">{m.thLastImport}</th>
                  <th className="th-src-status">{m.thStatusCol}</th>
                </tr>
              </thead>
              <tbody>
                {listRows.map(({ code, meta, imported, allowed, catMeta }) => {
                  const changed =
                    imported &&
                    meta?.version &&
                    imported.upstream_version &&
                    imported.upstream_version !== meta.version;

                  return (
                    <tr key={code} className={!allowed ? 'source-row-locked' : ''}>
                      <td data-label={m.thList} className="src-list-cell">
                        <strong className="list-title" dir="auto">
                          <bdi>{meta!.title}</bdi>
                        </strong>
                        <small dir="ltr" className="cell-code">
                          <bdi>{code}</bdi>
                        </small>
                      </td>

                      <td data-label={m.thCountryCol} className="src-country-cell">
                        <span className="flag" aria-hidden>
                          {flag(meta!.country ?? '') || '🌐'}
                        </span>
                      </td>

                      <td data-label={locale === 'en' ? 'Category' : 'الفئة'}>
                        <span
                          className={`source-tier-pill ${catMeta.short.toLowerCase()}`}
                          title={catMeta.label}
                        >
                          {catMeta.short}
                        </span>
                      </td>

                      <td data-label={m.thSearchable} className="src-records-cell">
                        <bdi>
                          {number(
                            activeVersions.find((v) => v.code === code)?.record_count ?? 0
                          )}
                        </bdi>
                      </td>

                      <td data-label={m.thSourceVersion} className="src-version-cell ver-muted">
                        <bdi dir="ltr">{meta!.version ?? '—'}</bdi>
                      </td>

                      <td data-label={m.thUpstreamChange} className="src-change-cell">
                        {meta!.lastChange ? (
                          <DateText value={meta!.lastChange} locale={locale} />
                        ) : (
                          '—'
                        )}
                      </td>

                      <td data-label={m.thLastImport} className="src-import-cell">
                        {imported ? (
                          <span>
                            <bdi>
                              <DateText value={imported.imported_at} locale={locale} />
                            </bdi>{' '}
                            <small dir="ltr" className="change-count">
                              <bdi dir="ltr">
                                (+{number(imported.added)} / -{number(imported.removed)})
                              </bdi>
                            </small>
                          </span>
                        ) : (
                          <span className="not-run">{m.notImportedYet}</span>
                        )}
                      </td>

                      <td data-label={m.thStatusCol} className="src-status-cell">
                        {!allowed ? (
                          <span
                            className="status amber plan-locked"
                            title={locale === 'en' ? 'Locked: enable package in Platform Super-Admin' : 'مقفول: يفعّل من السوبر أدمن في إدارة المنصة'}
                          >
                            <LockKeyhole size={11} />
                            <span>{locale === 'en' ? 'Locked by Plan' : 'مقفول بالخطة'}</span>
                          </span>
                        ) : syncStatus[code]?.status === 'failed' ? (
                          <span className="status amber">
                            {m.syncFailed}
                            {active.has(code) ? m.prevAvailable : ''}
                          </span>
                        ) : !active.has(code) ? (
                          <span className="status neutral">
                            <span className="status-mark" />
                            {m.awaitingImport}
                          </span>
                        ) : changed ? (
                          <span className="status amber">
                            <span className="status-mark" />
                            {m.updateAvailable}
                          </span>
                        ) : (
                          <span className="status neutral">
                            <span className="status-mark" />
                            {m.upToDate}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={listsPage}
            pageSize={PAGE_SIZE}
            total={listsTotal}
            makeHref={(p) => sourcesHref({ lists: p })}
            m={m}
          />
          <div className="panel-footnote">
            <Info size={15} />
            <span>{m.srcTableFootnote}</span>
          </div>
        </section>
      )}

      {/* Requested Sources Gaps */}
      <details className="panel stack-gap source-requested-details">
        <summary>
          <span>
            <strong>{labels.requested}</strong>
            <small>{labels.requestedSub}</small>
          </span>
          <span className="small-tag">
            <bdi>{number(reqTotal)}</bdi>
          </span>
        </summary>
        <div className="source-requested-body">
          <div className="table-scroll">
            <table className="data-table req-table">
              <thead>
                <tr>
                  <th>{m.thSource}</th>
                  <th>{m.thLinkStatus}</th>
                  <th>{m.thScopeRemaining}</th>
                </tr>
              </thead>
              <tbody>
                {reqRows.map((source) => (
                  <tr key={source.name}>
                    <td data-label={m.thSource}>
                      <span dir="auto">{locale === 'en' ? source.name_en : source.name}</span>
                    </td>
                    <td data-label={m.thLinkStatus}>
                      <span className="status neutral">
                        {covLabel(coverageStatus(source, active))}
                      </span>
                    </td>
                    <td data-label={m.thScopeRemaining}>
                      <span dir="auto">{locale === 'en' ? source.note_en : source.note}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={reqPage}
            pageSize={PAGE_SIZE}
            total={reqTotal}
            makeHref={(p) => sourcesHref({ req: p })}
            m={m}
          />
          <div className="panel-footnote">
            <Info size={15} />
            <span>
              {m.srcFootnote1}{' '}
              <a
                href="https://www.opensanctions.org/licensing/"
                target="_blank"
                rel="noopener noreferrer"
              >
                {m.providerTerms}
              </a>
            </span>
          </div>
        </div>
      </details>

      {adverseOn && (
        <section className="panel licensed-source">
          <span className="entity-icon" style={{ background: '#ecfdf5', color: '#047857' }}>
            <Globe size={22} />
          </span>
          <div>
            <h2>{m.adverseTitle}</h2>
            <p>{m.adverseBody}</p>
          </div>
          <span className="status green">
            <span className="status-mark" />
            {locale === 'en' ? 'Active in Plan' : 'مفعّل بالخطة'}
          </span>
        </section>
      )}
    </>
  );
}
