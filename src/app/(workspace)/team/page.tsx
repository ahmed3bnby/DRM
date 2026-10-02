import Link from 'next/link';
import { ArrowUpLeft, LockKeyhole, Infinity as InfinityIcon, ShieldCheck, UserRound, UsersRound, Search, X } from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { platformOwnerEmails } from '@/lib/platform-access';
import { getMessages, getLocale } from '@/lib/i18n';
import { listTeam } from '@/lib/team';
import { number, PAGE_SIZE, Pagination, parsePage, withQuery } from '@/components/ui';
import TeamCreateModal from '@/components/team-create-modal';
import QuotaForm from '@/components/quota-form';
import { getOrganizationBranding } from '@/lib/branding';
import BrandingSettingsCard from '@/components/branding-settings-card';

export const dynamic = 'force-dynamic';

export default async function TeamPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string; removed?: string; q?: string; role?: string }>;
}) {
  const actor = await requireActor();
  const [m, locale] = await Promise.all([getMessages(), getLocale()]);
  if (actor.role !== 'admin') return <div className="panel empty"><LockKeyhole /><h1>{m.viewOnlyTitle}</h1><p>{m.viewOnlyBody}</p></div>;

  const search = await searchParams;
  const q = typeof search.q === 'string' ? search.q.trim().slice(0, 80) : '';
  const roleFilter = ['admin', 'analyst', 'viewer'].includes(search.role ?? '') ? search.role! : '';

  const [members, branding] = await Promise.all([
    listTeam(actor.organizationId),
    getOrganizationBranding(actor.organizationId),
  ]);

  // Overall counts (independent of current filters)
  const totalAll = members.length;
  const activeCount = members.filter(x => !x.disabled_at).length;
  const disabledCount = members.filter(x => !!x.disabled_at).length;

  const totalAdmins = members.filter(x => x.role === 'admin').length;
  const activeAdmins = members.filter(x => x.role === 'admin' && !x.disabled_at).length;

  const totalAnalysts = members.filter(x => x.role === 'analyst').length;
  const activeAnalysts = members.filter(x => x.role === 'analyst' && !x.disabled_at).length;

  const totalAuditors = members.filter(x => x.role === 'viewer').length;
  const activeAuditors = members.filter(x => x.role === 'viewer' && !x.disabled_at).length;

  // Filtered members
  const filtered = members.filter(u => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (q) {
      const qLower = q.toLowerCase();
      const matchName = u.display_name.toLowerCase().includes(qLower);
      const matchEmail = u.email.toLowerCase().includes(qLower);
      const matchUser = u.username.toLowerCase().includes(qLower);
      if (!matchName && !matchEmail && !matchUser) return false;
    }
    return true;
  });

  const total = filtered.length;
  const page = parsePage(search.page, total);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const ownerEmails = platformOwnerEmails();
  const isOwnerUser = (email?: string) => !!email && ownerEmails.includes(email.toLowerCase().trim());
  const roleLabel = (role: string, email?: string) => {
    if (isOwnerUser(email)) return locale === 'en' ? '👑 Super Admin' : '👑 سوبر أدمن';
    return role === 'admin' ? m.roleAdminOpt : role === 'analyst' ? m.roleAnalystOpt : m.roleViewerOpt;
  };
  const memberHref = (u: { username?: string; email: string; id: string }) => {
    const slug = u.username || u.email.split('@')[0] || u.id;
    return `/team/${encodeURIComponent(slug)}`;
  };
  const others = members.filter(x => x.id !== actor.id);

  const labels = locale === 'en' ? {
    active: activeCount === 1 ? 'active account' : 'active accounts',
    disabled: disabledCount === 1 ? 'disabled account' : 'disabled accounts',
    admins: activeAdmins === 1 ? 'workspace admin' : 'workspace admins',
    analysts: activeAnalysts === 1 ? 'analyst' : 'analysts',
    auditors: activeAuditors === 1 ? 'read-only auditor' : 'read-only auditors',
    overview: 'Team at a glance',
    overviewSub: 'Roles and access are managed here. Open a user to review their activity history.',
    searchPlaceholder: 'Search members by name, username or email…',
    filterAll: 'All roles',
    noResultsTitle: 'No team members match your filter',
    noResultsSub: 'Try clearing the search query or selecting another role.',
  } : {
    active: activeCount === 1 ? 'حساب نشط' : 'حسابات نشطة',
    disabled: disabledCount === 1 ? 'حساب معطّل' : 'حسابات معطّلة',
    admins: activeAdmins === 1 ? 'مدير مساحة العمل' : 'مديرو مساحة العمل',
    analysts: activeAnalysts === 1 ? 'محلل امتثال' : 'محللون',
    auditors: activeAuditors === 1 ? 'مدقق (قراءة فقط)' : 'مدققون للقراءة فقط',
    overview: 'ملخص الفريق',
    overviewSub: 'من هنا تدير الأدوار والصلاحيات. افتح ملف المستخدم لعرض سجل نشاطه.',
    searchPlaceholder: 'ابحث عن عضو بالاسم أو البريد…',
    filterAll: 'كافة الأدوار',
    noResultsTitle: 'لم يتم العثور على أعضاء مطابقين',
    noResultsSub: 'جرب تعديل كلمة البحث أو اختيار دور آخر.',
  };

  const href = (next: { role?: string; q?: string; page?: string }) =>
    withQuery('/team', {
      role: next.role || undefined,
      q: next.q || undefined,
      page: next.page || undefined,
    });

  const memberLimit = actor.memberLimit || 5;
  const remainingSeats = Math.max(0, memberLimit - activeCount);
  const usagePercent = Math.min(100, Math.round((activeCount / memberLimit) * 100));

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{m.teamTag}</div>
          <h1>{m.teamTitle} <span className="heading-count">{number(totalAll)}</span></h1>
          <p>{m.teamSub}</p>
        </div>
        <div className="heading-actions">
          <TeamCreateModal />
        </div>
      </div>

      {search.removed === '1' && <div role="status" className="success-message">{m.teamRemovedNote}</div>}

      {/* Plan Seat Allocation Banner */}
      <section className="team-plan-banner panel stack-gap">
        <div className="team-plan-info">
          <div className="team-plan-icon">
            <UsersRound size={22} />
          </div>
          <div className="team-plan-titles">
            <div className="team-plan-pill-row">
              <span className="team-plan-badge">
                {locale === 'en' ? `Plan: ${(actor.plan || 'enterprise').toUpperCase()}` : `خطة الاشتراك: ${(actor.plan || 'enterprise').toUpperCase()}`}
              </span>
              <span className={`team-plan-status-pill ${remainingSeats === 0 ? 'limit-reached' : ''}`}>
                {remainingSeats > 0
                  ? (locale === 'en' ? `${number(remainingSeats)} seats available` : `${number(remainingSeats)} مقعد شاغر متاح`)
                  : (locale === 'en' ? 'Seat limit reached' : 'تم بلوغ سقف المقاعد بالخطة')}
              </span>
            </div>
            <h2>
              {locale === 'en' ? 'Team Member Seats Allocation' : 'المقاعد المتاحة بالخطة'}
            </h2>
            <p>
              {locale === 'en'
                ? `Active team accounts: ${number(activeCount)} of ${number(memberLimit)} allowed seats.`
                : `الحسابات المفعلة: ${number(activeCount)} من أصل ${number(memberLimit)} مقعد متاح في الخطة الحالية.`}
            </p>
          </div>
        </div>

        <div className="team-plan-stats-side">
          <div className="team-plan-stat-box">
            <span className="team-plan-stat-label">{locale === 'en' ? 'Plan Limit' : 'الحد المتاح بالخطة'}</span>
            <strong className="team-plan-stat-num">{number(memberLimit)}</strong>
            <small>{locale === 'en' ? 'total seats' : 'إجمالي المقاعد'}</small>
          </div>

          <div className="team-plan-stat-box">
            <span className="team-plan-stat-label">{locale === 'en' ? 'Active Members' : 'المستخدمون النشطون'}</span>
            <strong className="team-plan-stat-num text-emerald">{number(activeCount)}</strong>
            <small>{locale === 'en' ? 'active accounts' : 'حساب مستخدم'}</small>
          </div>

          <div className="team-plan-stat-box">
            <span className="team-plan-stat-label">{locale === 'en' ? 'Remaining Seats' : 'المقاعد المتبقية'}</span>
            <strong className="team-plan-stat-num text-blue">{number(remainingSeats)}</strong>
            <small>{locale === 'en' ? 'available to add' : 'متاح إضافتها'}</small>
          </div>

          <div className="team-plan-meter">
            <div className="team-plan-meter-label">
              <span>{locale === 'en' ? 'Seats Used' : 'نسبة الاستهلاك'}</span>
              <strong>{usagePercent}%</strong>
            </div>
            <div className="progress-track" role="progressbar" aria-valuenow={usagePercent} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="team-overview panel">
        <div>
          <div>
            <span className="team-overview-icon blue"><UsersRound size={20} /></span>
            <strong>{number(activeCount)}</strong>
            <small>{labels.active}{disabledCount > 0 ? (locale === 'en' ? ` · ${disabledCount} disabled` : ` · ${disabledCount} معطّل`) : ''}</small>
          </div>
          <div>
            <span className="team-overview-icon navy"><ShieldCheck size={20} /></span>
            <strong>{number(activeAdmins)}</strong>
            <small>{labels.admins}</small>
          </div>
          <div>
            <span className="team-overview-icon green"><UserRound size={20} /></span>
            <strong>{number(activeAnalysts)}</strong>
            <small>{labels.analysts}</small>
          </div>
          <div>
            <span className="team-overview-icon slate"><UserRound size={20} /></span>
            <strong>{number(activeAuditors)}</strong>
            <small>{labels.auditors}</small>
          </div>
        </div>
        <p><strong>{labels.overview}</strong>{labels.overviewSub}</p>
      </section>

      <div className="panel team-registry">
        {/* Toolbar with Search and Role Filters */}
        <div className="team-toolbar">
          <div className="team-filter-pills">
            <Link className={`pill-btn ${!roleFilter ? 'active' : ''}`} href={href({ q })}>
              {labels.filterAll} <span className="pill-count">{number(totalAll)}</span>
            </Link>
            <Link className={`pill-btn ${roleFilter === 'admin' ? 'active' : ''}`} href={href({ role: 'admin', q })}>
              {m.roleAdminOpt} <span className="pill-count">{number(totalAdmins)}</span>
            </Link>
            <Link className={`pill-btn ${roleFilter === 'analyst' ? 'active' : ''}`} href={href({ role: 'analyst', q })}>
              {m.roleAnalystOpt} <span className="pill-count">{number(totalAnalysts)}</span>
            </Link>
            <Link className={`pill-btn ${roleFilter === 'viewer' ? 'active' : ''}`} href={href({ role: 'viewer', q })}>
              {m.roleViewerOpt} <span className="pill-count">{number(totalAuditors)}</span>
            </Link>
          </div>

          <form className="team-search" action="/team">
            <input type="hidden" name="role" value={roleFilter} />
            <Search size={15} aria-hidden />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder={labels.searchPlaceholder}
              aria-label={labels.searchPlaceholder}
            />
            {q && (
              <Link href={href({ role: roleFilter })} className="clear-search" aria-label="Clear">
                <X size={14} />
              </Link>
            )}
          </form>
        </div>

        {/* Desktop Table View */}
        <div className="table-scroll team-table-wrap">
          <table className="data-table team-table" dir={locale === 'en' ? 'ltr' : 'rtl'}>
            <thead>
              <tr>
                <th scope="col" style={{ width: '28%' }}>{m.teamCol}</th>
                <th scope="col" style={{ width: '16%' }}>{m.teamColRole}</th>
                <th scope="col" style={{ width: '26%' }}>{m.teamColUsage}</th>
                <th scope="col" style={{ width: '22%' }}>{m.teamColQuota}</th>
                <th scope="col" style={{ width: '8%', textAlign: 'center' }}>
                  <span className="sr-only">{m.teamOpen}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map(u => {
                const unlimited = u.search_quota == null;
                const periodUsed = Math.max(0, u.used - (u.quota_anchor ?? 0));
                const remaining = unlimited ? null : Math.max(0, u.search_quota! - periodUsed);
                const isSelf = u.id === actor.id;
                const pct = u.search_quota ? Math.min(100, Math.round((periodUsed / u.search_quota) * 100)) : 0;

                return (
                  <tr key={u.id}>
                    <td className="team-user-cell" data-label={m.teamCol}>
                      <Link className="customer-cell" href={memberHref(u)}>
                        <span className={`avatar ${isOwnerUser(u.email) ? 'avatar-superadmin' : u.role === 'admin' ? 'avatar-admin' : ''}`}>{u.display_name[0]}</span>
                        <div>
                          <strong dir="auto">
                            {u.display_name}
                            {isSelf && <span className="you-tag">{m.teamYou}</span>}
                          </strong>
                          <small dir="ltr">{u.email}</small>
                        </div>
                      </Link>
                    </td>

                    <td className="team-role-cell" data-label={m.teamColRole}>
                      <span className="role-cell">
                        <span className={`role-badge role-${isOwnerUser(u.email) ? 'superadmin' : u.role}`}>{roleLabel(u.role, u.email)}</span>
                        {u.disabled_at && (
                          <span className="status amber">
                            <span className="status-mark" />
                            {m.teamDisabled}
                          </span>
                        )}
                      </span>
                    </td>

                    <td className="team-usage-cell" data-label={m.teamColUsage}>
                      {unlimited ? (
                        <span className="usage-unlimited">
                          <InfinityIcon size={15} /> {m.teamUnlimited}
                        </span>
                      ) : (
                        <div className="usage-cell">
                          <div className="usage-line">
                            <span className="usage-stat">
                              <strong className="usage-used">{number(periodUsed)}</strong>
                              <span className="usage-total"> / {number(u.search_quota!)}</span>
                            </span>
                            <span className="usage-remaining-badge">{number(remaining!)} {m.teamRemaining}</span>
                          </div>
                          <div className="progress-track sm" aria-hidden="true">
                            <span
                              className={pct >= 90 ? 'danger' : pct >= 75 ? 'amber' : ''}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="team-quota-cell" data-label={m.teamColQuota}>
                      {u.role === 'admin' || isSelf ? (
                        <span className="muted">{unlimited ? '—' : number(u.search_quota!)}</span>
                      ) : (
                        <QuotaForm userId={u.id} quota={u.search_quota} />
                      )}
                    </td>

                    <td className="row-open-cell" data-label={m.teamOpen} style={{ textAlign: 'center' }}>
                      <Link className="row-open" href={memberHref(u)} aria-label={`${m.teamOpen} ${u.display_name}`}>
                        <ArrowUpLeft size={18} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    {q || roleFilter ? labels.noResultsTitle : m.teamNoOthers}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="team-cards-mobile">
          {paged.map(u => {
            const unlimited = u.search_quota == null;
            const periodUsed = Math.max(0, u.used - (u.quota_anchor ?? 0));
            const remaining = unlimited ? null : Math.max(0, u.search_quota! - periodUsed);
            const isSelf = u.id === actor.id;
            const pct = u.search_quota ? Math.min(100, Math.round((periodUsed / u.search_quota) * 100)) : 0;

            return (
              <article className="team-mobile-card" key={u.id}>
                <div className="team-card-head">
                  <Link className="customer-cell" href={memberHref(u)}>
                    <span className={`avatar ${isOwnerUser(u.email) ? 'avatar-superadmin' : u.role === 'admin' ? 'avatar-admin' : ''}`}>{u.display_name[0]}</span>
                    <span className="customer-cell-text">
                      <strong dir="auto">
                        {u.display_name}
                        {isSelf && <span className="you-tag">{m.teamYou}</span>}
                      </strong>
                      <small dir="ltr">{u.email}</small>
                    </span>
                  </Link>
                  <span className="role-cell">
                    <span className={`role-badge role-${isOwnerUser(u.email) ? 'superadmin' : u.role}`}>{roleLabel(u.role, u.email)}</span>
                    {u.disabled_at && (
                      <span className="status amber">
                        <span className="status-mark" />
                        {m.teamDisabled}
                      </span>
                    )}
                  </span>
                </div>

                <div className="team-card-usage">
                  {unlimited ? (
                    <div className="usage-line">
                      <span className="meta-label">{m.teamColUsage}:</span>
                      <span className="usage-unlimited">
                        <InfinityIcon size={15} /> {m.teamUnlimited}
                      </span>
                    </div>
                  ) : (
                    <div className="usage-cell">
                      <div className="usage-line">
                        <span className="meta-label">{m.teamColUsage}:</span>
                        <span className="usage-stat">
                          <strong className="usage-used">{number(periodUsed)}</strong>
                          <span className="usage-total"> / {number(u.search_quota!)}</span>
                        </span>
                        <span className="usage-remaining-badge">{number(remaining!)} {m.teamRemaining}</span>
                      </div>
                      <div className="progress-track sm" aria-hidden="true">
                        <span
                          className={pct >= 90 ? 'danger' : pct >= 75 ? 'amber' : ''}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="team-card-footer">
                  <div className="team-card-quota">
                    {u.role === 'admin' || isSelf ? (
                      <span className="quota-fixed-badge">
                        {unlimited ? (locale === 'en' ? 'Unlimited access' : 'صلاحية غير محدودة') : `${number(u.search_quota!)} ${locale === 'en' ? 'quota' : 'حصة'}`}
                      </span>
                    ) : (
                      <QuotaForm userId={u.id} quota={u.search_quota} />
                    )}
                  </div>
                  <Link className="button secondary sm team-view-btn" href={memberHref(u)}>
                    {m.teamOpen} <ArrowUpLeft size={15} />
                  </Link>
                </div>
              </article>
            );
          })}

          {paged.length === 0 && (
            <div className="empty team-empty">
              <UsersRound size={32} />
              <h3>{labels.noResultsTitle}</h3>
              <p>{labels.noResultsSub}</p>
            </div>
          )}
        </div>

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          makeHref={p => href({ role: roleFilter, q, page: p > 1 ? String(p) : undefined })}
          m={m}
        />
      </div>

      <BrandingSettingsCard
        initialBranding={branding}
        organizationName={actor.organizationName}
        locale={locale}
      />
    </>
  );
}
