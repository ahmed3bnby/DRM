import type { Locale } from './i18n';

const labelsAr: Record<string,string> = {
 name:'الاسم',alias:'أسماء بديلة',weakAlias:'أسماء بديلة ضعيفة',previousName:'الاسم السابق',firstName:'الاسم الأول',lastName:'الاسم الأخير',middleName:'الاسم الأوسط',title:'اللقب',gender:'النوع',birthDate:'تاريخ الميلاد',birth_date:'تاريخ الميلاد',dateOfBirth:'تاريخ الميلاد',birthPlace:'مكان الميلاد',deathDate:'تاريخ الوفاة',nationality:'الجنسية',country:'الدولة',countries:'الدول',citizenship:'الجنسية',address:'العنوان',addressEntity:'العناوين المفصّلة',full:'العنوان الكامل',street:'الشارع',city:'المدينة',region:'المنطقة',postalCode:'الرمز البريدي',passportNumber:'رقم جواز السفر',idNumber:'رقم الهوية',identifiers:'المعرّفات',identification:'وثائق التعريف',number:'الرقم',holder:'صاحب الوثيقة — مرجع',registrationNumber:'رقم التسجيل',incorporationDate:'تاريخ التأسيس',dissolutionDate:'تاريخ الحل',jurisdiction:'الاختصاص القضائي',legalForm:'الشكل القانوني',status:'الحالة',leiCode:'معرّف LEI',taxNumber:'الرقم الضريبي',website:'الموقع',email:'البريد الإلكتروني',phone:'الهاتف',position:'المنصب',positionOccupancies:'المناصب المشغولة',occupancies:'المناصب',employers:'جهات العمل',ownershipOwner:'ملكية — بصفة مالك',ownershipAsset:'ملكية — بصفة أصل مملوك',ownership:'الملكية',owner:'المالك',asset:'الأصل / الكيان المملوك',percentage:'نسبة الملكية',sharesCount:'عدد الحصص',associates:'العلاقات',familyPerson:'العلاقات العائلية',familyRelative:'الأقارب',associate:'الطرف المرتبط',person:'الشخص',relative:'القريب',relationship:'نوع العلاقة',startDate:'تاريخ البداية',endDate:'تاريخ النهاية',sanctions:'تفاصيل الإدراج / العقوبات',authority:'الجهة المصدرة',program:'البرنامج / سبب الإدراج',programId:'معرّف البرنامج',program_ids:'معرّفات البرامج',reason:'السبب',summary:'الملخص',description:'الوصف',notes:'ملاحظات المصدر',topics:'تصنيفات المصدر',sourceUrl:'رابط الدليل',programUrl:'رابط البرنامج',url:'الرابط',listingDate:'تاريخ الإدراج',modifiedAt:'تاريخ التعديل',entity:'الكيان — مرجع',publisher:'الناشر',provider:'مزوّد البيانات',officialUrl:'صفحة المصدر الأصلي',datasets:'القوائم المساهمة',firstSeen:'أول رصد لدى المزوّد',lastSeen:'آخر رصد لدى المزوّد',lastChange:'آخر تغيير لدى المزوّد',upstreamVersion:'نسخة المزوّد',schema:'نوع السجل',referents:'المراجع المرتبطة',caption:'العنوان',id:'معرّف السجل',NATIONALITY:'الجنسية',COMMENTS1:'ملاحظات المصدر',LISTED_ON:'تاريخ الإدراج',REFERENCE_NUMBER:'مرجع القائمة',NAME_ORIGINAL_SCRIPT:'الاسم بالكتابة الأصلية'
};
const labelsEn: Record<string,string> = {
 name:'Name',alias:'Aliases',weakAlias:'Weak aliases',previousName:'Previous name',firstName:'First name',lastName:'Last name',middleName:'Middle name',title:'Title',gender:'Gender',birthDate:'Date of birth',birth_date:'Date of birth',dateOfBirth:'Date of birth',birthPlace:'Place of birth',deathDate:'Date of death',nationality:'Nationality',country:'Country',countries:'Countries',citizenship:'Citizenship',address:'Address',addressEntity:'Detailed addresses',full:'Full address',street:'Street',city:'City',region:'Region',postalCode:'Postal code',passportNumber:'Passport number',idNumber:'ID number',identifiers:'Identifiers',identification:'Identity documents',number:'Number',holder:'Document holder — reference',registrationNumber:'Registration number',incorporationDate:'Incorporation date',dissolutionDate:'Dissolution date',jurisdiction:'Jurisdiction',legalForm:'Legal form',status:'Status',leiCode:'LEI code',taxNumber:'Tax number',website:'Website',email:'Email',phone:'Phone',position:'Position',positionOccupancies:'Positions held',occupancies:'Positions',employers:'Employers',ownershipOwner:'Ownership — as owner',ownershipAsset:'Ownership — as owned asset',ownership:'Ownership',owner:'Owner',asset:'Asset / owned entity',percentage:'Ownership percentage',sharesCount:'Shares count',associates:'Relationships',familyPerson:'Family relationships',familyRelative:'Relatives',associate:'Associated party',person:'Person',relative:'Relative',relationship:'Relationship type',startDate:'Start date',endDate:'End date',sanctions:'Listing / sanctions details',authority:'Issuing authority',program:'Program / listing reason',programId:'Program ID',program_ids:'Program IDs',reason:'Reason',summary:'Summary',description:'Description',notes:'Source notes',topics:'Source classifications',sourceUrl:'Evidence link',programUrl:'Program link',url:'Link',listingDate:'Listing date',modifiedAt:'Modified date',entity:'Entity — reference',publisher:'Publisher',provider:'Data provider',officialUrl:'Original source page',datasets:'Contributing lists',firstSeen:'First seen by provider',lastSeen:'Last seen by provider',lastChange:'Last change by provider',upstreamVersion:'Provider version',schema:'Record type',referents:'Linked references',caption:'Title',id:'Record ID',NATIONALITY:'Nationality',COMMENTS1:'Source notes',LISTED_ON:'Listing date',REFERENCE_NUMBER:'List reference',NAME_ORIGINAL_SCRIPT:'Name in original script'
};
export const detailLabel = (key:string, locale:Locale='en') => (locale==='en'?labelsEn:labelsAr)[key] ?? key;

