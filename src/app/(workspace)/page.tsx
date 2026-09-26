import Link from 'next/link';
import { Plus, ArrowUpLeft, UsersRound, Building2, FolderClock, ClipboardCheck, CalendarDays, Activity, ArrowLeft, ShieldQuestion } from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { listCustomers, getStats, getActivity } from '@/lib/customers';
import { CustomerTable, number, DateText } from '@/components/ui';
import { canManageCustomers } from '@/lib/validation';
import { getMessages, getLocale } from '@/lib/i18n';
export default async function Dashboard() {
  const actor = await requireActor();
  const actorId = actor.role === 'analyst' ? actor.id : undefined;
  const [stats,customers,activity,m,locale] = await Promise.all([
    getStats(actor.organizationId, actorId),
    listCustomers(actor.organizationId,'','',{limit:5,sort:'recent',actorId}),
    getActivity(actor.organizationId, undefined, actorId),
    getMessages(),
    getLocale()
  ]);
  const metrics = [{title:m.mTotal,value:stats.total,icon:UsersRound,note:m.mTotalNote,tone:'blue'},
    {title:m.mCompanies,value:stats.companies,icon:Building2,note:`${number(stats.individuals)} ${m.mIndividualsNote}`,tone:'navy'},
    {title:m.mAwaiting,value:stats.awaiting,icon:FolderClock,note:m.mAwaitingNote,tone:'amber'},
    {title:m.mScreened,value:stats.screened,icon:ClipboardCheck,note:stats.potential?`${number(stats.potential)} ${m.mScreenedPotential}`:(stats.screened?m.mScreenedClean:m.mScreenedNone),tone:stats.potential?'amber':(stats.screened?'blue':'gray')}];
  return <>
    <div className="page-heading"><div><h1>{m.ovTitle}</h1><p>{m.ovSub}</p></div><div className="heading-actions"><span className="date-label"><CalendarDays size={16}/><DateText value={new Date()} locale={locale}/></span><Link href="/search" className="button primary">{m.startSearch} <ArrowUpLeft size={18}/></Link>{canManageCustomers(actor.role)&&<Link href="/profiles/new" className="button primary"><Plus size={18}/>{m.addCustomer}</Link>}</div></div>
    <div className="metrics">{metrics.map(({title,value,icon:Icon,note,tone})=><section className={`metric ${tone}`} key={title}><Icon size={20} aria-hidden/><div className="metric-body"><span className="metric-title">{title}</span><strong className="metric-value"><bdi>{number(value)}</bdi></strong><p>{note}</p></div></section>)}</div>
    <div className="dashboard-grid"><section className="panel readiness"><div className="panel-heading"><div><h2>{m.readinessTitle}</h2><p>{m.readinessSub}</p></div><span className="small-tag">{m.currentFiles}</span></div>
      <div className="readiness-content"><div className="readiness-total"><strong><bdi>{number(stats.total)}</bdi></strong><span>{m.inPrep}</span></div><div className="readiness-breakdown"><div className="progress-label"><span><i className="legend blue"/>{m.drafts}</span><b><bdi>{number(stats.total-stats.awaiting)}</bdi></b></div><div className="progress-track" role="progressbar" aria-valuenow={stats.total ? Math.round((stats.total-stats.awaiting)/stats.total*100) : 0} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${stats.total?(stats.total-stats.awaiting)/stats.total*100:0}%`}}/></div><div className="progress-label"><span><i className="legend amber"/>{m.awaitingData}</span><b><bdi>{number(stats.awaiting)}</bdi></b></div><div className="progress-track amber" role="progressbar" aria-valuenow={stats.total ? Math.round(stats.awaiting/stats.total*100) : 0} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${stats.total?stats.awaiting/stats.total*100:0}%`}}/></div></div></div>
      <div className="panel-footnote"><ShieldQuestion size={17}/><span>{m.riskFootnote}</span></div></section>
      <section className="next-step"><span className="step-icon"><FolderClock size={25}/></span><span className="small-tag">{m.nextStep}</span><h2>{m.startCompleteTitle}</h2><p>{m.startCompleteBody}</p><Link href="/profiles" className="text-link">{m.browseProfiles} <ArrowLeft size={17}/></Link></section></div>
    <section className="panel customers-panel"><div className="panel-heading"><div><h2>{m.recentTitle}</h2><p>{m.recentSub}</p></div><Link href="/profiles" className="text-link">{m.viewAll} <ArrowUpLeft size={17}/></Link></div><CustomerTable customers={customers} m={m} locale={locale}/></section>
    <div className="bottom-grid"><section className="panel"><div className="panel-heading"><h2><Activity size={18}/> {m.recentActivity}</h2><span className="muted">{actor.role === 'analyst' ? (locale === 'en' ? 'Your activity only' : 'نشاطك الشخصي فقط') : m.yourFirmOnly}</span></div><div className="activity-list">{activity.slice(0,3).map(a=><div className="activity-item" key={a.id}><span className="activity-dot"/><div><p>{a.summary}</p><small><DateText value={a.created_at} locale={locale}/></small></div></div>)}{!activity.length&&<p className="muted">{m.noActivity}</p>}</div></section>
      {actor.role === 'admin' && (
        <section className="coverage-note"><ShieldQuestion size={24}/><div><h3>{m.coverageNoteTitle}</h3><p>{m.coverageNoteBody}</p><Link href="/sources" className="text-link">{m.dataSourcesStatus} <ArrowUpLeft size={16}/></Link></div></section>
      )}</div>
  </>;
}
