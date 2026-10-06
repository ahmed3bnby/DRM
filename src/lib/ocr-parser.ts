// ICAO Doc 9303 MRZ and Document Heuristic Parser
// Supports: International Passports (TD3), Emirates ID & ID Cards (TD1), and UAE Trade Licenses.

export interface ExtractedDocData {
  documentType: 'EMIRATES_ID' | 'PASSPORT' | 'TRADE_LICENSE' | 'NATIONAL_ID' | 'OTHER';
  entityType: 'individual' | 'company';
  name: string;
  nameAr?: string;
  nameEn?: string;
  country: string;
  nationality?: string;
  dateOfBirth?: string;
  identifier?: string;
  industry?: string;
  gender?: 'male' | 'female';
  expiryDate?: string;
  confidence: number;
  rawText?: string;
  summary: string;
}

// 1. Comprehensive ICAO 3-letter & Nationality mapping to ISO 2-letter country codes
const ICAO_TO_ISO2: Record<string, string> = {
  ARE: 'AE', SAU: 'SA', QAT: 'QA', KWT: 'KW', BHR: 'BH', OMN: 'OM',
  EGY: 'EG', PAK: 'PK', IND: 'IN', USA: 'US', GBR: 'GB', RUS: 'RU',
  SYR: 'SY', LBN: 'LB', JOR: 'JO', IRQ: 'IQ', IRN: 'IR', TUR: 'TR',
  CHN: 'CN', CAN: 'CA', AUS: 'AU', FRA: 'FR', DEU: 'DE', ITA: 'IT',
  ESP: 'ES', NLD: 'NL', CHE: 'CH', SWE: 'SE', NOR: 'NO', DNK: 'DK',
  BEL: 'BE', AUT: 'AT', POL: 'PL', UKR: 'UA', ZAF: 'ZA', NGA: 'NG',
  KEN: 'KE', BRA: 'BR', ARG: 'AR', MEX: 'MX', JPN: 'JP', KOR: 'KR',
  SGP: 'SG', MYS: 'MY', IDN: 'ID', PHL: 'PH', BGD: 'BD', LKA: 'LK',
  AFG: 'AF', YEM: 'YE', SDN: 'SD', MAR: 'MA', DZA: 'DZ', TUN: 'TN',
  LBY: 'LY', SOM: 'SO', PSE: 'PS'
};

const NATIONALITY_TEXT_MAP: Record<string, string> = {
  'emirati': 'AE', 'uae': 'AE', 'united arab emirates': 'AE', 'إماراتي': 'AE', 'الإمارات': 'AE',
  'saudi': 'SA', 'saudi arabia': 'SA', 'سعودي': 'SA', 'المملكة العربية السعودية': 'SA',
  'egyptian': 'EG', 'egypt': 'EG', 'مصري': 'EG', 'مصر': 'EG',
  'pakistani': 'PK', 'pakistan': 'PK', 'باكستاني': 'PK', 'باكستان': 'PK',
  'indian': 'IN', 'india': 'IN', 'هندي': 'IN', 'الهند': 'IN',
  'british': 'GB', 'united kingdom': 'GB', 'بريطاني': 'GB', 'المملكة المتحدة': 'GB',
  'american': 'US', 'united states': 'US', 'أمريكي': 'US', 'الولايات المتحدة': 'US',
  'russian': 'RU', 'russia': 'RU', 'روسي': 'RU', 'روسيا': 'RU',
  'syrian': 'SY', 'syria': 'SY', 'سوري': 'SY', 'سوريا': 'SY',
  'jordanian': 'JO', 'jordan': 'JO', 'أردني': 'JO', 'الأردن': 'JO',
  'lebanese': 'LB', 'lebanon': 'LB', 'لبناني': 'LB', 'لبنان': 'LB',
  'iraqi': 'IQ', 'iraq': 'IQ', 'عراقي': 'IQ', 'العراق': 'IQ',
  'qatari': 'QA', 'qatar': 'QA', 'قطري': 'QA', 'قطر': 'QA',
  'kuwaiti': 'KW', 'kuwait': 'KW', 'كويتي': 'KW', 'الكويت': 'KW',
  'bahraini': 'BH', 'bahrain': 'BH', 'بحريني': 'BH', 'البحرين': 'BH',
  'omani': 'OM', 'oman': 'OM', 'عماني': 'OM', 'عُمان': 'OM',
  'canadian': 'CA', 'canada': 'CA', 'كندي': 'CA',
  'french': 'FR', 'france': 'FR', 'فرنسي': 'FR',
  'german': 'DE', 'germany': 'DE', 'ألماني': 'DE'
};

