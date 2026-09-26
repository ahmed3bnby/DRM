import { Database, Info, Globe, LockKeyhole, FileCheck2, ListChecks, RefreshCw, CircleCheckBig, Layers3, ShieldAlert } from 'lucide-react';
import { redirect } from 'next/navigation';
import { requireActor } from '@/lib/auth';
import { sourceCatalog, watchlistCodes, sourceChanges, importHistory, sourceSyncStatus } from '@/lib/sources';
import { searchCoverage } from '@/lib/search';
import { requestedSources, coverageStatus } from '@/lib/source-catalog';
import { number, DateText, flag, PAGE_SIZE, Pagination, parsePage, withQuery } from '@/components/ui';
import { getMessages, getLocale } from '@/lib/i18n';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export default async function Sources({searchParams}:{searchParams:Promise<{req?:string;lists?:string}>}) {
  const actor = await requireActor();
  if (actor.role !== 'admin') redirect('/');
  const search = await searchParams;
  const [catalog,watch,changes,history,activeVersions,syncStatus,m,locale]=await Promise.all([
    sourceCatalog(),watchlistCodes(),sourceChanges(),importHistory(),searchCoverage(),sourceSyncStatus(),getMessages(),getLocale()
  ]);
  const active=new Set(activeVersions.map(v=>v.code));
  const byCode=new Map((catalog?.sources??[]).map(s=>[s.code,s]));
  const tracked=watch.map(code=>({code,meta:byCode.get(code),imported:history[code]})).filter(t=>t.meta);
  const updatedUpstream=changes?.updatedLists?.length??0;
  const searchableRecords=activeVersions.reduce((total,version)=>total+version.record_count,0);
  const activeTracked=tracked.filter(({code})=>active.has(code)).length;
  const covLabel=(c:string)=>({direct:m.covStDirect,notLinked:m.covStNotLinked,partial:m.covStPartial,inScope:m.covStInScope} as Record<string,string>)[c]??c;
  const reqTotal=requestedSources.length;
  const reqPage=parsePage(search.req, reqTotal);
  const reqRows=requestedSources.slice((reqPage-1)*PAGE_SIZE, reqPage*PAGE_SIZE);
  const listsTotal=tracked.length;
  const listsPage=parsePage(search.lists, listsTotal);
  const listRows=tracked.slice((listsPage-1)*PAGE_SIZE, listsPage*PAGE_SIZE);
  const sourcesHref=(req:number, lists:number)=>withQuery('/sources', { req: req>1?String(req):undefined, lists: lists>1?String(lists):undefined });
  const covLive=[
    {ar:'العقوبات وقوائم الحظر',en:'Sanctions & watchlists',ar2:'OFAC · UN · EU · UK · SECO · DFAT · قطر · البحرين · عُمان · الإمارات',en2:'OFAC · UN · EU · UK · SECO · DFAT · GCC'},
    {ar:'الحظر والإنفاذ التنظيمي',en:'Debarment & enforcement',ar2:'البنك الدولي · IADB · EBRD · AfDB · BIS · SAM · SEC',en2:'World Bank · IADB · EBRD · AfDB · BIS · SAM · SEC'},
    {ar:'الأشخاص السياسيون (PEP)',en:'Politically exposed persons',ar2:'برلمانات · شركات مملوكة للدولة · قادة عالميون',en2:'Parliaments · state-owned enterprises · world leaders'},
    {ar:'أطراف محل اهتمام خاص وجريمة',en:'Special-interest & crime',ar2:'Interpol Red Notices · قوائم مطلوبين · إجراءات إنفاذ',en2:'Interpol Red Notices · most-wanted · enforcement actions'},
    {ar:'بيانات الشركات والملكية',en:'Corporate & ownership',ar2:'GLEIF LEI · بحث مباشر بالاسم',en2:'GLEIF LEI · direct name search'},
  ];
  const covLicensed=[
    {ar:'الإعلام السلبي',en:'Adverse media',ar2:'أخبار عامة مرتّبة بالصلة — يحتاج مصدر أخبار',en2:'Relevance-ranked public news — needs a news source'},
    {ar:'PEP/RCA عالمي شامل',en:'Global PEP / RCA depth',ar2:'الأقارب والمرتبطون على مستوى عالمي كامل',en2:'Relatives & close associates, full global depth'},
    {ar:'ملكية الشركات المملوكة للدولة',en:'SOE ownership',ar2:'سلاسل الملكية والسيطرة التفصيلية',en2:'Detailed ownership / control chains'},
    {ar:'العقوبات والـ PEP السابقة',en:'Former sanctions / former PEP',ar2:'السجل التاريخي للإدراج والصفة',en2:'Historical listing & status'},
    {ar:'استخبارات الجرائم الخاصة',en:'Special crime intelligence',ar2:'مخدرات · جريمة منظمة · عبودية حديثة · سيبراني',en2:'Narcotics · organised crime · modern slavery · cyber'},
  ];
  const covItem=(it:{ar:string;en:string;ar2:string;en2:string})=><li key={it.en}><strong dir="auto">{locale==='en'?it.en:it.ar}</strong><small dir="auto">{locale==='en'?it.en2:it.ar2}</small></li>;
  const labels=locale==='en'?{
    liveSources:'Live sources', searchable:'searchable records', registry:'Public registry', tracked:'tracked lists', attention:'Needs review', attentionNone:'No changes waiting', guide:'What the current coverage includes', guideSub:'These are the categories currently available for screening. Expand the extended coverage only when you need to understand the limits.', details:'Coverage details and limitations', requested:'Requested-source coverage and gaps', requestedSub:'A transparent map of sources not yet linked or only partly available.'
  }:{
    liveSources:'مصادر مفعّلة', searchable:'سجل قابل للبحث', registry:'السجل العام', tracked:'قائمة تحت المتابعة', attention:'يحتاج متابعة', attentionNone:'لا توجد تغييرات معلّقة', guide:'ما الذي يشمله الفحص الحالي؟', guideSub:'هذه هي الفئات المتاحة الآن للفحص. افتح تفاصيل التغطية فقط عند الحاجة لمعرفة الحدود.', details:'تفاصيل التغطية والحدود', requested:'تغطية المصادر المطلوبة والفجوات', requestedSub:'خريطة واضحة للمصادر غير المربوطة أو المتاحة جزئيًا.'
  };
  return <><div className="page-heading"><div><div className="eyebrow">{m.srcPageEyebrow}</div><h1>{m.srcPageTitle}</h1><p>{m.srcPageSub}</p></div><span className="small-tag">{m.srcPageTag}</span></div>

    <section className="source-overview panel stack-gap">
      <div className="source-overview-intro"><div><span className="cov-badge live"><CircleCheckBig size={13}/>{m.covLiveBadge}</span><h2>{labels.guide}</h2><p>{labels.guideSub}</p></div><div className="source-overview-sync"><RefreshCw size={18}/><span>{updatedUpstream>0?m.upstreamUpdated:m.lastSync}</span><strong>{updatedUpstream>0?`${number(updatedUpstream)} ${m.listUnitCount}`:catalog?.retrievedAt?<DateText value={catalog.retrievedAt} locale={locale}/>: '—'}</strong></div></div>
      <div className="source-metrics">
        <div><span className="source-metric-icon blue"><Database size={19}/></span><strong><bdi>{number(searchableRecords)}</bdi></strong><small>{labels.searchable}</small></div>
        <div><span className="source-metric-icon green"><ListChecks size={19}/></span><strong><bdi>{number(activeTracked)} / {number(tracked.length)}</bdi></strong><small>{labels.liveSources}</small></div>
        <div><span className="source-metric-icon slate"><Layers3 size={19}/></span><strong><bdi>{number(catalog?.total??0)}</bdi></strong><small>{labels.registry}</small></div>
        <div><span className={`source-metric-icon ${updatedUpstream?'amber':'green'}`}><ShieldAlert size={19}/></span><strong><bdi>{updatedUpstream?number(updatedUpstream):'—'}</bdi></strong><small>{updatedUpstream?labels.attention:labels.attentionNone}</small></div>
      </div>
      <div className="source-scope-live"><div className="coverage-col-head"><span className="cov-badge live">{m.covLiveBadge}</span><h3>{m.covLiveHeading}</h3></div><ul className="coverage-list-items">{covLive.map(covItem)}</ul></div>
      <details className="source-details"><summary><span>{labels.details}</span><span className="source-details-hint">{m.covLicensedHeading}</span></summary><div className="source-details-body"><div className="coverage-col-head"><span className="cov-badge licensed">{m.covLicensedBadge}</span><h3>{m.covLicensedHeading}</h3></div><ul className="coverage-list-items">{covLicensed.map(covItem)}</ul></div></details>
    </section>

    {catalog && <section className="panel stack-gap source-lists-panel">
        <div className="panel-heading"><div><h2><Database size={18}/> {m.publicListsTitle}</h2><p>{m.publicListsSub}</p></div><span className="small-tag">{m.covLiveBadge}</span></div>
        <div className="table-scroll"><table className="data-table sources-table"><thead><tr><th className="th-src-list">{m.thList}</th><th className="th-src-country">{m.thCountryCol}</th><th className="th-src-records">{m.thSearchable}</th><th className="th-src-version">{m.thSourceVersion}</th><th className="th-src-change">{m.thUpstreamChange}</th><th className="th-src-import">{m.thLastImport}</th><th className="th-src-status">{m.thStatusCol}</th></tr></thead><tbody>
          {listRows.map(({code,meta,imported})=>{
            const changed=imported && meta?.version && imported.upstream_version && imported.upstream_version!==meta.version;
            return <tr key={code}>
              <td data-label={m.thList} className="src-list-cell"><strong className="list-title" dir="auto"><bdi>{meta!.title}</bdi></strong><small dir="ltr" className="cell-code"><bdi>{code}</bdi></small></td>
              <td data-label={m.thCountryCol} className="src-country-cell"><span className="flag" aria-hidden>{flag(meta!.country??'')||'🌐'}</span></td>
              <td data-label={m.thSearchable} className="src-records-cell"><bdi>{number(activeVersions.find(v=>v.code===code)?.record_count??0)}</bdi></td>
              <td data-label={m.thSourceVersion} className="src-version-cell ver-muted"><bdi dir="ltr">{meta!.version??'—'}</bdi></td>
              <td data-label={m.thUpstreamChange} className="src-change-cell">{meta!.lastChange?<DateText value={meta!.lastChange} locale={locale}/>:'—'}</td>
              <td data-label={m.thLastImport} className="src-import-cell">{imported?<span><bdi><DateText value={imported.imported_at} locale={locale}/></bdi> <small dir="ltr" className="change-count"><bdi dir="ltr">(+{number(imported.added)} / -{number(imported.removed)})</bdi></small></span>:<span className="not-run">{m.notImportedYet}</span>}</td>
              <td data-label={m.thStatusCol} className="src-status-cell">{syncStatus[code]?.status==='failed'?<span className="status amber">{m.syncFailed}{active.has(code)?m.prevAvailable:''}</span>:!active.has(code)?<span className="status neutral"><span className="status-mark"/>{m.awaitingImport}</span>:changed?<span className="status amber"><span className="status-mark"/>{m.updateAvailable}</span>:<span className="status neutral"><span className="status-mark"/>{m.upToDate}</span>}</td>
            </tr>;
          })}
        </tbody></table></div>
        <Pagination page={listsPage} pageSize={PAGE_SIZE} total={listsTotal} makeHref={p=>sourcesHref(reqPage, p)} m={m}/>
        <div className="panel-footnote"><Info size={15}/><span>{m.srcTableFootnote}</span></div>
      </section>}

    <details className="panel stack-gap source-requested-details"><summary><span><strong>{labels.requested}</strong><small>{labels.requestedSub}</small></span><span className="small-tag"><bdi>{number(reqTotal)}</bdi></span></summary><div className="source-requested-body"><div className="table-scroll"><table className="data-table req-table"><thead><tr><th>{m.thSource}</th><th>{m.thLinkStatus}</th><th>{m.thScopeRemaining}</th></tr></thead><tbody>{reqRows.map(source=><tr key={source.name}><td data-label={m.thSource}><span dir="auto">{locale==='en'?source.name_en:source.name}</span></td><td data-label={m.thLinkStatus}><span className="status neutral">{covLabel(coverageStatus(source,active))}</span></td><td data-label={m.thScopeRemaining}><span dir="auto">{locale==='en'?source.note_en:source.note}</span></td></tr>)}</tbody></table></div><Pagination page={reqPage} pageSize={PAGE_SIZE} total={reqTotal} makeHref={p=>sourcesHref(p, listsPage)} m={m}/><div className="panel-footnote"><Info size={15}/><span>{m.srcFootnote1} <a href="https://www.opensanctions.org/licensing/" target="_blank" rel="noopener noreferrer">{m.providerTerms}</a></span></div></div></details>

    <section className="panel licensed-source"><span className="entity-icon" style={{ background: '#ecfdf5', color: '#047857' }}><Globe size={22}/></span><div><h2>{m.adverseTitle}</h2><p>{m.adverseBody}</p></div><span className="status green"><span className="status-mark"/>{m.awaitingProvider}</span></section>
  </>;
}
