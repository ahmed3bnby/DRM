import Link from 'next/link';
import { AlertTriangle, ArrowUpLeft, ClipboardCheck, Clock3, Search, UserRoundCheck, UsersRound } from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { getMessages, getLocale } from '@/lib/i18n';
import { countReviewCases, getReviewQueueStats, listReviewAssignees, listReviewCases } from '@/lib/review-cases';
import { assignReviewCaseAction } from '@/app/actions';
import { countryName, flag, number, Pagination, parsePage, withQuery } from '@/components/ui';
import { canManageCustomers } from '@/lib/validation';
import { hasFeature } from '@/lib/features';
import FeatureLocked from '@/components/feature-locked';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const dayAge = (date: Date) => Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));

const REVIEW_PAGE_SIZE = 12;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string; priority?: string; owner?: string; assignment?: string; q?: string; sort?: string; page?: string }> }) {
  const actor = await requireActor();
  if (!hasFeature(actor, 'reviews')) return <FeatureLocked feature={(await getMessages()).navReviews}/>;
  const search = await searchParams;
  const status = ['open', 'in_review', 'resolved'].includes(search.status ?? '') ? search.status! : '';
  const priority = ['high', 'medium', 'low'].includes(search.priority ?? '') ? search.priority! : '';
  const defaultOwner = actor.role === 'analyst' ? 'mine' : 'all';
  const effectiveOwner = actor.role === 'admin'
    ? (['mine', 'unassigned', 'all'].includes(search.owner ?? '') ? search.owner! : defaultOwner)
    : actor.role === 'analyst'
      ? (search.owner === 'unassigned' ? 'unassigned' : 'mine')
      : 'all';
  const owner = effectiveOwner === 'mine' ? actor.id : effectiveOwner === 'unassigned' ? 'unassigned' : '';
  const q = typeof search.q === 'string' ? search.q.trim().slice(0, 160) : '';
  const sort = ['priority', 'recent', 'oldest'].includes(search.sort ?? '') ? search.sort! : 'priority';
  const actorId = actor.role === 'analyst' ? actor.id : undefined;
  const filters = { status, priority, assignee: owner, query: q, sort, actorId };
  const [m, locale, stats, assignees, total] = await Promise.all([
    getMessages(),
    getLocale(),
    getReviewQueueStats(actor.organizationId, actorId),
    listReviewAssignees(actor.organizationId),
    countReviewCases(actor.organizationId, filters),
  ]);
  const page = parsePage(search.page, total, REVIEW_PAGE_SIZE);
  const cases = await listReviewCases(actor.organizationId, { ...filters, limit: REVIEW_PAGE_SIZE, offset: (page - 1) * REVIEW_PAGE_SIZE });
  const href = (next: { status?: string; priority?: string; owner?: string; q?: string; sort?: string; page?: string }) => withQuery('/reviews', { status: next.status || undefined, priority: next.priority || undefined, owner: next.owner || undefined, q: next.q || undefined, sort: next.sort && next.sort !== 'priority' ? next.sort : undefined, page: next.page || undefined });
  const returnTo = href({ status, priority, owner: effectiveOwner, q, sort, page: page > 1 ? String(page) : undefined });
  const priorityLabel = (value: string) => value === 'high' ? m.reviewHighLabel : value === 'medium' ? m.reviewMediumLabel : m.reviewLowLabel;
  return <>
    <div className="page-heading review-heading"><div><div className="eyebrow">{m.reviewTag}</div><h1>{m.reviewTitle}</h1><p>{m.reviewSub}</p></div><Link href="/profiles" className="button secondary"><UsersRound size={18}/>{m.navCustomers}</Link></div>
    {search.assignment === 'saved' && <div role="status" className="success-message">{m.reviewAssignmentSaved}</div>}{search.assignment === 'error' && <div role="alert" className="error-message">{m.reviewAssignmentError}</div>}
    <section className="review-summary" aria-label={m.reviewTitle}>
      <div className="review-summary-lead"><span className="review-summary-icon"><ClipboardCheck size={22}/></span><div><strong>{number(stats.open + stats.inReview)}</strong><span>{m.reviewQueue}</span></div></div>
      <div><span className="review-summary-icon amber"><Clock3 size={20}/></span><strong>{number(stats.open)}</strong><small>{m.reviewOpen}</small></div>
      <div><span className="review-summary-icon red"><AlertTriangle size={20}/></span><strong>{number(stats.high)}</strong><small>{m.reviewHigh}</small></div>
      {actor.role === 'admin' && <div><span className="review-summary-icon slate"><UserRoundCheck size={20}/></span><strong>{number(stats.unassigned)}</strong><small>{m.reviewUnassigned}</small></div>}
    </section>
    <section className="panel review-panel">
      <div className="panel-heading review-panel-heading"><div><h2>{m.reviewQueue}</h2><p>{m.reviewQueueSub}</p></div></div>
      <div className="review-filters" aria-label={m.reviewTitle}>
        <form className="review-search" action="/reviews"><input type="hidden" name="status" value={status}/><input type="hidden" name="priority" value={priority}/><input type="hidden" name="owner" value={effectiveOwner}/><label className="review-search-field"><Search size={16} aria-hidden/><span className="sr-only">{m.reviewSearch}</span><input name="q" defaultValue={q} placeholder={m.reviewSearchPlaceholder}/></label><label className="review-sort-field"><span className="sr-only">{m.reviewSort}</span><select name="sort" defaultValue={sort}><option value="priority">{m.reviewSortPriority}</option><option value="oldest">{m.reviewSortOldest}</option><option value="recent">{m.reviewSortRecent}</option></select></label><button className="button primary">{m.apply}</button></form>
        <div className="review-filter-rows">
          <div className="review-filter-group"><span>{m.reviewFilterStatus}</span><Link className={!status ? 'selected' : ''} href={href({ priority, owner: effectiveOwner, q, sort })}>{m.reviewAll}</Link><Link className={status === 'open' ? 'selected' : ''} href={href({ status: 'open', priority, owner: effectiveOwner, q, sort })}>{m.reviewFilterOpen}</Link><Link className={status === 'in_review' ? 'selected' : ''} href={href({ status: 'in_review', priority, owner: effectiveOwner, q, sort })}>{m.reviewFilterInProgress}</Link><Link className={status === 'resolved' ? 'selected' : ''} href={href({ status: 'resolved', priority, owner: effectiveOwner, q, sort })}>{m.reviewFilterResolved}</Link></div>
          <div className="review-filter-group"><span>{m.reviewPriority}</span><Link className={!priority ? 'selected' : ''} href={href({ status, owner: effectiveOwner, q, sort })}>{m.reviewAllPriorities}</Link>{(['high','medium','low'] as const).map(p => <Link key={p} className={priority === p ? `selected ${p}` : p} href={href({ status, priority: p, owner: effectiveOwner, q, sort })}>{priorityLabel(p)}</Link>)}</div>
          {actor.role === 'admin' && <div className="review-filter-group"><span>{m.reviewAssignee}</span><Link className={effectiveOwner === 'mine' ? 'selected' : ''} href={href({ status, priority, owner: 'mine', q, sort })}>{m.reviewFilterMine}</Link><Link className={effectiveOwner === 'unassigned' ? 'selected' : ''} href={href({ status, priority, owner: 'unassigned', q, sort })}>{m.reviewFilterUnassigned}</Link><Link className={effectiveOwner === 'all' ? 'selected' : ''} href={href({ status, priority, owner: 'all', q, sort })}>{m.reviewAll}</Link></div>}
        </div>
      </div>
      {!cases.length ? <div className="review-empty"><ClipboardCheck size={30}/><h3>{m.reviewNone}</h3><p>{m.reviewNoneSub}</p></div> : <div className="review-case-list" dir={locale === 'en' ? 'ltr' : 'rtl'}>{cases.map(item => {
        const age = dayAge(item.created_at); const categories = [...new Set((item.top_matches ?? []).map(match => match.categoryLabel || match.category).filter(Boolean))].slice(0, 3);
        return <article className={`review-case priority-${item.priority}`} key={item.id}>
          <div className="review-case-priority"><span className={`review-priority ${item.priority}`}><AlertTriangle size={15}/>{priorityLabel(item.priority)}</span><small><Clock3 size={14}/>{m.reviewAge} {number(age)} {locale === 'en' ? (age === 1 ? 'day' : 'days') : 'يوم'}</small></div>
          <div className="review-case-customer"><Link href={`/profiles/${item.customer_reference}`} className="review-case-name"><strong dir="auto">{item.customer_name}</strong><ArrowUpLeft size={16}/></Link><span><span className="country-cell"><span className="flag">{flag(item.country) || '🌐'}</span>{countryName(item.country, locale)}</span><i>·</i>{item.entity_type === 'company' ? m.entityCompany : m.entityIndividual}<i>·</i><b dir="ltr">{item.customer_reference}</b></span><div className="review-evidence">{categories.map(category => <span key={category}>{category}</span>)}<small>{number(item.relevant_count)} {m.reviewMatches}</small></div></div>
          <div className="review-case-owner">{item.assigned_name ? <><small>{m.reviewAssignedTo}</small><strong dir="auto">{item.assigned_name}</strong><span className="status neutral"><span className="status-mark"/>{m.reviewInProgress}</span></> : <><small>{m.reviewAssignee}</small><strong>{m.reviewUnassignedLabel}</strong><span className="status amber"><span className="status-mark"/>{m.reviewOpen}</span></>}</div>
          <div className="review-case-actions"><Link href={`/profiles/${item.customer_reference}`} className="text-link">{m.reviewOpenProfile}<ArrowUpLeft size={16}/></Link>{!item.assigned_to && canManageCustomers(actor.role) && <form action={assignReviewCaseAction}><input type="hidden" name="caseId" value={item.id}/><input type="hidden" name="intent" value="claim"/><input type="hidden" name="returnTo" value={returnTo}/><button className="button primary review-claim">{m.reviewTake}</button></form>}{actor.role === 'admin' && <form className="review-assign-form" action={assignReviewCaseAction}><input type="hidden" name="caseId" value={item.id}/><input type="hidden" name="intent" value="assign"/><input type="hidden" name="returnTo" value={returnTo}/><select name="assigneeId" defaultValue={item.assigned_to ?? ''} aria-label={m.reviewAssignee}><option value="">{m.reviewNoAssignee}</option>{assignees.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select><button className="button secondary">{m.reviewAssign}</button></form>}</div>
        </article>;
      })}</div>}
      <Pagination page={page} pageSize={REVIEW_PAGE_SIZE} total={total} makeHref={next => href({ status, priority, owner: effectiveOwner, q, sort, page: next > 1 ? String(next) : undefined })} m={m}/>
    </section>
  </>;
}
