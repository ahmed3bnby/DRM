import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, LockKeyhole, Trash2 } from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { platformOwnerEmails } from '@/lib/platform-access';
import { getMessages, getLocale } from '@/lib/i18n';
import { getTeamMemberByUsername, listUserActions, listUserSearches } from '@/lib/team';
import { DateTimeText, number, PAGE_SIZE, Pagination, parsePage, withQuery } from '@/components/ui';
import UserControls from '@/components/user-controls';
import { clearUserSearchesAction, deleteUserSearchEventAction } from '@/app/actions';

export const dynamic = 'force-dynamic';

function searchLabel(key: string, customerName: string | null, search: string, screen: string) {
  if (!key) return { kind: search, text: '—' };
  if (key.startsWith('query:')) return { kind: search, text: key.slice('query:'.length) };
  if (key.startsWith('screen:')) return { kind: screen, text: customerName || key.slice('screen:'.length) };
  return { kind: search, text: key };
}

const ACTION_KIND_LABELS: Record<string, { ar: string; en: string }> = {
  'customer.created': { ar: 'إنشاء ملف', en: 'Create Profile' },
  'customer.updated': { ar: 'تعديل ملف', en: 'Update Profile' },
  'customer.screened': { ar: 'فحص أمني', en: 'Screening' },
  'customer.deleted': { ar: 'حذف ملف', en: 'Delete Profile' },
  'match.decided': { ar: 'قرار مطابقة', en: 'Match Decision' },
  'review.assigned': { ar: 'إسناد مراجعة', en: 'Assign Review' },
  'review.resolved': { ar: 'إغلاق مراجعة', en: 'Resolve Review' },
  'user.created': { ar: 'إنشاء حساب', en: 'Create User' },
  'user.updated': { ar: 'تعديل حساب', en: 'Update User' },
  'user.role': { ar: 'تغيير الدور', en: 'Change Role' },
  'user.quota': { ar: 'تعديل الحصة', en: 'Update Quota' },
  'user.access': { ar: 'حالة الحساب', en: 'Account Access' },
  'user.password': { ar: 'إعادة ضبط كلمة السر', en: 'Reset Password' },
  'user.deleted': { ar: 'حذف مستخدم', en: 'Delete User' },
  'user.searches_cleared': { ar: 'مسح السجل', en: 'Clear History' },
  'user.search_deleted': { ar: 'حذف بحث', en: 'Delete Search' },
  'schedule.configured': { ar: 'جدولة السحب', en: 'Schedule' },
};

// Fallback description from the event type, used when a stored summary is missing
// or generic (older events logged a placeholder). Newer events carry full detail.
const ACTION_LABELS: Record<string, { ar: string; en: string }> = {
  'customer.created': { ar: 'أنشأ ملف عميل', en: 'Created a customer profile' },
  'customer.updated': { ar: 'عدّل ملف عميل', en: 'Updated a customer profile' },
  'customer.screened': { ar: 'أجرى فحص عميل', en: 'Ran a customer screening' },
  'customer.deleted': { ar: 'حذف ملف عميل', en: 'Deleted a customer profile' },
  'match.decided': { ar: 'سجّل قرار مطابقة', en: 'Recorded a match decision' },
  'review.assigned': { ar: 'أسند حالة مراجعة', en: 'Assigned a review case' },
  'review.resolved': { ar: 'أغلق حالة مراجعة', en: 'Resolved a review case' },
  'user.created': { ar: 'أنشأ مستخدمًا', en: 'Created a user' },
  'user.updated': { ar: 'عدّل بيانات مستخدم', en: 'Updated a user' },
  'user.role': { ar: 'غيّر دور مستخدم', en: 'Changed a user role' },
  'user.quota': { ar: 'عدّل حصة مستخدم', en: 'Updated a user quota' },
  'user.access': { ar: 'غيّر حالة تفعيل حساب', en: 'Changed account access' },
  'user.password': { ar: 'أعاد ضبط كلمة سر', en: 'Reset a password' },
  'user.deleted': { ar: 'حذف مستخدمًا', en: 'Deleted a user' },
  'user.searches_cleared': { ar: 'مسح سجل بحث مستخدم', en: 'Cleared a user’s search history' },
  'user.search_deleted': { ar: 'حذف عملية بحث', en: 'Deleted a search event' },
};
const describeAction = (action: string, summary: string, en: boolean) =>
  (summary && summary.trim() && summary.trim().toLowerCase() !== 'changed')
    ? summary
    : (ACTION_LABELS[action]?.[en ? 'en' : 'ar'] ?? (en ? 'Activity' : 'إجراء'));

