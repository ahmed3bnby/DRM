// Enterprise Watchlist & Regulatory Source Catalog
export const requestedSources = [
  // 1. Mandatory Core & UAE Sanctions
  {
    name: 'الأمم المتحدة (UN Sanctions)',
    name_en: 'United Nations Security Council Sanctions',
    codes: ['un_sc_sanctions', 'UN'],
    note: 'القائمة الموحدة لمجلس الأمن الدولي؛ فحص وتحديث آلي يومي.',
    note_en: 'UNSC consolidated sanctions list; daily automated sync.'
  },
  {
    name: 'المملكة المتحدة (UK FCDO / OFSI)',
    name_en: 'United Kingdom Sanctions (OFSI)',
    codes: ['gb_fcdo_sanctions', 'UK'],
    note: 'القائمة الموحدة لتجميد الأصول بالخزانة البريطانية.',
    note_en: 'UK consolidated asset freeze and sanctions list.'
  },
  {
    name: 'الولايات المتحدة (OFAC — SDN & Consolidated)',
    name_en: 'US OFAC Specially Designated Nationals (SDN)',
    codes: ['us_ofac_sdn', 'us_ofac_cons'],
    note: 'قوائم العقوبات الشاملة لمكتب مراقبة الأصول الأجنبية الأمريكي.',
    note_en: 'US Treasury OFAC SDN & non-SDN consolidated regimes.'
  },
  {
    name: 'الاتحاد الأوروبي (EU Financial Sanctions)',
    name_en: 'European Union Financial Sanctions (FSF)',
    codes: ['eu_fsf'],
    note: 'قائمة العقوبات والتجميد المالي الموحدة لدول الاتحاد الأوروبي.',
    note_en: 'European Union consolidated financial sanctions files.'
  },
  {
    name: 'دولة الإمارات (قائمة الإرهاب المحلية المعتمدة)',
    name_en: 'United Arab Emirates Local Terrorist List',
    codes: ['ae_local_terrorists'],
    note: 'قائمة الأشخاص والتنظيمات الإرهابية الصادرة بقرارات مجلس الوزراء الإماراتي.',
    note_en: 'UAE Cabinet approved local terrorism list.'
  },
  {
    name: 'دولة الإمارات (سلطة دبي للخدمات المالية DFSA)',
    name_en: 'Dubai Financial Services Authority (DFSA)',
    codes: ['ae_dfsa_prohibited'],
    note: 'الأشخاص والكيانات المحظورة والمقيدة بمركز دبي المالي العالمي (DIFC).',
    note_en: 'DFSA prohibited & restricted persons register.'
  },
  {
    name: 'الولايات المتحدة (CSL & BIS & SAM.gov)',
    name_en: 'US Export Enforcement (CSL / BIS / SAM)',
    codes: ['us_trade_csl', 'us_bis_denied', 'us_sam_exclusions'],
    note: 'قوائم الحظر التجاري والاستبعاد الفيدرالي الأمريكي (Denied Persons).',
    note_en: 'US Consolidated Screening List, BIS Denied Persons, and SAM exclusions.'
  },
  {
    name: 'سويسرا (SECO Sanctions)',
    name_en: 'Switzerland SECO Sanctions',
    codes: ['ch_seco_sanctions'],
    note: 'قائمة العقوبات للأمانة العامة للشؤون الاقتصادية السويسرية.',
    note_en: 'Swiss State Secretariat for Economic Affairs sanctions.'
  },
  {
    name: 'كندا وأستراليا ونيوزيلندا واليابان',
    name_en: 'Canada, Australia, New Zealand & Japan Sanctions',
    codes: ['ca_dfatd_sema_sanctions', 'au_dfat_sanctions', 'nz_russia_sanctions', 'nz_designated_terrorists', 'jp_mof_sanctions'],
    note: 'قوائم العقوبات الرسمية لدول مجموعة السبع وحلفاء المحيط الهادئ.',
    note_en: 'Statutory sanctions lists of Canada, Australia, NZ, and Japan MoF.'
  },

  // 2. Multilateral Development Banks & Debarment
  {
    name: 'البنك الدولي (World Bank Debarred)',
    name_en: 'World Bank Debarred Firms & Individuals',
    codes: ['worldbank_debarred'],
    note: 'الشركات والأفراد المحرومون من التعامل لمخالفات الاحتيال والفساد.',
    note_en: 'World Bank Listing of Ineligible Firms & Individuals.'
  },
  {
    name: 'بنوك التنمية الدولية (EBRD, IDB, AfDB)',
    name_en: 'Regional Development Banks (EBRD, IDB, AfDB)',
    codes: ['ebrd_ineligible', 'iadb_sanctions', 'afdb_sanctions'],
    note: 'قوائم الحظر المشترك للبنك الأوروبي والبنك الإفريقي وبنك البلدان الأمريكية.',
    note_en: 'Cross-debarment lists of EBRD, IADB, and African Development Bank.'
  },

  // 3. International Law Enforcement & Crime
  {
    name: 'الإنتربول (Interpol Red Notices)',
    name_en: 'Interpol Red Notices & Wanted Persons',
    codes: ['interpol_red_notices'],
    note: 'النشرات الحمراء الرسمية للمطلوبين دولياً عبر منظمة الشرطة الجنائية الدولية.',
    note_en: 'International Criminal Police Organization Red Notices.'
  },
  {
    name: 'اليوروبول (Europol Most Wanted)',
    name_en: 'Europol Most Wanted Fugitives',
    codes: ['eu_europol_wanted'],
    note: 'أخطر المطلوبين أمنياً لجرائم غسل الأموال والجريمة المنظمة بأوروبا.',
    note_en: 'European Union Agency for Law Enforcement Cooperation wanted list.'
  },
  {
    name: 'الولايات المتحدة (FBI Most Wanted)',
    name_en: 'US FBI Most Wanted & Fugitives',
    codes: ['us_fbi_most_wanted'],
    note: 'قائمة المطلوبين لمكتب التحقيقات الفيدرالي في الجرائم المالية والإرهاب.',
    note_en: 'Federal Bureau of Investigation most wanted persons.'
  },
  {
    name: 'بريطانيا (UK National Crime Agency - NCA)',
    name_en: 'UK National Crime Agency Most Wanted',
    codes: ['gb_nca_most_wanted'],
    note: 'قوائم المطلوبين للوكالة الوطنية لمكافحة الجريمة المنظمة بالمملكة المتحدة.',
    note_en: 'UK National Crime Agency fugitives register.'
  },

  // 4. Regional & Arab Watchlists
  {
    name: 'المملكة العربية السعودية (أمن الدولة - مكافحة الإرهاب)',
    name_en: 'Saudi Arabia Presidency of State Security (PCCT)',
    codes: ['sa_pcct_terrorism_list'],
    note: 'قائمة الإرهابيين وتجميد الأصول الصادرة عن رئاسة أمن الدولة بالمملكة.',
    note_en: 'Saudi Presidency of State Security Terrorism List.'
  },
  {
    name: 'جمهورية مصر العربية (قوائم الإرهابيين والكيانات)',
    name_en: 'Egypt Official Terrorist Entities & Persons List',
    codes: ['eg_terrorists'],
    note: 'قرارات محكمة استئناف القاهرة والنيابة العامة لقوائم الإرهابيين والكيانات.',
    note_en: 'Egyptian Official Gazette designated terrorists and entities.'
  },
  {
    name: 'باكستان وإيران (NACTA & National Sanctions)',
    name_en: 'Pakistan & Iran National Counter-Terrorism Watchlists',
    codes: ['pk_proscribed_persons', 'ir_sanctions'],
    note: 'الأشخاص والتنظيمات المحظورة لدى NACTA الباكستانية وقوائم العقوبات الإقليمية.',
    note_en: 'Pakistan NACTA Proscribed Persons List and regional regimes.'
  },

  // 5. Politically Exposed Persons (PEPs)
  {
    name: 'قادة العالم ورؤساء الدول (CIA World Leaders)',
    name_en: 'CIA World Leaders & Cabinet Members',
    codes: ['us_cia_world_leaders'],
    note: 'رؤساء الدول والحكومات والوزراء والمسؤولون السياديون حول العالم.',
    note_en: 'Chiefs of State and Cabinet Members of Foreign Governments.'
  },
  {
    name: 'البرلمان الأوروبي ومجالس الدول (EU Parliament & Assemblies)',
    name_en: 'European Parliament & National Assemblies',
    codes: ['eu_meps', 'fr_assemblee', 'dk_pep', 'cz_pep_declarations'],
    note: 'أعضاء البرلمان الأوروبي والجمعيات الوطنية والبرلمانات الأوروبية.',
    note_en: 'European Parliament MEPs and European national assemblies.'
  },
  {
    name: 'المجالس التشريعية العربية والخليجية (GCC & Arab Councils)',
    name_en: 'GCC & Arab Parliaments & Councils',
    codes: ['qa_shura_council', 'bh_nuwab', 'om_parliament', 'eg_house_representatives', 'pk_na_members', 'pk_senate_members'],
    note: 'أعضاء مجالس الشورى والنواب في قطر، البحرين، عُمان، مصر، وباكستان.',
    note_en: 'Parliamentary and advisory council members across GCC, Egypt, and Pakistan.'
  },
  {
    name: 'قاعدة بيانات السياسيين العالمية (EveryPolitician)',
    name_en: 'Global Political Registry (EveryPolitician)',
    codes: ['everypolitician', 'ng_join_dots', 'co_join_dots', 'ng_chipper_peps'],
    note: 'تغطية واسعة للشخصيات السياسية المعرضة للمخاطر (PEP) في أكثر من 140 دولة.',
    note_en: 'Comprehensive global dataset of politicians and officeholders worldwide.'
  },

  // 6. Corporate Registries & Intelligence
  {
    name: 'بيانات الشركات والملكية (GLEIF / LEI Database)',
    name_en: 'Global Legal Entity Identifier Foundation (GLEIF)',
    codes: [],
    live: true,
    note: 'فحص فوري حي ومباشر لمعرفات الكيانات القانونية (LEI) وهياكل الملكية حول العالم.',
    note_en: 'Real-time live verification for LEI-registered legal entities and corporate ownership.'
  },
  {
    name: 'الأخبار السلبية والتحري الإعلامي (Adverse Media)',
    name_en: 'Adverse Media & Financial Crime News Feeds',
    codes: [],
    live: true,
    note: 'مسح آلي مدعوم بمحرك بحث الأخبار للتحري الفوري عن قضايا الفساد، الاحتيال، وغسل الأموال.',
    note_en: 'Automated intelligence search scanning global news feeds for financial crimes and corruption.'
  },
] satisfies {
  name: string;
  name_en: string;
  codes: string[];
  note: string;
  note_en: string;
  partial?: boolean;
  live?: boolean;
}[];

export type CoverageCode = 'direct' | 'notLinked' | 'partial' | 'inScope';

export function coverageStatus(
  source: { codes: string[]; partial?: boolean; live?: boolean },
  active: Set<string>
): CoverageCode {
  if (source.live) return 'direct';
  const count = source.codes.filter((code) => active.has(code)).length;
  if (!count) return 'notLinked';
  if (source.partial || count < source.codes.length) return 'partial';
  return 'inScope';
}
