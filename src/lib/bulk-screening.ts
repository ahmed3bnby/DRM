import * as XLSX from 'xlsx';
import { searchPublicSources } from '@/lib/search';
import { evaluateFATFJurisdiction } from '@/lib/fatf';
import { consumeSearch, quotaStatus } from '@/lib/team';
import type { Actor } from '@/lib/auth';

export interface BulkInputRow {
  rowNumber: number;
  name: string;
  country?: string;
  identifier?: string;
  entityType?: 'individual' | 'company';
  notes?: string;
}

export interface BulkScreeningResult {
  rowNumber: number;
  name: string;
  country?: string;
  identifier?: string;
  entityType?: 'individual' | 'company';
  status: 'clear' | 'flagged';
  riskBand: 'none' | 'low' | 'medium' | 'high';
  matchCount: number;
  maxScore: number;
  topMatchName?: string;
  topMatchSource?: string;
  categories: string[];
  fatfRating: 'blacklist' | 'greylist' | 'standard';
  fatfTitleEn: string;
  summary: string;
}

export function parseBulkFile(buffer: Buffer): BulkInputRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('الملف لا يحتوي على أي صفحات بيانات (Empty Workbook)');

  const sheet = workbook.Sheets[firstSheetName];
  const rows: (string | number)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (rows.length < 2) throw new Error('الملف لا يحتوي على بيانات كافية للفحص');

  // Identify column headers
  const headerRow = rows[0].map(c => String(c || '').trim().toLowerCase());
  let nameCol = headerRow.findIndex(h => /name|الاسم|اسم|entity/i.test(h));
  let countryCol = headerRow.findIndex(h => /country|دولة|بلد|nationality|جنسية/i.test(h));
  let idCol = headerRow.findIndex(h => /id|هوية|جواز|passport|license|رخصة/i.test(h));
  let typeCol = headerRow.findIndex(h => /type|نوع/i.test(h));

  if (nameCol === -1) nameCol = 0; // Default to first column

  const results: BulkInputRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[nameCol]) continue;
    const rawName = String(row[nameCol]).trim();
    if (rawName.length < 2) continue;

    const country = countryCol !== -1 && row[countryCol] ? String(row[countryCol]).trim() : undefined;
    const identifier = idCol !== -1 && row[idCol] ? String(row[idCol]).trim() : undefined;
    const rawType = typeCol !== -1 && row[typeCol] ? String(row[typeCol]).trim().toLowerCase() : '';
    const entityType = /company|corp|شركة|مؤسسة/i.test(rawType) ? 'company' : 'individual';

    results.push({
      rowNumber: i + 1,
      name: rawName,
      country,
      identifier,
      entityType
    });

    if (results.length >= 500) break; // Limit single batch to 500 records
  }

  if (results.length === 0) throw new Error('لم يتم العثور على أي أسماء صالحة للفحص في الملف');
  return results;
}

export function generateTemplateWorkbook(): Buffer {
  const wsData = [
    ['Full Name / الاسم الكامل', 'Country Code / كود الدولة (مثال: AE, PK, GB)', 'ID or License / رقم الهوية أو الرخصة', 'Entity Type / النوع (individual أو company)'],
    ['Hamza Rizwan', 'PK', '1545288819', 'individual'],
    ['Mohamed Al Mansoori', 'AE', '784-1990-1234567-1', 'individual'],
    ['Alpha Horizon General Trading LLC', 'AE', 'CN-982144', 'company'],
    ['Caspian Maritime Lines', 'IR', 'IMO-8812301', 'company']
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  // Column widths
  ws['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 30 }, { wch: 20 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DRM_Screening_Template');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export async function runBulkScreening(
  actor: Pick<Actor, 'id' | 'organizationId' | 'features'>,
  items: BulkInputRow[]
): Promise<{
  total: number;
  flagged: number;
  clear: number;
  results: BulkScreeningResult[];
}> {
  // Check quota
  const currentQuota = await quotaStatus(actor);
  if (currentQuota.remaining !== null && currentQuota.remaining < items.length) {
    throw new Error(`رصيد عمليات البحث المتبقي (${currentQuota.remaining}) لا يكفي لفحص ${items.length} اسماً. يرجى ترقية الرصيد أو تقليل عدد الأسماء.`);
  }

  const results: BulkScreeningResult[] = [];
  let flaggedCount = 0;

  for (const item of items) {
    // Deduct search
    await consumeSearch(actor, `bulk:${Date.now()}:${item.rowNumber}`, item.name);

    // Run search
    const matches = await searchPublicSources(item.name, 10);
    const fatf = evaluateFATFJurisdiction(item.country);

    // Filter relevant matches
    const relevant = matches.filter(m => m.name_similarity >= 0.70);
    const top = relevant[0];

    const hasMatches = relevant.length > 0;
    const maxScore = top ? Math.round(top.name_similarity * 100) : 0;
    const isHighOrMedium = maxScore >= 80 || fatf.rating === 'blacklist';

    const categories = Array.from(new Set(relevant.map(m => m.kind || 'sanctions')));

    if (hasMatches || fatf.rating === 'blacklist') {
      flaggedCount++;
    }

    results.push({
      rowNumber: item.rowNumber,
      name: item.name,
      country: item.country,
      identifier: item.identifier,
      entityType: item.entityType,
      status: (hasMatches || fatf.rating === 'blacklist') ? 'flagged' : 'clear',
      riskBand: isHighOrMedium ? 'high' : hasMatches ? 'medium' : 'low',
      matchCount: relevant.length,
      maxScore,
      topMatchName: top?.name,
      topMatchSource: top?.code,
      categories,
      fatfRating: fatf.rating,
      fatfTitleEn: fatf.titleEn,
      summary: hasMatches
        ? `Found ${relevant.length} matches (Max similarity: ${maxScore}%) on ${top?.code || 'watchlist'}`
        : 'Clean / No watchlist matches found'
    });
  }

  return {
    total: items.length,
    flagged: flaggedCount,
    clear: items.length - flaggedCount,
    results
  };
}

export function exportResultsToExcel(results: BulkScreeningResult[]): Buffer {
  const headers = [
    'Row #',
    'Subject Name / اسم العميل',
    'Screening Status / الحالة',
    'Risk Band / مستوى الخطر',
    'Matches Count / عدد المطابقات',
    'Max Similarity / أعلى نسبة تطابق',
    'Top Watchlist Match / أول تطابق',
    'Source List / القائمة',
    'Watchlist Categories / التصنيف',
    'Country Code / الدولة',
    'FATF Risk Level / مخاطر الدولة FATF',
    'Compliance Summary / ملخص الامتثال'
  ];

  const rows = results.map(r => [
    r.rowNumber,
    r.name,
    r.status === 'clear' ? 'CLEAR (سليم)' : 'FLAGGED (مطابقة محتملة)',
    r.riskBand.toUpperCase(),
    r.matchCount,
    r.maxScore > 0 ? `${r.maxScore}%` : '0%',
    r.topMatchName || '—',
    r.topMatchSource || '—',
    r.categories.join(', ') || '—',
    r.country || '—',
    r.fatfTitleEn,
    r.summary
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 8 }, { wch: 30 }, { wch: 22 }, { wch: 14 },
    { wch: 14 }, { wch: 18 }, { wch: 30 }, { wch: 18 },
    { wch: 22 }, { wch: 12 }, { wch: 35 }, { wch: 45 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Screening_Results');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