export function mapCountryCode(input?: string): string | undefined {
  if (!input) return undefined;
  const clean = input.trim().toUpperCase();
  if (clean.length === 2) return clean;
  if (clean.length === 3 && ICAO_TO_ISO2[clean]) return ICAO_TO_ISO2[clean];
  
  const lower = input.trim().toLowerCase();
  for (const [key, code] of Object.entries(NATIONALITY_TEXT_MAP)) {
    if (lower.includes(key)) return code;
  }
  return undefined;
}

function parseMRZDate(raw: string, kind: 'dob' | 'expiry' = 'dob'): string {
  if (!raw || raw.length !== 6 || !/^\d{6}$/.test(raw)) return '';
  const currentYear = new Date().getFullYear() % 100;
  const yy = parseInt(raw.substring(0, 2), 10);
  // DOB is in the past, so a 2-digit year above the current year must be 19xx.
  // Expiry is in the (near) future, so it is 20xx for the realistic document range
  // (yy 00–69 → 20xx); without this split, an expiry of 2028 would parse as 1928.
  const century = kind === 'expiry'
    ? (yy < 70 ? '20' : '19')
    : (yy > currentYear ? '19' : '20');
  const mm = raw.substring(2, 4);
  const dd = raw.substring(4, 6);
  return `${century}${raw.substring(0, 2)}-${mm}-${dd}`;
}

/**
 * 2. ICAO 9303 MRZ Engine (Passports TD3 & Emirates ID/Cards TD1)
 */
export function parseMRZ(text: string): Partial<ExtractedDocData> | null {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.replace(/[^A-Z0-9<]/g, '').trim())
    .filter(l => l.length >= 28);

  // A. TD3 (Passport: 2 lines of 44 characters)
  const td3Line1 = lines.find(l => l.length === 44 && (l.startsWith('P<') || l.startsWith('P')));
  const td3Line2 = lines.find(l => l.length === 44 && l !== td3Line1 && /[0-9]/.test(l));

  if (td3Line1 && td3Line2) {
    const issuingIcao = td3Line1.substring(2, 5);
    const nameSection = td3Line1.substring(5);
    const nameParts = nameSection.split('<<');
    const surname = nameParts[0].replace(/</g, ' ').trim();
    const givenNames = (nameParts[1] || '').replace(/</g, ' ').trim();
    const fullName = `${givenNames} ${surname}`.trim();

    const docNumber = td3Line2.substring(0, 9).replace(/</g, '').trim();
    const nationalityIcao = td3Line2.substring(10, 13);
    const rawDob = td3Line2.substring(13, 19);
    const genderRaw = td3Line2.substring(20, 21);
    const rawExpiry = td3Line2.substring(21, 27);

    const nationality = mapCountryCode(nationalityIcao) || 'OTHER';
    const country = mapCountryCode(issuingIcao) || nationality || 'AE';

    return {
      documentType: 'PASSPORT',
      entityType: 'individual',
      name: fullName,
      nameEn: fullName,
      identifier: docNumber,
      country,
      nationality,
      dateOfBirth: parseMRZDate(rawDob),
      expiryDate: parseMRZDate(rawExpiry, 'expiry'),
      gender: genderRaw === 'M' ? 'male' : genderRaw === 'F' ? 'female' : undefined,
      confidence: 96,
      summary: `جواز سفر (${docNumber}) - ${fullName}`
    };
  }

  // B. TD1 (Emirates ID / National ID: 3 lines of 30 characters)
  const td1Lines = lines.filter(l => l.length === 30);
  if (td1Lines.length >= 3) {
    const l1 = td1Lines[0];
    const l2 = td1Lines[1];
    const l3 = td1Lines[2];

    const issuingIcao = l1.substring(2, 5);
    const docNumber = l1.substring(5, 14).replace(/</g, '').trim();

    const rawDob = l2.substring(0, 6);
    const genderRaw = l2.substring(7, 8);
    const rawExpiry = l2.substring(8, 14);
    const nationalityIcao = l2.substring(15, 18);

    const nameParts = l3.split('<<');
    const surname = nameParts[0].replace(/</g, ' ').trim();
    const givenNames = (nameParts[1] || '').replace(/</g, ' ').trim();
    const fullName = `${givenNames} ${surname}`.trim();

    const isEmirates = issuingIcao === 'ARE';
    const nationality = mapCountryCode(nationalityIcao) || (isEmirates ? 'AE' : undefined);
    // On an Emirates ID, positions 5–13 are the CARD serial number. The 15-digit Emirates ID
    // number (784YYYYNNNNNNNC) is in the optional-data field of line 1 — that is the KYC identifier.
    const eidFromMrz = isEmirates ? l1.substring(15).replace(/</g, '').match(/784\d{12}/)?.[0] : undefined;

    return {
      documentType: isEmirates ? 'EMIRATES_ID' : 'NATIONAL_ID',
      entityType: 'individual',
      name: fullName,
      nameEn: fullName,
      identifier: eidFromMrz ? formatEmiratesId(eidFromMrz) : docNumber,
      country: isEmirates ? 'AE' : (mapCountryCode(issuingIcao) || 'AE'),
      nationality,
      dateOfBirth: parseMRZDate(rawDob),
      expiryDate: parseMRZDate(rawExpiry, 'expiry'),
      gender: genderRaw === 'M' ? 'male' : genderRaw === 'F' ? 'female' : undefined,
      confidence: 98,
      summary: `${isEmirates ? 'بطاقة هوية إماراتية' : 'بطاقة هوية وطنية'} - ${fullName}`
    };
  }

  return null;
}

