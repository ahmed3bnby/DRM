import { Building2, UserRound, ArrowUpLeft, ArrowDown, ArrowUp, ArrowRightLeft, Clock3, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { Customer } from '@/lib/customers';
import type { Locale, Messages } from '@/lib/i18n';
export const number = (value:number)=>new Intl.NumberFormat('en-US').format(value);
// Colour-coded risk level pill with a direction arrow (green ↓ Low · amber ↔ Medium · red ↑ High).
export function RiskPill({band,m}:{band:string;m:Messages}) {
  const cfg = ({high:{cls:'high',label:m.pillHigh},medium:{cls:'medium',label:m.pillMedium},low:{cls:'low',label:m.pillLow},pending:{cls:'pending',label:m.pillPending}} as Record<string,{cls:string;label:string}>)[band] ?? {cls:'low',label:m.pillLow};
  const Icon = band==='pending'?Clock3:band==='high'?ArrowUp:band==='medium'?ArrowRightLeft:ArrowDown;
  return <span className={`risk-pill ${cfg.cls}`}><Icon size={13} aria-hidden/>{cfg.label}</span>;
}
// ISO 3166-1 alpha-2 → emoji flag (🇦🇪…). Returns '' for non-country codes (OTHER, blank).
export const flag = (code:string)=>{const c=(code||'').trim().toUpperCase();if(!/^[A-Z]{2}$/.test(c)||['ZZ','XX','OT'].includes(c))return '';return String.fromCodePoint(...[...c].map(ch=>0x1F1E6+ch.charCodeAt(0)-65));};
export const date = (value:Date|string,locale:Locale='en')=>new Date(value).toLocaleDateString(locale==='en'?'en-GB':'ar-EG',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Dubai'});
export function DateText({value,locale='en'}:{value:Date|string;locale?:Locale}) {
  const d=new Date(value); const iso=Number.isNaN(d.getTime())?undefined:d.toISOString();
  return <time dateTime={iso} dir={locale==='en'?'ltr':'rtl'}><bdi>{date(value,locale)}</bdi></time>;
}
export function DateTimeText({value,locale='en'}:{value:Date|string;locale?:Locale}) {
  const d=new Date(value); const iso=Number.isNaN(d.getTime())?undefined:d.toISOString();
  const text=d.toLocaleString(locale==='en'?'en-GB':'ar-EG',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Dubai'});
  return <time dateTime={iso} dir={locale==='en'?'ltr':'rtl'}><bdi>{text}</bdi></time>;
}
export const PAGE_SIZE = 10;
export function parsePage(raw: unknown, total: number, pageSize = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, pages);
}
export function withQuery(path: string, params: Record<string, string | undefined> = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
function getPageNumbers(current: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  }
  if (current >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', totalPages];
}

export function Pagination({
  page,
  pageSize,
  total,
  makeHref,
  m,
  showAlways = false,
  showNumbers = true,
}: {
  page: number;
  pageSize: number;
  total: number;
  makeHref: (page: number) => string;
  m: Messages;
  showAlways?: boolean;
  showNumbers?: boolean;
}) {
  if (total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pageNumbers = getPageNumbers(page, pages);

  return <div className="table-footer pager">
    <div className="pager-info">
      <span>{m.showing} <span dir="ltr">{number(from)}–{number(to)}</span> {m.pageOf} {number(total)}</span>
    </div>
    {(pages > 1 || showAlways) && <nav className="pager-nav" aria-label={m.pageLabel}>
      {pages > 2 && (
        page > 1 ? <Link className="pager-link pager-fast" href={makeHref(1)} title="الصفحة الأولى" aria-label="First page">«</Link>
                 : <span className="pager-disabled pager-fast" aria-hidden>«</span>
      )}
      {page > 1 ? <Link className="pager-link" href={makeHref(page - 1)}>{m.pagePrev}</Link>
                : <span className="pager-disabled">{m.pagePrev}</span>}
      {showNumbers && pages > 1 && <div className="pager-pages">
        {pageNumbers.map((p, idx) =>
          p === 'ellipsis' ? <span key={`ell-${idx}`} className="pager-ellipsis" aria-hidden>…</span>
                           : <Link key={p} className={`pager-num ${p === page ? 'is-active' : ''}`} href={makeHref(p)} aria-current={p === page ? 'page' : undefined}>{number(p)}</Link>
        )}
      </div>}
      {(!showNumbers || pages <= 1) && <span className="pager-status" dir="ltr">{number(page)} / {number(pages)}</span>}
      {page < pages ? <Link className="pager-link" href={makeHref(page + 1)}>{m.pageNext}</Link>
                    : <span className="pager-disabled">{m.pageNext}</span>}
      {pages > 2 && (
        page < pages ? <Link className="pager-link pager-fast" href={makeHref(pages)} title="الصفحة الأخيرة" aria-label="Last page">»</Link>
                     : <span className="pager-disabled pager-fast" aria-hidden>»</span>
      )}
    </nav>}
  </div>;
}
const regionAr=new Intl.DisplayNames(['ar'],{type:'region'});const regionEn=new Intl.DisplayNames(['en'],{type:'region'});
export const countryName = (code:string,locale:Locale='en')=>{const c=(code||'').toUpperCase();if(!c||c==='OTHER'||c==='OT')return locale==='en'?'Other':'أخرى';if(/^[A-Z]{2}$/.test(c)){try{return (locale==='en'?regionEn:regionAr).of(c)??c;}catch{return c;}}return code;};
export function Status({status,m}:{status:string;m:Messages}) {return <span className={`status ${status==='awaiting_information'?'amber':'neutral'}`}><span className="status-mark"/>{status==='awaiting_information'?m.stAwaiting:m.stDraft}</span>;}
const screeningCls:Record<string,string>={not_run:'not-run',no_match:'neutral',screened:'neutral',potential_match:'amber'};
export function ScreeningTag({status,m}:{status:string;m:Messages}) {const cls=screeningCls[status]??'not-run';const label=({not_run:m.scNotRun,no_match:m.scNoMatch,screened:m.scScreened,potential_match:m.scPotential} as Record<string,string>)[status]??m.scNotRun;return cls==='not-run'?<span className="not-run">{label}</span>:<span className={`status ${cls}`}><span className="status-mark"/>{label}</span>;}
export function EntityIcon({type}:{type:string}) {return <span className={`entity-icon ${type==='company'?'company':'person'}`}>{type==='company'?<Building2 size={19}/>:<UserRound size={19}/>}</span>;}
export function CustomerTable({customers,m,locale}:{customers:Customer[];m:Messages;locale:Locale}) {
  if(!customers.length) return <div className="empty"><UserRound size={32}/><h3>{m.emptyTitle}</h3><p>{m.emptyBody}</p></div>;
  return <>
    <div className="table-scroll desktop-only-table"><table className="data-table customers-table" dir={locale==='en'?'ltr':'rtl'}><thead><tr><th scope="col" className="th-client">{m.thClient}</th><th scope="col" className="th-type">{m.thType}</th><th scope="col" className="th-country">{m.thCountry}</th><th scope="col" className="th-status">{m.thStatus}</th><th scope="col" className="th-screening">{m.thScreening}</th><th scope="col" className="th-open"><span className="sr-only">{m.open}</span></th></tr></thead><tbody>{customers.map(c=><tr key={c.id}>
      <td className="customer-name-cell" data-label={m.thClient}><Link className="customer-cell" href={`/profiles/${c.reference}`}><EntityIcon type={c.entity_type}/><span className="customer-cell-text"><strong dir="auto"><bdi>{c.name}</bdi></strong><small dir="ltr" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><bdi>{c.reference}</bdi>{c.monitoring_enabled && <span title={locale === 'en' ? 'Ongoing Monitoring: Active' : 'المراقبة المستمرة: مفعّلة'} style={{ display: 'inline-flex', alignItems: 'center' }}><ShieldCheck size={12} style={{ color: '#16a34a' }}/></span>}</small></span></Link></td>
      <td className="customer-type-cell" data-label={m.thType}><span className={`entity-type ${c.entity_type==='company'?'company':'individual'}`}>{c.entity_type==='company'?m.entityCompany:m.entityIndividual}</span></td><td className="customer-country-cell" data-label={m.thCountry}><span className="country-cell"><span className="flag" aria-hidden>{flag(c.country)||'🌐'}</span><bdi className="country-name">{countryName(c.country,locale)}</bdi></span></td><td className="customer-status-cell" data-label={m.thStatus}><Status status={c.status} m={m}/></td><td className="customer-screening-cell" data-label={m.thScreening}><ScreeningTag status={c.screening_status} m={m}/></td><td className="row-open-cell"><Link className="row-open" href={`/profiles/${c.reference}`} aria-label={`${m.open} ${c.name}`}><ArrowUpLeft size={18}/></Link></td>
    </tr>)}</tbody></table></div>

    <div className="mobile-customer-cards" aria-label={m.navCustomers}>
      {customers.map(c => (
        <Link key={c.id} className="mobile-customer-card" href={`/profiles/${c.reference}`}>
          <div className="m-card-head">
            <EntityIcon type={c.entity_type}/>
            <div className="m-card-info">
              <strong className="m-card-name" dir="auto"><bdi>{c.name}</bdi></strong>
              <small className="m-card-ref" dir="ltr" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <bdi>{c.reference}</bdi>
                {c.monitoring_enabled && (
                  <span title={locale === 'en' ? 'Ongoing Monitoring: Active' : 'المراقبة المستمرة: مفعّلة'} style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <ShieldCheck size={12} style={{ color: '#16a34a' }}/>
                  </span>
                )}
              </small>
            </div>
            <div className="m-card-screening">
              <ScreeningTag status={c.screening_status} m={m}/>
            </div>
          </div>
          <div className="m-card-meta">
            <span className="m-meta-chip country">
              <span className="flag" aria-hidden>{flag(c.country) || '🌐'}</span>
              <span className="country-name">{countryName(c.country, locale)}</span>
            </span>
            <span className={`m-meta-chip type ${c.entity_type === 'company' ? 'company' : 'individual'}`}>
              {c.entity_type === 'company' ? m.entityCompany : m.entityIndividual}
            </span>
            <span className="m-meta-chip status">
              <Status status={c.status} m={m}/>
            </span>
            <span className="m-card-arrow" aria-hidden="true">
              <ArrowUpLeft size={15}/>
            </span>
          </div>
        </Link>
      ))}
    </div>
  </>;
}
