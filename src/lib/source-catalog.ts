// Requested coverage, not a claim of exhaustive worldwide coverage.
export const requestedSources = [
 {name:'الأمم المتحدة',name_en:'United Nations',codes:['un_sc_sanctions'],note:'القائمة الموحدة؛ توجد أيضًا نسخة مباشرة UN.',note_en:'The consolidated list; a direct UN copy also exists.'},
 {name:'المملكة المتحدة',name_en:'United Kingdom',codes:['gb_fcdo_sanctions'],note:'قائمة العقوبات؛ توجد أيضًا نسخة مباشرة UK.',note_en:'The sanctions list; a direct UK copy also exists.'},
 {name:'OFAC — SDN وnon-SDN',name_en:'OFAC — SDN & non-SDN',codes:['us_ofac_sdn','us_ofac_cons'],note:'القائمتان المنشورتان؛ قد تتداخلان مع CSL.',note_en:'Both published lists; may overlap with CSL.'},
 {name:'CSL — قائمة الفحص الأمريكية المجمعة',name_en:'CSL — US Consolidated Screening List',codes:['us_trade_csl'],note:'قيود التصدير؛ تتداخل مع بعض القوائم الأمريكية.',note_en:'Export restrictions; overlaps with some US lists.'},
 {name:'الاتحاد الأوروبي',name_en:'European Union',codes:['eu_fsf'],note:'قائمة العقوبات المالية الموحدة.',note_en:'The consolidated financial sanctions list.'},
 {name:'الإمارات',name_en:'United Arab Emirates',codes:['ae_local_terrorists','ae_dfsa_prohibited'],note:'قائمة الإرهاب المحلية + الأشخاص المحظورون لدى DFSA؛ ليست كل السجلات الإماراتية.',note_en:'Local terrorist list + DFSA prohibited individuals; not every UAE record.'},
 {name:'كندا',name_en:'Canada',codes:['ca_dfatd_sema_sanctions'],note:'العقوبات المستقلة الموحدة.',note_en:'The consolidated autonomous sanctions.'},
 {name:'سويسرا SECO',name_en:'Switzerland SECO',codes:['ch_seco_sanctions'],note:'قائمة العقوبات.',note_en:'The sanctions list.'},
 {name:'أستراليا',name_en:'Australia',codes:['au_dfat_sanctions'],note:'القائمة الموحدة.',note_en:'The consolidated list.'},
 {name:'نيوزيلندا',name_en:'New Zealand',codes:['nz_russia_sanctions','nz_designated_terrorists'],note:'عقوبات روسيا والإرهاب المصنّف.',note_en:'Russia sanctions and designated terrorists.'},
 {name:'اليابان',name_en:'Japan',codes:['jp_mof_sanctions'],note:'عقوبات وزارة المالية.',note_en:'Ministry of Finance sanctions.'},
 {name:'البنك الدولي',name_en:'World Bank',codes:['worldbank_debarred'],note:'قائمة منع التعاقد.',note_en:'The debarred-firms list.'},
 {name:'بنك التنمية للبلدان الأمريكية IDB',name_en:'Inter-American Development Bank (IDB)',codes:['iadb_sanctions'],note:'الأفراد والشركات المعاقبون.',note_en:'Sanctioned individuals and firms.'},
 {name:'البنك الأوروبي EBRD',name_en:'EBRD',codes:['ebrd_ineligible'],note:'قائمة غير المؤهلين.',note_en:'The ineligible-entities list.'},
 {name:'بنك التنمية الأفريقي',name_en:'African Development Bank',codes:['afdb_sanctions'],note:'قائمة العقوبات.',note_en:'The sanctions list.'},
 {name:'SAM.gov',name_en:'SAM.gov',codes:['us_sam_exclusions'],note:'نسخة الاستبعادات عبر المزوّد؛ لا يوجد اتصال مباشر بـAPI.',note_en:'Exclusions via the provider; no direct API connection.'},
 {name:'BIS',name_en:'BIS',codes:['us_bis_denied'],note:'Denied Persons؛ ليست كل قيود BIS، وتوجد تغطية متداخلة عبر CSL.',note_en:'Denied Persons; not all BIS restrictions, with overlapping coverage via CSL.',partial:true},
 {name:'FCA — التحذيرات الرقابية',name_en:'FCA — regulatory warnings',codes:[],note:'موصل التحذيرات الرسمي لم يكتمل.',note_en:'The official warnings connector is not complete.'},
 {name:'SEC — الإنفاذ والتحذيرات',name_en:'SEC — enforcement & warnings',codes:['us_sec_harmed_investors','us_sec_pause'],partial:true,note:'PAUSE والجهات المرتبطة بتعويض المتضررين فقط؛ ليست سجل دعاوى الإنفاذ الكامل.',note_en:'PAUSE and harmed-investor bodies only; not the full enforcement docket.'},
 {name:'DOJ — الإنفاذ',name_en:'DOJ — enforcement',codes:[],note:'موصل الأخبار/القضايا لم يكتمل؛ خبر القضية ليس حكمًا بالإدانة.',note_en:'The news/cases connector is not complete; a case report is not a conviction.'},
 {name:'Companies House',name_en:'Companies House',codes:[],note:'يتطلب ربط API بمفتاح دخول؛ غير مفعّل حاليًا.',note_en:'Requires an API key; not enabled currently.'},
 {name:'GLEIF / LEI',name_en:'GLEIF / LEI',codes:[],live:true,note:'بحث مباشر للشركات ذات LEI؛ حالة الاستجابة تظهر مع كل بحث، وليست تغطية لكل الشركات.',note_en:'Live search for LEI-registered companies; the response status shows on each search, not coverage of every company.'},
 {name:'ICIJ Offshore Leaks',name_en:'ICIJ Offshore Leaks',codes:[],note:'استيراد قاعدة العلاقات الكاملة لم يكتمل. الظهور فيها وحده لا يعني مخالفة.',note_en:'Importing the full relationships database is not complete. Appearing in it alone is not a violation.'},
 {name:'Wikidata — سياق المناصب',name_en:'Wikidata — position context',codes:[],note:'الربط الانتقائي للمناصب والعلاقات لم يكتمل.',note_en:'Selective linking of positions and relationships is not complete.'},
 {name:'PEP / RCA عالمي',name_en:'Global PEP / RCA',codes:['qa_shura_council','bh_nuwab','om_parliament'],partial:true,note:'مجالس قطر والبحرين وعُمان فقط حاليًا؛ لا توجد تغطية عالمية أو RCA مكتملة.',note_en:'Qatar, Bahrain, and Oman councils only for now; no global coverage or complete RCA.'},
 {name:'الأخبار السلبية',name_en:'Adverse media',codes:[],note:'مزوّد وتغطية وترخيص لم تُحدد؛ غير مفعّلة.',note_en:'Provider, coverage, and licence undecided; not enabled.'},
] satisfies {name:string;name_en:string;codes:string[];note:string;note_en:string;partial?:boolean;live?:boolean}[];
export type CoverageCode = 'direct'|'notLinked'|'partial'|'inScope';
export function coverageStatus(source:{codes:string[];partial?:boolean;live?:boolean},active:Set<string>):CoverageCode{
 const count=source.codes.filter(code=>active.has(code)).length;
 if(source.live)return 'direct';
 if(!count)return 'notLinked';
 if(source.partial||count<source.codes.length)return 'partial';
 return 'inScope';
}