export function safeSourceUrl(value:unknown):string|null {
 if(typeof value!=='string')return null;
 try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}
}

// Groups return a stable key; the UI localizes it (m.grpListing…).
export type GroupKey = 'listing'|'relations'|'addresses'|'identity';
export function detailGroup(key:string):GroupKey {
 if(/sanction|program|reason|listing|authority|topics|notes|summary|description|comments|listed/i.test(key))return 'listing';
 if(/ownership|owner|asset|associate|family|relative|position|occupanc|employer|membership|directorship/i.test(key))return 'relations';
 if(/address|country|countries|city|street|region|postal|website|email|phone|sourceUrl|url/i.test(key))return 'addresses';
 return 'identity';
}

// --- Value translation: coded source values → localized display ---
const region = { ar: new Intl.DisplayNames(['ar'],{type:'region'}), en: new Intl.DisplayNames(['en'],{type:'region'}) };
const flagEmoji = (code:string)=>{const u=code.trim().toUpperCase();return /^[A-Z]{2}$/.test(u)&&!['ZZ','XX','OT'].includes(u)?String.fromCodePoint(...[...u].map(ch=>0x1F1E6+ch.charCodeAt(0)-65)):'';};
const TOPIC:Record<Locale,Record<string,string>> = {
 ar:{sanction:'عقوبات','sanction.linked':'مرتبط بعقوبات','sanction.counter':'عقوبات مضادة','sanction.control':'خاضع لسيطرة جهة معاقَبة','role.pep':'شخصية سياسية (PEP)','role.pep.class.1':'شخصية سياسية — المستوى ١','role.pep.class.2':'شخصية سياسية — المستوى ٢','role.pep.class.3':'شخصية سياسية — المستوى ٣','role.rca':'قريب/شريك لشخصية سياسية','role.oligarch':'أوليغارشي','role.judge':'قاضٍ','role.diplo':'دبلوماسي','role.lawyer':'محامٍ','role.spy':'استخبارات','role.act':'ناشط','role.journ':'صحفي','role.terror':'إرهابي',crime:'جريمة','crime.fraud':'احتيال','crime.terror':'إرهاب','crime.fin':'جريمة مالية','crime.theft':'سرقة','crime.war':'جرائم حرب','crime.traffick':'اتجار','crime.boss':'زعيم إجرامي','crime.cyber':'جريمة إلكترونية',debarment:'حظر تعاقد',wanted:'مطلوب',poi:'محل اهتمام','reg.action':'إجراء رقابي','reg.warn':'تحذير رقابي','export.control':'ضوابط تصدير','export.risk':'مخاطر تصدير','gov.soe':'مؤسسة مملوكة للدولة','gov.national':'حكومة وطنية','gov.state':'حكومة إقليمية','gov.muni':'حكومة محلية','gov.igo':'منظمة دولية','gov.head':'رئيس دولة/حكومة','gov.admin':'إدارة حكومية','gov.executive':'سلطة تنفيذية','gov.legislative':'سلطة تشريعية','gov.judicial':'سلطة قضائية',mil:'عسكري','fin.bank':'مصرف','fin':'مالي'},
 en:{sanction:'Sanctions','sanction.linked':'Sanctions-linked','sanction.counter':'Counter-sanctions','sanction.control':'Controlled by a sanctioned party','role.pep':'Politically exposed person (PEP)','role.pep.class.1':'PEP — Tier 1','role.pep.class.2':'PEP — Tier 2','role.pep.class.3':'PEP — Tier 3','role.rca':'Relative/associate of a PEP','role.oligarch':'Oligarch','role.judge':'Judge','role.diplo':'Diplomat','role.lawyer':'Lawyer','role.spy':'Intelligence','role.act':'Activist','role.journ':'Journalist','role.terror':'Terrorist',crime:'Crime','crime.fraud':'Fraud','crime.terror':'Terrorism','crime.fin':'Financial crime','crime.theft':'Theft','crime.war':'War crimes','crime.traffick':'Trafficking','crime.boss':'Crime boss','crime.cyber':'Cybercrime',debarment:'Debarment',wanted:'Wanted',poi:'Person of interest','reg.action':'Regulatory action','reg.warn':'Regulatory warning','export.control':'Export control','export.risk':'Export risk','gov.soe':'State-owned enterprise','gov.national':'National government','gov.state':'Regional government','gov.muni':'Local government','gov.igo':'International organization','gov.head':'Head of state/government','gov.admin':'Government administration','gov.executive':'Executive branch','gov.legislative':'Legislative branch','gov.judicial':'Judicial branch',mil:'Military','fin.bank':'Bank','fin':'Financial'},
};
const STATUS:Record<Locale,Record<string,string>> = {
 ar:{active:'نشط',inactive:'غير نشط',dissolved:'محلولة',current:'حالي',former:'سابق',ended:'منتهٍ',true:'نعم',false:'لا',yes:'نعم',no:'لا'},
 en:{active:'Active',inactive:'Inactive',dissolved:'Dissolved',current:'Current',former:'Former',ended:'Ended',true:'Yes',false:'No',yes:'Yes',no:'No'},
};
const SCHEMA:Record<Locale,Record<string,string>> = {
 ar:{Person:'شخص',Company:'شركة',Organization:'منظمة',LegalEntity:'كيان اعتباري',PublicBody:'جهة عامة',Vessel:'سفينة',Airplane:'طائرة',Address:'عنوان',Sanction:'إجراء عقوبات',Position:'منصب',Ownership:'ملكية',Directorship:'إدارة',Membership:'عضوية',Family:'علاقة عائلية',Associate:'علاقة',Identification:'وثيقة تعريف',Passport:'جواز سفر',Security:'ورقة مالية',Employment:'علاقة عمل'},
 en:{Person:'Person',Company:'Company',Organization:'Organization',LegalEntity:'Legal entity',PublicBody:'Public body',Vessel:'Vessel',Airplane:'Airplane',Address:'Address',Sanction:'Sanction',Position:'Position',Ownership:'Ownership',Directorship:'Directorship',Membership:'Membership',Family:'Family relationship',Associate:'Association',Identification:'ID document',Passport:'Passport',Security:'Security',Employment:'Employment'},
};
const GENDER:Record<Locale,Record<string,string>> = { ar:{male:'ذكر',female:'أنثى',other:'آخر'}, en:{male:'Male',female:'Female',other:'Other'} };
const ISO_DATE=/^\d{4}-\d{2}-\d{2}(?:[T\s][\d:.]+Z?)?$/;
const dateFmt = { ar: new Intl.DateTimeFormat('ar-AE',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Dubai'}), en: new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Dubai'}) };
export function formatDetailValue(key:string,value:string,locale:Locale='en'):string {
 const v=value.trim();if(!v)return v;
 if(/nationalit|countr|citizenship|jurisdiction/i.test(key)&&/^[A-Za-z]{2}$/.test(v)){try{const name=region[locale].of(v.toUpperCase())??v;const f=flagEmoji(v);return f?`${f} ${name}`:name;}catch{return v;}}
 if(/topic/i.test(key)){const t=TOPIC[locale];if(t[v])return t[v];const parts=v.split('.');for(let i=parts.length-1;i>0;i--){const p=t[parts.slice(0,i).join('.')];if(p)return p;}return v;}
 if(/schema/i.test(key))return SCHEMA[locale][v]??v;
 if(/gender/i.test(key))return GENDER[locale][v.toLowerCase()]??v;
 if(/^status$|Status$/.test(key))return STATUS[locale][v.toLowerCase()]??v;
 if(/date|birth|death|seen|change|listed|incorpor|dissolut|start|end|modified/i.test(key)&&ISO_DATE.test(v)){try{return dateFmt[locale].format(new Date(v));}catch{return v;}}
 return v;
}