export default async function TeamMemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ use?: string; log?: string }> }) {
  const actor = await requireActor();
  const m = await getMessages();
  const locale = await getLocale();
  if (actor.role !== 'admin') return <div className="panel empty"><LockKeyhole/><h1>{m.viewOnlyTitle}</h1><p>{m.viewOnlyBody}</p></div>;
  const rawParams = await params;
  const id = decodeURIComponent(rawParams.id || '').trim();
  if (!id || id.length > 120) notFound();
  const member = await getTeamMemberByUsername(actor.organizationId, id);
  if (!member) notFound();
  const search = await searchParams;
  const usePage = parsePage(search.use, member.searches);
  const logPage = parsePage(search.log, member.actions);
  const [usage, actions] = await Promise.all([
    listUserSearches(actor.organizationId, member.id, PAGE_SIZE, (usePage - 1) * PAGE_SIZE),
    listUserActions(actor.organizationId, member.id, PAGE_SIZE, (logPage - 1) * PAGE_SIZE),
  ]);
  const isSuperAdmin = !!member.email && platformOwnerEmails().includes(member.email.toLowerCase());
  if (isSuperAdmin) notFound();
  const roleLabel = member.role === 'admin'
    ? m.roleAdminOpt
    : member.role === 'analyst'
    ? m.roleAnalystOpt
    : m.roleViewerOpt;
  const keep = { use: search.use, log: search.log };
  return <>
    <Link href="/team" className="back-link"><ArrowRight size={17}/>{m.teamTitle}</Link>
    <div className="profile-heading">
      <div className="profile-main-meta">
        <span className="avatar lg">{member.display_name?.[0] || 'U'}</span>
        <div className="profile-title-block">
          <div className="eyebrow">{m.teamProfile}</div>
          <h1 dir="auto">{member.display_name}</h1>
          <p dir="ltr">{member.email}</p>
        </div>
      </div>
      <div className="profile-head-actions">
        <span className={`role-badge role-${isSuperAdmin ? 'superadmin' : member.role}`}>{roleLabel}</span>
        <span className={`status ${member.disabled_at ? 'amber' : 'neutral'}`}><span className="status-mark"/>{member.disabled_at ? m.teamDisabled : m.teamActive}</span>
      </div>
    </div>
    <div className="user-metrics">
      <div className="metric"><div className="metric-body"><span className="metric-title">{m.teamSearches}</span><strong className="metric-value">{number(member.searches)}</strong></div></div>
      <div className="metric"><div className="metric-body"><span className="metric-title">{m.teamActionsCount}</span><strong className="metric-value">{number(member.actions)}</strong></div></div>
      <div className="metric"><div className="metric-body"><span className="metric-title">{m.teamCustomersMade}</span><strong className="metric-value">{number(member.customers)}</strong></div></div>
    </div>
    <div className="profile-grid">
      <section className="panel">
        <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>{m.teamUsageTitle}</h2>
            <p>{m.teamUsageSub}</p>
          </div>
          {actor.role === 'admin' && member.searches > 0 && (
            <form action={clearUserSearchesAction}>
              <input type="hidden" name="userId" value={member.id} />
              <input type="hidden" name="username" value={id} />
              <button
                type="submit"
                className="button danger compact-action-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                title={locale === 'en' ? 'Clear all search history for this member' : 'مسح كامل سجل البحث لهذا العضو'}
              >
                <Trash2 size={13} />
                <span>{locale === 'en' ? 'Clear Searches' : 'مسح السجل'}</span>
              </button>
            </form>
          )}
        </div>
        {usage.length === 0 ? <div className="empty"><h3>{m.teamUsageEmpty}</h3></div> : <div className="table-scroll"><table className="data-table">
          <thead>
            <tr>
              <th>{m.teamWhen}</th>
              <th>{m.teamWhat}</th>
              {actor.role === 'admin' && <th style={{ width: '50px', textAlign: 'center' }}>{locale === 'en' ? 'Action' : 'إجراء'}</th>}
            </tr>
          </thead>
          <tbody>{usage.map(row => {
            const item = searchLabel(row.query_key, row.customer_name, m.teamUsageSearch, m.teamUsageScreen);
            return <tr key={row.id}>
              <td data-label={m.teamWhen}><DateTimeText value={row.created_at} locale={locale}/></td>
              <td data-label={m.teamWhat}>
                <div className="team-activity-cell">
                  <span className="status neutral">{item.kind}</span>
                  <span className="team-activity-desc">
                    {row.customer_id ? <Link href={`/profiles/${row.customer_ref || row.customer_id}`} dir="auto">{item.text}</Link> : <span dir="auto">{item.text}</span>}
                    {row.customer_ref && <small dir="ltr"> {row.customer_ref}</small>}
                  </span>
                </div>
              </td>
              {actor.role === 'admin' && (
                <td style={{ textAlign: 'center' }}>
                  <form action={deleteUserSearchEventAction} style={{ display: 'inline' }}>
                    <input type="hidden" name="userId" value={member.id} />
                    <input type="hidden" name="eventId" value={row.id} />
                    <input type="hidden" name="username" value={id} />
                    <button
                      type="submit"
                      className="button icon-btn danger"
                      style={{ padding: '4px', height: '26px', width: '26px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title={locale === 'en' ? 'Delete this search entry' : 'حذف عملية البحث هذه'}
                      aria-label={locale === 'en' ? 'Delete search entry' : 'حذف عملية البحث'}
                    >
                      <Trash2 size={13} />
                    </button>
                  </form>
                </td>
              )}
            </tr>;
          })}</tbody>
        </table></div>}
        <Pagination page={usePage} pageSize={PAGE_SIZE} total={member.searches} m={m} makeHref={p => withQuery(`/team/${id}`, { ...keep, use: p > 1 ? String(p) : undefined })}/>
      </section>
      <aside className="panel">
        <div className="panel-heading"><h2>{m.teamControls}</h2></div>
        <div className="user-controls-wrap">
          <UserControls
            userId={member.id}
            displayName={member.display_name}
            email={member.email}
            role={member.role}
            quota={member.search_quota}
            disabled={!!member.disabled_at}
            isSelf={member.id === actor.id}
          />
        </div>
      </aside>
    </div>
    <section className="panel user-log">
      <div className="panel-heading"><div><h2>{m.teamLogTitle}</h2><p>{m.teamLogSub}</p></div></div>
      {actions.length === 0 ? <div className="empty"><h3>{m.teamLogEmpty}</h3></div> : <div className="table-scroll"><table className="data-table">
        <thead><tr><th>{m.teamWhen}</th><th>{m.teamWhat}</th></tr></thead>
        <tbody>{actions.map(row => <tr key={row.id}>
          <td data-label={m.teamWhen}><DateTimeText value={row.created_at} locale={locale}/></td>
          <td data-label={m.teamWhat}>
            <div className="team-activity-cell">
              <span className="status neutral">
                {ACTION_KIND_LABELS[row.action]?.[locale === 'en' ? 'en' : 'ar'] || (locale === 'en' ? 'Activity' : 'نشاط')}
              </span>
              <span className="team-activity-desc">
                <span dir="auto">{describeAction(row.action, row.summary, locale === 'en')}</span>
                {(row.customer_name || row.customer_ref) && (
                  <span style={{ marginInlineStart: '0.5rem' }}>
                    <Link href={`/profiles/${row.customer_ref || row.customer_id}`} dir="auto" style={{ textDecoration: 'underline', color: 'var(--primary)' }}>
                      {row.customer_name || row.customer_ref}
                    </Link>
                    {row.customer_ref && row.customer_name && <small dir="ltr"> ({row.customer_ref})</small>}
                  </span>
                )}
              </span>
            </div>
          </td>
        </tr>)}</tbody>
      </table></div>}
      <Pagination page={logPage} pageSize={PAGE_SIZE} total={member.actions} m={m} makeHref={p => withQuery(`/team/${id}`, { ...keep, log: p > 1 ? String(p) : undefined })}/>
    </section>
  </>;
}
