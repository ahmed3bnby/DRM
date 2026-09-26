import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { platformOwnerEmails } from '@/lib/platform-access';
import { getMessages, getLocale } from '@/lib/i18n';
import { getTeamMemberByUsername, listUserActions, listUserSearches } from '@/lib/team';
import { DateTimeText, number, PAGE_SIZE, Pagination, parsePage, withQuery } from '@/components/ui';
import UserControls from '@/components/user-controls';

export const dynamic = 'force-dynamic';

function searchLabel(key: string, customerName: string | null, search: string, screen: string) {
  if (!key) return { kind: search, text: '—' };
  if (key.startsWith('query:')) return { kind: search, text: key.slice('query:'.length) };
  if (key.startsWith('screen:')) return { kind: screen, text: customerName || key.slice('screen:'.length) };
  return { kind: search, text: key };
}

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
  const roleLabel = isSuperAdmin
    ? (locale === 'en' ? '👑 Super Admin' : '👑 سوبر أدمن')
    : member.role === 'admin'
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
        <div className="panel-heading"><div><h2>{m.teamUsageTitle}</h2><p>{m.teamUsageSub}</p></div></div>
        {usage.length === 0 ? <div className="empty"><h3>{m.teamUsageEmpty}</h3></div> : <div className="table-scroll"><table className="data-table">
          <thead><tr><th>{m.teamWhen}</th><th>{m.teamWhat}</th></tr></thead>
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
              <span className="team-activity-desc">
                {row.customer_id ? <Link href={`/profiles/${row.customer_ref || row.customer_id}`} dir="auto">{row.summary}</Link> : <span dir="auto">{row.summary}</span>}
              </span>
            </div>
          </td>
        </tr>)}</tbody>
      </table></div>}
      <Pagination page={logPage} pageSize={PAGE_SIZE} total={member.actions} m={m} makeHref={p => withQuery(`/team/${id}`, { ...keep, log: p > 1 ? String(p) : undefined })}/>
    </section>
  </>;
}