const COUNTRY_NAME_MAP: Record<string, string> = {
  // 3-letter codes
  pak: 'PK', syr: 'SY', sdn: 'SD', are: 'AE', sau: 'SA', usa: 'US', gbr: 'GB', egy: 'EG',
  fra: 'FR', deu: 'DE', ita: 'IT', irn: 'IR', irq: 'IQ', yem: 'YE', lbn: 'LB', jor: 'JO',
  rus: 'RU', chn: 'CN', tur: 'TR', kwt: 'KW', qat: 'QA', bhr: 'BH', omn: 'OM', afg: 'AF',
  som: 'SO', lby: 'LY', tun: 'TN', dza: 'DZ', mar: 'MA', pse: 'PS', ind: 'IN', bfd: 'BF',
  // English names & demonyms
  pakistan: 'PK', pakistani: 'PK',
  sudan: 'SD', sudanese: 'SD',
  syria: 'SY', syrian: 'SY', 'syrian arab republic': 'SY',
  egypt: 'EG', egyptian: 'EG',
  'united arab emirates': 'AE', uae: 'AE', emirati: 'AE',
  'saudi arabia': 'SA', saudi: 'SA',
  yemen: 'YE', yemeni: 'YE',
  iraq: 'IQ', iraqi: 'IQ',
  iran: 'IR', iranian: 'IR', 'islamic republic of iran': 'IR',
  lebanon: 'LB', lebanese: 'LB',
  jordan: 'JO', jordanian: 'JO',
  kuwait: 'KW', kuwaiti: 'KW',
  qatar: 'QA', qatari: 'QA',
  bahrain: 'BH', bahraini: 'BH',
  oman: 'OM', omani: 'OM',
  'united kingdom': 'GB', british: 'GB', uk: 'GB',
  'united states': 'US', american: 'US', 'united states of america': 'US',
  russia: 'RU', russian: 'RU', 'russian federation': 'RU',
  china: 'CN', chinese: 'CN',
  france: 'FR', french: 'FR',
  germany: 'DE', german: 'DE',
  turkey: 'TR', turkish: 'TR',
  somalia: 'SO', somali: 'SO',
  libya: 'LY', libyan: 'LY',
  tunisia: 'TN', tunisian: 'TN',
  algeria: 'DZ', algerian: 'DZ',
  morocco: 'MA', moroccan: 'MA',
  palestine: 'PS', palestinian: 'PS',
  india: 'IN', indian: 'IN',
  // Arabic names & demonyms
  'باكستان': 'PK', 'باكستاني': 'PK',
  'السودان': 'SD', 'سوداني': 'SD',
  'سوريا': 'SY', 'سوري': 'SY',
  'مصر': 'EG', 'مصري': 'EG',
  'الإمارات': 'AE', 'الامارات': 'AE', 'إماراتي': 'AE', 'اماراتي': 'AE',
  'السعودية': 'SA', 'سعودي': 'SA',
  'اليمن': 'YE', 'يمني': 'YE',
  'العراق': 'IQ', 'عراقي': 'IQ',
  'إيران': 'IR', 'ايران': 'IR', 'إيراني': 'IR', 'ايراني': 'IR',
  'لبنان': 'LB', 'لبناني': 'LB',
  'الأردن': 'JO', 'الاردن': 'JO', 'أردني': 'JO', 'اردني': 'JO',
  'الكويت': 'KW', 'كويتي': 'KW',
  'قطر': 'QA', 'قطري': 'QA',
  'البحرين': 'BH', 'بحريني': 'BH',
  'عمان': 'OM', 'عُمان': 'OM', 'عماني': 'OM',
  'بريطانيا': 'GB', 'المملكة المتحدة': 'GB',
  'أمريكا': 'US', 'امريكا': 'US', 'الولايات المتحدة': 'US',
  'روسيا': 'RU', 'روسي': 'RU',
  'تركيا': 'TR', 'تركي': 'TR',
  'الصين': 'CN', 'صيني': 'CN',
  'فرنسا': 'FR', 'فرنسي': 'FR',
  'ألمانيا': 'DE', 'المانيا': 'DE', 'ألماني': 'DE',
  'فلسطين': 'PS', 'فلسطيني': 'PS',
};