/**
 * 3. Emirates ID Front Heuristic Parser
 */
export function parseEmiratesIdFront(text: string): Partial<ExtractedDocData> | null {
  // Regex for Emirates ID Number: 784-YYYY-XXXXXXX-X
  const eidMatch = text.match(/784[-\s]?[0-9]{4}[-\s]?[0-9]{7}[-\s]?[0-9]/);
  if (!eidMatch && !text.includes('Identity Card') && !text.includes('بطاقة هوية') && !text.includes('UNITED ARAB EMIRATES')) {
    return null;
  }

  const eid = eidMatch ? formatEmiratesId(eidMatch[0]) : undefined;

  // Extract DOB: DD/MM/YYYY or DD-MM-YYYY
  let dob: string | undefined;
  const dobMatch = text.match(/(?:DOB|Date of Birth|تاريخ الميلاد)[\s:]*([0-3]?[0-9][\/\-.][0-1]?[0-9][\/\-.][1-2][0-9]{3})/i)
    || text.match(/\b([0-3][0-9][\/\-.][0-1][0-9][\/\-.](?:19|20)[0-9]{2})\b/);

  if (dobMatch) {
    const parts = dobMatch[1].split(/[\/\-.]/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      dob = `${year}-${month}-${day}`;
    }
  }

  // Extract Arabic & English Names
  let nameAr: string | undefined;
  let nameEn: string | undefined;

  const arMatch = text.match(/(?:الاسم)[\s:]*([\u0600-\u06FF\s]{4,50})/);
  if (arMatch) {
    nameAr = arMatch[1].replace(/(?:الجنسية|تاريخ|رقم|الهوية)[\s\S]*/, '').trim();
  }

  const enMatch = text.match(/(?:Name)[\s:]*([A-Za-z\s]{4,50})/i);
  if (enMatch) {
    nameEn = enMatch[1].replace(/(?:Nationality|DOB|Date|ID|Card)[\s\S]*/i, '').trim();
  }

  // Extract Nationality
  let nationality: string | undefined;
  for (const [key, code] of Object.entries(NATIONALITY_TEXT_MAP)) {
    if (text.toLowerCase().includes(key)) {
      nationality = code;
      break;
    }
  }

  const bestName = nameEn || nameAr || 'Emirates ID Holder';

  return {
    documentType: 'EMIRATES_ID',
    entityType: 'individual',
    name: bestName,
    nameAr,
    nameEn,
    identifier: eid,
    country: 'AE',
    nationality: nationality || 'AE',
    dateOfBirth: dob,
    confidence: eid ? 95 : 85,
    summary: `بطاقة هوية إماراتية (${eid || '784-...'}) - ${bestName}`
  };
}

