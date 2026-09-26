import Link from 'next/link';
import {gleifSearch} from '@/lib/gleif';
import {adverseMediaSearch} from '@/lib/adverse-media';
import {Search,ArrowUpLeft,Info,Newspaper,ExternalLink,History,Trash2,UserPlus,UserCheck} from 'lucide-react';
import {requireActor} from '@/lib/auth';
import {findMatchingExistingCustomer} from '@/lib/customers';
import {searchCoverage,searchPublicSources} from '@/lib/search';
import {consumeSearch,quotaStatus,getRecentSearches} from '@/lib/team';
import {clearMySearchHistoryAction} from '@/app/actions';
import {canManageCustomers} from '@/lib/validation';
import {loadCategories,classifyMatch,assess,categoryOf} from '@/lib/risk';
import {number,flag,DateText} from '@/components/ui';
import {getMessages,getLocale} from '@/lib/i18n';
import {normalizeName} from '@/lib/name-normalization';
import {Lock} from 'lucide-react';
import SearchForm from '@/components/search-form';
import RecentSearchChips from '@/components/recent-search-chips';
import {hasFeature} from '@/lib/features';
import {isSourceAllowed} from '@/lib/source-categories';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
const RANK:Record<string,number>={high:3,medium:2,low:1};
const LEGACY_TITLE:Record<string,string>={UN:'UN — Security Council',UK:'United Kingdom — Sanctions',OFAC:'OFAC — SDN'};
export default async function SearchPage({searchParams}:{searchParams:Promise<{q?:string}>}){
 const actor=await requireActor();const params=await searchParams;const q=typeof params.q==='string'?params.q.trim():'';
 const queryKey = 'query:' + (normalizeName(q) || q.toLowerCase());
 const quota=q.length>=3?await consumeSearch(actor, queryKey, q):await quotaStatus(actor);
 const [m,locale,recentSearches]=await Promise.all([getMessages(),getLocale(),getRecentSearches(actor)]);
 if(q.length>=3&&!quota.allowed) return <><div className="page-heading"><div><div className="eyebrow">{m.srchEyebrow}</div><h1>{m.srchTitle}</h1><p>{m.srchLead}</p></div><span className="small-tag">{m.srchTag}</span></div>
  <div className="panel empty"><Lock size={30}/><h2>{m.quotaBlockedTitle}</h2><p>{m.quotaBlockedBody}</p></div></>;
 const withFallback = <T,>(p: Promise<T>, fallback: T, ms = 2000): Promise<T> =>
   Promise.race([p, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);

 const [rawCoverage, rawResults, catMap, existingCustomer] = await Promise.all([
   searchCoverage(),
   q.length >= 3 ? searchPublicSources(q) : Promise.resolve([]),
   loadCategories(),
   q.length >= 2 ? findMatchingExistingCustomer(actor.organizationId, q) : Promise.resolve(null),
 ]);

 const coverage = rawCoverage.filter(c => isSourceAllowed(c.code, actor));
 const results = rawResults.filter(r => isSourceAllowed(r.code, actor));

 const canCompany = hasFeature(actor, 'company_search');
 const canAdverse = hasFeature(actor, 'adverse_media');
  const emptyCompany: Awaited<ReturnType<typeof gleifSearch>> = { status: 'not_searched', records: [] };
  const [companies, adverse] = q.length >= 3
   ? await Promise.all([
       canCompany ? withFallback(gleifSearch(q), { status: 'failed' as const, records: [] }) : Promise.resolve(emptyCompany),
       canAdverse ? withFallback(adverseMediaSearch(q), { status: 'failed' as const, articles: [] }) : Promise.resolve({ status: 'not_searched' as const, articles: [] })
     ])
   : [
       emptyCompany,
       { status: 'not_searched' as const, articles: [] }
     ];
 const advCatLabel=(c:string)=>({sanctions:m.catSanctions,laundering:locale==='en'?'Money laundering':'غسل أموال',fraud:locale==='en'?'Fraud':'احتيال',corruption:locale==='en'?'Bribery / corruption':'رشوة / فساد',terrorism:locale==='en'?'Terrorism':'إرهاب',crime:m.catCrime,other:locale==='en'?'Adverse':'خبر سلبي'} as Record<string,string>)[c]??c;
 const classified=results.map(r=>({r,c:classifyMatch(r.code,r.match_kind,r.name_similarity,catMap,{details:r.details})})).filter(x=>x.c.percent>=50).sort((a,b)=>RANK[b.c.band]-RANK[a.c.band]||b.c.percent-a.c.percent);
 const overall=assess(classified.map(x=>x.c));
 const bandLabel=(b:string)=>({none:m.bandNone,low:m.bandLow,medium:m.bandMedium,high:m.bandHigh} as Record<string,string>)[b]??b;
 const catLabel=(c:string)=>({sanctions:m.catSanctions,pep:m.catPep,crime:m.catCrime,debarment:m.catDebarment,regulatory:m.catRegulatory,other:m.catOther} as Record<string,string>)[c]??c;
 const detParts=[overall.flags.sanctions&&m.catSanctions,overall.flags.debarment&&m.catDebarment,overall.flags.crime&&m.catCrime,overall.flags.pep&&m.catPep,overall.flags.regulatory&&m.catRegulatory].filter(Boolean) as string[];
 const determination=overall.band==='none'?m.detNone:`${detParts.length?detParts.join(' · '):m.similar} — ${m.detSeverity} ${bandLabel(overall.band)} · ${m.detAnalyst}`;
 return <><div className="page-heading"><div><div className="eyebrow">{m.srchEyebrow}</div><h1>{m.srchTitle}</h1><p>{m.srchLead}</p></div><span className="small-tag">{m.srchTag}</span></div>
 <section className="panel search-hero">
   <SearchForm defaultValue={q} placeholder={m.srchPlaceholder} inputAria={m.srchInputAria} btnText={m.srchBtn} scanningText={locale === 'en' ? 'Scanning watchlists…' : 'جاري فحص القوائم والمطابقة...'} />
   <p>{m.srchHeroNote}{quota.quota!=null&&<span className="quota-chip">{m.quotaLeft}: <strong><bdi>{number(quota.remaining??0)}</bdi></strong> / <bdi>{number(quota.quota)}</bdi></span>}</p>
   {recentSearches.length > 0 && (
     <div className="recent-searches-box">
       <div className="recent-searches-header">
         <span className="recent-searches-title">
           <History size={14} />
           {locale === 'en' ? 'Recent Searches' : 'عمليات البحث الأخيرة'}
         </span>
         <div className="recent-searches-tools">
           {recentSearches.length >= 10 && <Link href="/search/history" className="recent-searches-all">{locale === 'en' ? 'View all' : 'عرض الكل'}<ArrowUpLeft size={13}/></Link>}
           <form action={clearMySearchHistoryAction}>
             <button type="submit" className="clear-history-btn" title={locale === 'en' ? 'Clear search history' : 'مسح سجل البحث'}>
               <Trash2 size={12} />
               <span>{locale === 'en' ? 'Clear' : 'مسح السجل'}</span>
             </button>
           </form>
         </div>
       </div>
       <RecentSearchChips items={recentSearches} />
     </div>
   )}
 </section>
 <div className="inline-info"><Info size={19}/><p>{m.srchInfoA} <b><bdi>{number(coverage.length)}</bdi> {m.srchInfoBold}</b> {m.srchInfoC} {actor.role === 'admin' && <Link href="/sources">{m.srchViewCoverage}</Link>}</p></div>
 {q && canManageCustomers(actor.role) && (
   existingCustomer ? (
     <div className="search-quick-add-banner existing-customer-banner" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
       <div className="quick-add-info">
         <UserCheck size={24} style={{ color: 'var(--success, #10b981)', flexShrink: 0 }} />
         <div>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
             <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success, #10b981)', fontWeight: 600, fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
               {locale === 'en' ? 'Already Registered' : 'مسجل مسبقاً'}
             </span>
             <strong style={{ fontSize: '1rem' }} dir="auto">{existingCustomer.name}</strong>
             <small className="mono muted" dir="ltr">({existingCustomer.reference})</small>
           </div>
           <small style={{ display: 'block', marginTop: '0.2rem' }}>
             {locale === 'en'
               ? `This ${existingCustomer.entity_type === 'company' ? 'company' : 'customer'} is already registered in your files. You can visit their profile directly.`
               : `هذا ${existingCustomer.entity_type === 'company' ? 'الكيان / الشركة' : 'العميل'} مسجل بالفعل في ملفاتك. يمكنك زيارة ملفه مباشرة دون إعادة الإضافة.`}
           </small>
         </div>
       </div>
       <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
         <Link href={`/profiles/${existingCustomer.reference}`} className="button primary quick-add-action-btn" style={{ background: 'var(--success, #10b981)' }}>
           <ExternalLink size={15} />
           <span>{locale === 'en' ? 'View Profile' : 'زيارة الملف الشخصي'}</span>
         </Link>
         <Link href={`/profiles/new?name=${encodeURIComponent(q)}`} className="button secondary quick-add-action-btn" style={{ opacity: 0.8, fontSize: '0.8rem' }} title={locale === 'en' ? 'Create a separate duplicate profile' : 'إنشاء ملف إضافي جديد'}>
           <UserPlus size={14} />
           <span>{locale === 'en' ? 'New Duplicate' : 'إضافة ملف جديد'}</span>
         </Link>
       </div>
     </div>
   ) : (
     <div className="search-quick-add-banner">
       <div className="quick-add-info">
         <UserPlus size={20} />
         <div>
           <strong>{locale === 'en' ? `Add «${q.slice(0, 60)}» as a customer profile` : `إضافة «${q.slice(0, 60)}» كعميل في ملفاتي`}</strong>
           <small>{locale === 'en' ? 'Create and screen a new customer profile under your account directly from this search query' : 'إنشاء ملف عميل جديد وربطه بحسابك وتوثيقه في قاعدة بياناتك مباشرة'}</small>
         </div>
       </div>
       <Link href={`/profiles/new?name=${encodeURIComponent(q)}`} className="button primary quick-add-action-btn">
         <UserPlus size={15} />
         <span>{locale === 'en' ? 'Add as Customer' : '➕ إضافة كعميل'}</span>
       </Link>
     </div>
   )
 )}
 {q&&<section className="panel search-results"><div className="panel-heading"><h2>{m.resultsForA} «{q.slice(0,160)}»</h2><span className="muted">{results.length>50?m.first50:`${number(results.length)} ${m.potentialRecord}`}</span></div>
 {!results.length?<div className="empty"><Search size={30}/><h3>{q.length<3?m.emptyMin:m.emptyNoResults}</h3><p>{m.emptySearchBody}</p></div>:<>
 <div className={`risk-summary ${overall.band}`}><div className="risk-summary-main"><div className="risk-summary-band"><strong>{overall.band==='none'?'—':bandLabel(overall.band)}</strong><span>{m.overallSeverity}</span></div><div className="risk-summary-body"><p className="risk-summary-det">{determination}</p><div className="risk-flags">{overall.flags.sanctions&&<span className="cat-badge sanctions">{m.catSanctions}</span>}{overall.flags.debarment&&<span className="cat-badge debarment">{m.catDebarment}</span>}{overall.flags.crime&&<span className="cat-badge crime">{m.catCrime}</span>}{overall.flags.pep&&<span className="cat-badge pep">{m.catPep}</span>}{overall.flags.regulatory&&<span className="cat-badge regulatory">{m.catRegulatory}</span>}</div></div></div><div className="risk-summary-stat"><span className="stat-pill"><strong><bdi>{number(overall.relevant)}</bdi></strong> {m.relevantOf} <bdi>{number(results.length)}</bdi></span></div></div>
 <div className="result-list source-result-list">{classified.slice(0,50).map(({r,c}, idx)=><Link className="search-result" style={{'--item-idx': idx} as React.CSSProperties} href={`/search/${r.id}`} key={r.id}><span className={`risk-dot ${c.band}`} title={bandLabel(c.band)}/><div className="search-result-details"><h3 dir="auto">{r.name}</h3><p><span className={`cat-badge ${c.category}`}>{catLabel(c.category)}{c.pepTier?` · ${m.pepTierLabel} ${c.pepTier}`:''}</span>{c.isRca&&<span className="cat-badge pep">{m.rcaLabel}</span>} <span className="src-title" dir="auto">{c.sourceTitle}</span></p><div className="search-result-meta"><span className="meta-chip"><span className="meta-label">{m.matchedNameL}</span> <strong dir="auto"><bdi>{r.matched_name}</bdi></strong></span><span className="meta-sep" aria-hidden>·</span><span className="meta-chip code" dir="ltr"><bdi>{r.source_record_id}</bdi></span><span className="meta-sep" aria-hidden>·</span><span className="meta-chip date"><bdi>{m.versionWord} <DateText value={r.retrieved_at} locale={locale}/></bdi></span></div></div><div className="match-label"><span className={`risk-badge ${c.band}`}>{bandLabel(c.band)}</span><small dir="ltr">{c.percent}% · {r.match_kind==='exact'?m.exactText:m.similar}</small></div><ArrowUpLeft className="search-result-arrow" size={19}/></Link>)}</div></>}</section>}
 {q&&canCompany&&<section className="panel search-results"><div className="panel-heading"><div><h2>{m.gleifTitle}</h2><p>{m.gleifSub}</p></div><span className="small-tag">{companies.status==='searched'?m.gleifDone:m.gleifIncomplete}</span></div>{companies.status==='failed'?<div className="empty"><p>{m.gleifFailed}</p></div>:<><div className="result-list">{companies.records.map(c=><details className="company-result" key={c.id}><summary><strong dir="auto">{c.attributes.entity.legalName.name}</strong><span>{c.attributes.entity.legalAddress.country} · {m.gViewDetails}</span></summary><dl className="detail-grid"><div><dt>{m.gLei}</dt><dd>{c.id}</dd></div><div><dt>{m.gRegNo}</dt><dd>{c.attributes.entity.registeredAs||m.gNotAvail}</dd></div><div><dt>{m.gEntityLeiStatus}</dt><dd>{c.attributes.entity.status} / {c.attributes.registration.status}</dd></div><div><dt>{m.gLegalAddress}</dt><dd dir="auto">{[...c.attributes.entity.legalAddress.addressLines,c.attributes.entity.legalAddress.city,c.attributes.entity.legalAddress.country].filter(Boolean).join(', ')}</dd></div><div><dt>{m.gLastUpdate}</dt><dd>{c.attributes.registration.lastUpdateDate}</dd></div><div><dt>{m.gCreationDate}</dt><dd>{c.attributes.entity.creationDate||m.gNotAvail}</dd></div></dl><a className="text-link" href={'https://api.gleif.org/api/v1/lei-records/'+c.id} target="_blank" rel="noopener noreferrer">{m.gFullRecord}</a></details>)}</div><div className="table-footer">{companies.status==='searched'?`${m.gShowing} ${companies.records.length} ${m.gOf} ${companies.total} ${m.gFirst10} ${companies.retrievedAt}`:m.gTypeMin}</div>{companies.publishedAt&&<div className="table-footer">{m.gPublishedVer} {companies.publishedAt}</div>}</>}</section>}
 {q&&canAdverse&&<section className="panel search-results"><div className="panel-heading"><div><h2><Newspaper size={18}/> {m.advTitle}</h2><p>{m.advSub}</p></div><span className="small-tag">{adverse.status==='searched'?m.gleifDone:m.gleifIncomplete}</span></div>
  {adverse.status==='failed'?<div className="empty"><p>{m.advFailed}</p></div>:!adverse.articles.length?<div className="empty"><Newspaper size={28}/><p>{m.advNone}</p></div>:<>
   <div className="result-list">{adverse.articles.map((a,i)=>{const cls=a.category==='sanctions'?'sanctions':(a.category==='crime'||a.category==='terrorism')?'crime':a.category==='corruption'?'pep':(a.category==='laundering'||a.category==='fraud')?'debarment':'other';return <a className="search-result" href={a.url} target="_blank" rel="noopener noreferrer" key={a.url+i}><div><h3 dir="auto">{a.title}</h3><p><span className={`cat-badge ${cls}`}>{advCatLabel(a.category)}</span> <span className="src-title" dir="ltr">{a.domain}{a.date?` · ${a.date}`:''}</span></p></div><ExternalLink size={19}/></a>;})}</div>
   <div className="panel-footnote"><Info size={15}/><span>{m.advDisclaimer}</span></div></>}
 </section>}
 {actor.role === 'admin' && <section className="panel search-results coverage-panel"><div className="panel-heading"><div><h2>{m.covActiveTitle}</h2><p>{m.covActiveSub}</p></div><span className="small-tag">{number(coverage.length)} {m.listWord}</span></div>
   <div className="table-scroll"><table className="data-table coverage-table" dir={locale==='en'?'ltr':'rtl'}>
    <thead><tr>
     <th scope="col" className="cov-th-source">{locale==='en'?'Source / List':'المصدر / القائمة'}</th>
     <th scope="col" className="cov-th-category">{locale==='en'?'Category':'التصنيف'}</th>
     <th scope="col" className="cov-th-status">{locale==='en'?'Status':'الحالة'}</th>
     <th scope="col" className="cov-th-records">{locale==='en'?'Records & Updated':'السجلات وتاريخ التحديث'}</th>
    </tr></thead>
    <tbody>
     {[...coverage].sort((a,b)=>b.record_count-a.record_count).map(s=>{
      const cat=categoryOf(s.code,catMap);
      const stale=Date.now()-new Date(s.retrieved_at).getTime()>7*86400000;
      return <tr key={s.code}>
       <td className="cov-cell-source"><strong dir="auto"><span className="flag" aria-hidden>{flag(catMap[s.code]?.country??({UK:'GB',OFAC:'US'}[s.code]??''))||'🌐'}</span> <bdi>{catMap[s.code]?.title??LEGACY_TITLE[s.code]??s.code}</bdi></strong></td>
       <td className="cov-cell-category"><span className={`cat-badge ${cat}`}>{catLabel(cat)}</span></td>
       <td className="cov-cell-status"><span className={`status ${stale?'amber':'neutral'}`}><span className="status-mark"/>{stale?m.covNeedsUpdate:m.covActive}</span></td>
       <td className="cov-cell-records"><small><bdi>{number(s.record_count)} {m.recordWord}</bdi> <span className="cell-sep" aria-hidden>·</span> <DateText value={s.retrieved_at} locale={locale}/></small></td>
      </tr>;
     })}
     <tr>
      <td className="cov-cell-source"><strong dir="auto"><span className="flag" aria-hidden>🌐</span> <bdi>{m.gleifRowTitle}</bdi></strong></td>
      <td className="cov-cell-category"><span className="cat-badge other">{m.catCompanyData}</span></td>
      <td className="cov-cell-status"><span className="status neutral"><span className="status-mark"/>{m.directSearch}</span></td>
      <td className="cov-cell-records"><small><bdi>{m.byLegalName}</bdi></small></td>
     </tr>
    </tbody>
   </table></div>
  </section>}</>;
}