export function normalizeCountryCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const clean = input.trim();
  if (/^[A-Za-z]{2}$/.test(clean)) return clean.toUpperCase();
  const lower = clean.toLowerCase();
  if (COUNTRY_NAME_MAP[lower]) return COUNTRY_NAME_MAP[lower];
  const noPunct = lower.replace(/[^\p{L}\d\s]/gu, '').trim();
  if (COUNTRY_NAME_MAP[noPunct]) return COUNTRY_NAME_MAP[noPunct];
  return /^[A-Za-z]{2}$/.test(clean) ? clean.toUpperCase() : null;
}

export function extractRecordCountry(details: unknown): string | null {
  if (!details || typeof details !== 'object') return null;
  const d = details as Record<string, unknown>;
  const keys = [
    'country', 'countries', 'nationality', 'citizenship', 'jurisdiction',
    'NATIONALITY', 'COUNTRY', 'Country', 'Nationality', 'Citizenship',
    'Country of Birth', 'countryOfBirth', 'residence', 'addressCountry'
  ];
  for (const k of keys) {
    const val = d[k];
    if (Array.isArray(val) && val.length > 0) {
      for (const item of val) {
        const str = String(item).trim();
        const norm = normalizeCountryCode(str);
        if (norm) return norm;
        if (str.length === 2) return str.toUpperCase();
      }
    } else if (typeof val === 'string' && val.trim()) {
      const norm = normalizeCountryCode(val.trim());
      if (norm) return norm;
      if (val.trim().length === 2) return val.trim().toUpperCase();
    }
  }
  return null;
}