/**
 * 4. UAE Trade / Commercial License Parser
 */
export function parseTradeLicense(text: string): Partial<ExtractedDocData> | null {
  const isLicense = /(?:رخصة\s*تجارية|Commercial\s*License|Trade\s*License|Economic\s*Development|دائرة\s*التنمية\s*الاقتصادية)/i.test(text);
  if (!isLicense && !/(?:رقم\s*الرخصة|License\s*No|CR\s*Number)/i.test(text)) {
    return null;
  }

  // License Number
  const licMatch = text.match(/(?:License\s*(?:No|Number)|رقم\s*الرخصة)[\s:]*([A-Za-z0-9\-_]{4,25})/i)
    || text.match(/\b(CN-[0-9]{5,10}|[0-9]{6,8})\b/);
  const licNumber = licMatch ? licMatch[1].trim() : undefined;

  // Company Name (English / Arabic)
  let nameEn: string | undefined;
  let nameAr: string | undefined;

  // [ \t] not \s: a name never continues onto the next line ("…L.L.C\nLegal Type").
  const enMatch = text.match(/(?:Trade[ \t]*Name|Company[ \t]*Name|Legal[ \t]*Name)[ \t]*:?[ \t]*([A-Za-z0-9 \t.,&'\-]{4,80})/i);
  if (enMatch) {
    nameEn = enMatch[1].replace(/(?:License|Activity|Issue|Expiry|DED)[\s\S]*/i, '').trim();
  }

  const arMatch = text.match(/(?:الاسم[ \t]*التجاري|اسم[ \t]*الشركة)[ \t]*:?[ \t]*([\u0600-\u06FF0-9 \t.,\-]{4,80})/);
  if (arMatch) {
    nameAr = arMatch[1].replace(/(?:رقم|تاريخ|النشاط|الشكل)[\s\S]*/, '').trim();
  }

  // Activity / Industry
  let industry: string | undefined;
  const actMatch = text.match(/(?:Activity|Activities|النشاط|الأنشطة)[\s:]*([^\n\r]{4,100})/i);
  if (actMatch) {
    industry = actMatch[1].trim();
  }

  const companyName = nameEn || nameAr || 'UAE Registered Entity';

  return {
    documentType: 'TRADE_LICENSE',
    entityType: 'company',
    name: companyName,
    nameEn,
    nameAr,
    identifier: licNumber,
    country: 'AE',
    nationality: 'AE',
    industry: industry || 'Commercial & Corporate Services',
    confidence: licNumber ? 95 : 85,
    summary: `رخصة تجارية إماراتية (${licNumber || 'CR'}) - ${companyName}`
  };
}

/**
 * 5. Full Multi-Modal Document Text Analyzer
 */
// 784YYYYNNNNNNNC → 784-YYYY-NNNNNNN-C (the format printed on the card).
function formatEmiratesId(raw: string): string {
  const d = raw.replace(/\D/g, '');
  return d.length === 15 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 14)}-${d.slice(14)}` : raw;
}

export function analyzeDocumentText(rawText: string): ExtractedDocData {
  const clean = rawText.trim();

  // Try 1: ICAO MRZ Parser (Gold Standard)
  const mrz = parseMRZ(clean);
  if (mrz && mrz.name && mrz.name.length >= 2) {
    if (mrz.documentType === 'EMIRATES_ID') {
      const printed = clean.match(/784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d/)?.[0];
      if (printed) mrz.identifier = formatEmiratesId(printed);
    }
    return {
      documentType: mrz.documentType || 'PASSPORT',
      entityType: mrz.entityType || 'individual',
      name: mrz.name,
      nameEn: mrz.nameEn,
      nameAr: mrz.nameAr,
      country: mrz.country || 'AE',
      nationality: mrz.nationality || 'AE',
      dateOfBirth: mrz.dateOfBirth,
      identifier: mrz.identifier,
      expiryDate: mrz.expiryDate,
      gender: mrz.gender,
      confidence: mrz.confidence || 95,
      rawText: clean,
      summary: mrz.summary || `مستند تم فحصه - ${mrz.name}`
    };
  }

  // Try 2: Emirates ID Front Parser
  const eid = parseEmiratesIdFront(clean);
  if (eid && eid.name && eid.name.length >= 2) {
    return {
      documentType: 'EMIRATES_ID',
      entityType: 'individual',
      name: eid.name,
      nameAr: eid.nameAr,
      nameEn: eid.nameEn,
      country: eid.country || 'AE',
      nationality: eid.nationality || 'AE',
      dateOfBirth: eid.dateOfBirth,
      identifier: eid.identifier,
      confidence: eid.confidence || 90,
      rawText: clean,
      summary: eid.summary || `بطاقة هوية إماراتية - ${eid.name}`
    };
  }

  // Try 3: UAE Trade License
  const license = parseTradeLicense(clean);
  if (license && license.name && license.name.length >= 2) {
    return {
      documentType: 'TRADE_LICENSE',
      entityType: 'company',
      name: license.name,
      nameEn: license.nameEn,
      nameAr: license.nameAr,
      country: license.country || 'AE',
      nationality: license.nationality || 'AE',
      identifier: license.identifier,
      industry: license.industry,
      confidence: license.confidence || 90,
      rawText: clean,
      summary: license.summary || `رخصة تجارية - ${license.name}`
    };
  }

  // Fallback: Generic Extraction
  const words = clean.split(/\s+/).filter(w => w.length > 2);
  const fallbackName = words.slice(0, 3).join(' ') || 'Unidentified Profile';

  return {
    documentType: 'OTHER',
    entityType: 'individual',
    name: fallbackName,
    country: 'AE',
    nationality: 'AE',
    confidence: 60,
    rawText: clean,
    summary: `مستند عام تم تحليله - ${fallbackName}`
  };
}

/**
 * 6. Built-in Realistic Test Demo Presets
 * Allows 1-click instant live demonstration during presentations.
 */
export const OCR_DEMO_PRESETS: Record<string, ExtractedDocData> = {
  'emirates-id': {
    documentType: 'EMIRATES_ID',
    entityType: 'individual',
    name: 'Hamza Rizwan',
    nameAr: 'حمزة رضوان',
    nameEn: 'Hamza Rizwan',
    country: 'AE',
    nationality: 'PK',
    dateOfBirth: '1991-07-11',
    identifier: '784-1991-1545288-1',
    gender: 'male',
    expiryDate: '2028-06-30',
    confidence: 99,
    summary: 'بطاقة هوية إماراتية رسمية (784-1991-1545288-1) - Hamza Rizwan'
  },
  'passport': {
    documentType: 'PASSPORT',
    entityType: 'individual',
    name: 'Anna Maria Eriksson',
    nameEn: 'Anna Maria Eriksson',
    country: 'SE',
    nationality: 'SE',
    dateOfBirth: '1974-08-12',
    identifier: 'L898902C3',
    gender: 'female',
    expiryDate: '2030-04-15',
    confidence: 98,
    summary: 'جواز سفر دولي مقروء آلياً (L898902C3) - Anna Maria Eriksson'
  },
  'trade-license': {
    documentType: 'TRADE_LICENSE',
    entityType: 'company',
    name: 'Cube Realty Real Estate LLC',
    nameAr: 'كيوب العقارية ش.ذ.م.م',
    nameEn: 'Cube Realty Real Estate LLC',
    country: 'AE',
    nationality: 'AE',
    identifier: 'CN-1545288',
    industry: 'Real Estate Buying & Selling Brokerage',
    confidence: 98,
    summary: 'رخصة تجارية صادرة من دائرة التنمية الاقتصادية - Cube Realty Real Estate LLC'
  }
};