export function extractRecordDob(details: unknown): string | null {
  if (!details || typeof details !== 'object') return null;
  const d = details as Record<string, unknown>;
  const keys = [
    'birthDate', 'birth_date', 'dateOfBirth', 'incorporationDate', 'foundingDate',
    'DOB', 'INDIVIDUAL_DATE_OF_BIRTH', 'DATE_OF_BIRTH', 'DATE', 'YEAR', 'year', 'Year of Birth'
  ];
  for (const k of keys) {
    const val = d[k];
    if (Array.isArray(val) && val.length > 0) {
      for (const item of val) {
        if (typeof item === 'string' && item.trim()) return item.trim();
        if (item && typeof item === 'object') {
          const sub = (item as Record<string, unknown>).DATE || (item as Record<string, unknown>).YEAR;
          if (sub) return String(sub).trim();
        }
      }
    } else if (typeof val === 'string' && val.trim()) {
      return val.trim();
    } else if (typeof val === 'number') {
      return String(val);
    }
  }
  return null;
}

export function extractRecordIdentifier(details: unknown, fallbackId?: string): string | null {
  if (details && typeof details === 'object') {
    const d = details as Record<string, unknown>;
    const keys = [
      'passportNumber', 'idNumber', 'taxNumber', 'registrationNumber', 'leiCode',
      'REFERENCE_NUMBER', 'Passport Number', 'National Identification Number', 'National ID',
      'INDIVIDUAL_DOCUMENT', 'NUMBER'
    ];
    for (const k of keys) {
      const val = d[k];
      if (Array.isArray(val) && val.length > 0) {
        for (const item of val) {
          if (typeof item === 'string' && item.trim()) return item.trim();
          if (item && typeof item === 'object') {
            const sub = (item as Record<string, unknown>).NUMBER || (item as Record<string, unknown>).number;
            if (sub) return String(sub).trim();
          }
        }
      } else if (typeof val === 'string' && val.trim()) {
        return val.trim();
      }
    }
    if (Array.isArray(d.identification)) {
      for (const item of d.identification) {
        if (typeof item === 'string' && item.trim()) return item.trim();
        if (item && typeof item === 'object' && (item as Record<string, unknown>).number) {
          const num = String((item as Record<string, unknown>).number).trim();
          if (num) return num;
        }
      }
    }
    if (Array.isArray(d.identifiers)) {
      for (const item of d.identifiers) {
        if (typeof item === 'string' && item.trim()) return item.trim();
      }
    }
  }
  if (fallbackId && fallbackId.trim()) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fallbackId.trim());
    if (!isUuid) return fallbackId.trim();
  }
  return null;
}

export function extractRecordAliases(record: { aliases?: string[]; details?: unknown; name?: string }): string[] {
 const result: string[] = [];
 const baseName = (record.name || '').trim().toLowerCase();
 const seen = new Set<string>();
 if (baseName) seen.add(baseName);

 const add = (s: unknown) => {
  if (typeof s !== 'string') return;
  const str = s.trim();
  if (!str || seen.has(str.toLowerCase())) return;
  seen.add(str.toLowerCase());
  result.push(str);
 };

 if (Array.isArray(record.aliases)) {
  for (const a of record.aliases) add(a);
 }
 if (record.details && typeof record.details === 'object') {
  const d = record.details as Record<string, unknown>;
  const keys = ['alias', 'weakAlias', 'previousName', 'NAME_ORIGINAL_SCRIPT'];
  for (const k of keys) {
   const val = d[k];
   if (Array.isArray(val)) val.forEach(add);
   else if (typeof val === 'string') add(val);
  }
 }
 return result;
}

