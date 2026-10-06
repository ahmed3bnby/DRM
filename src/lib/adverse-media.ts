import { z } from 'zod';

// Adverse-media and Global Public News Research Engine
// Uses Google News RSS (multilingual: Arabic + Latin) with strict entity-name verification
// and GDELT fallback to eliminate unrelated results and false positives.

export type AdverseCategory =
  | 'sanctions'
  | 'laundering'
  | 'fraud'
  | 'corruption'
  | 'terrorism'
  | 'crime'
  | 'regulatory'
  | 'other';

export type AdverseArticle = {
  title: string;
  url: string;
  domain: string;
  date: string;
  category: AdverseCategory;
  source?: string;
  snippet?: string;
};

const ARABIC_ADVERSE_TERMS = [
  'احتيال', 'غسيل أموال', 'غسل أموال', 'فساد', 'رشوة', 'محاكمة', 'جنايات',
  'إرهاب', 'اختلاس', 'حبس', 'سجن', 'مطلوب', 'قضية', 'هروب', 'عقوبات',
  'نصب', 'مصادرة', 'أمر ضبط', 'استيلاء'
];

const ENGLISH_ADVERSE_TERMS = [
  'fraud', 'money laundering', 'corruption', 'bribery', 'sanctions',
  'terrorism', 'terrorist', 'arrested', 'convicted', 'indicted',
  'court', 'embezzlement', 'wanted', 'fugitive', 'criminal', 'scam'
];

const CATS: [RegExp, AdverseCategory][] = [
  [/sanction|عقوبات|حظر|تجميد\s*أموال/i, 'sanctions'],
  [/launder|money\s*laundering|غسيل\s*أموال|غسل\s*أموال/i, 'laundering'],
  [/fraud|scam|embezzl|ponzi|احتيال|نصب|اختلاس|استيلاء/i, 'fraud'],
  [/bribe|corrupt|رشوة|فساد|ارتشاء|تربح/i, 'corruption'],
  [/terror|إرهاب|داعش|تنظيم\s*إرهابي/i, 'terrorism'],
  [/regulatory|fine|penalty|sec\b|fca\b|dfsa\b|غرامة|مخالفة|عقوبة\s*مالية/i, 'regulatory'],
  [/traffick|smuggl|narcotic|\bdrug|arrest|convict|indict|charged|court|criminal|prison|jail|تهريب|مخدرات|محاكمة|جنائي|سجن|حبس|هروب|مطلوب|تسليم\s*مجرمين|ملاحقة/i, 'crime'],
];

export const classifyArticle = (text: string): AdverseCategory => {
  for (const [re, c] of CATS) {
    if (re.test(text)) return c;
  }
  return 'other';
};

function normalizeAr(text: string): string {
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/[-_.,;:!?()"'`\\/«»“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLat(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_.,;:!?()"'`\\/«»“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts searchable journalistic name variants for long compound names.
 */
export function extractNameVariants(name: string): { full: string; variants: string[] } {
  const isArabic = /[\u0600-\u06FF]/.test(name);
  const clean = isArabic ? normalizeAr(name) : normalizeLat(name);
  const tokens = clean.split(/\s+/).filter(w => w.length >= 2);
  const variants: string[] = [];

  if (tokens.length >= 3) {
    // 1. First 2 tokens (e.g. "محمد خيرت")
    const firstTwo = tokens.slice(0, 2).join(' ');
    if (firstTwo.length >= 5) variants.push(firstTwo);

    // 2. First + Last (e.g. "محمد الشاطر")
    const firstLast = `${tokens[0]} ${tokens[tokens.length - 1]}`;
    if (firstLast.length >= 5) variants.push(firstLast);

    // 3. Second + Last (e.g. "خيرت الشاطر")
    const secondLast = `${tokens[1]} ${tokens[tokens.length - 1]}`;
    if (secondLast.length >= 5) variants.push(secondLast);

    // 4. First 2 + Last (e.g. "محمد خيرت الشاطر")
    if (tokens.length >= 4) {
      const firstTwoLast = `${tokens.slice(0, 2).join(' ')} ${tokens[tokens.length - 1]}`;
      if (firstTwoLast.length >= 6) variants.push(firstTwoLast);
    }
  }

  return { full: name, variants: [...new Set(variants)] };
}

/**
 * Builds a strict name-verification matcher to prevent false positives
 * while supporting natural journalistic name variants for long compound names.
 */
export function buildNameMatcher(name: string): (text: string) => boolean {
  const isArabic = /[\u0600-\u06FF]/.test(name);
  const { variants } = extractNameVariants(name);

  if (!isArabic) {
    const clean = normalizeLat(name);
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
      return (text: string) => new RegExp(`\\b${parts[0]}\\b`, 'i').test(normalizeLat(text));
    }
    const regex = new RegExp(`\\b${parts[0]}\\b(?:\\s+\\w+){0,3}\\s+\\b${parts[parts.length - 1]}\\b`, 'i');
    const normVariants = variants.map(v => normalizeLat(v)).filter(Boolean);
    return (text: string) => {
      const norm = normalizeLat(text);
      if (norm.includes(clean) || regex.test(norm)) return true;
      for (const v of normVariants) {
        if (norm.includes(v)) return true;
      }
      return false;
    };
  }

  const normName = normalizeAr(name);
  const words = normName.split(/\s+/).filter(w => w.length > 1);

  if (words.length <= 1) {
    return (text: string) => normalizeAr(text).includes(normName);
  }

  // Multi-word Arabic names:
  // Must match exact normalized sequence or with typical Arabic connectives (بن, ابن, ال, آل, عبد, ابو)
  const pattern = words.join('(?:\\s+(?:بن|ابن|ال|آل|ابو|عبد)?\\s*|\\s+)');
  const connectiveRegex = new RegExp(`(?:^|\\s)${pattern}(?:\\s|$)`, 'u');
  const normVariants = variants.map(v => normalizeAr(v)).filter(Boolean);

  return (text: string) => {
    const normText = normalizeAr(text);
    if (normText.includes(normName) || connectiveRegex.test(normText)) return true;
    for (const nv of normVariants) {
      if (nv.length >= 5 && normText.includes(nv)) return true;
    }
    return false;
  };
}

type RawFeedItem = {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  snippet: string;
};

async function fetchGoogleRss(query: string, hl: string, gl: string, ceid: string): Promise<RawFeedItem[]> {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encoded}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(2000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
      },
      cache: 'no-store'
    });

    if (!res.ok) return [];
    const xml = await res.text();

    const items = [...xml.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>(?:[\s\S]*?<description>(.*?)<\/description>)?(?:[\s\S]*?<source[^>]*>(.*?)<\/source>)?[\s\S]*?<\/item>/g)];

    return items.map(m => {
      const rawTitle = (m[1] || '').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
      const link = (m[2] || '').trim();
      const pubDate = m[3] || '';
      const rawDesc = (m[4] || '')
        .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const source = (m[5] || '').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
      return {
        title: rawTitle,
        link,
        pubDate,
        snippet: rawDesc,
        source
      };
    });
  } catch {
    return [];
  }
}

async function fetchGdelt(name: string, matcher: (t: string) => boolean): Promise<AdverseArticle[]> {
  try {
    const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
    url.searchParams.set('query', `"${name}"`);
    url.searchParams.set('mode', 'artlist');
    url.searchParams.set('format', 'json');
    url.searchParams.set('maxrecords', '15');
    url.searchParams.set('sort', 'hybridrel');

    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(1800),
      headers: { Accept: 'application/json' }
    });

    if (!res.ok) return [];
    const raw = (await res.text()).trim();
    if (!raw || raw[0] !== '{') return [];

    const articleSchema = z.object({
      url: z.string(),
      title: z.string(),
      seendate: z.string().optional(),
      domain: z.string().optional()
    }).passthrough();

    const data = z.object({ articles: z.array(articleSchema).default([]) }).parse(JSON.parse(raw));
    const articles: AdverseArticle[] = [];

    for (const a of data.articles) {
      if (!matcher(a.title)) continue;

      let host = a.domain || '';
      try {
        host = host || new URL(a.url).hostname.replace(/^www\./, '');
      } catch {
        host = 'GDELT';
      }

      const s = a.seendate ?? '';
      const date = /^\d{8}/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : '';

      articles.push({
        title: a.title,
        url: a.url,
        domain: host,
        date,
        source: host,
        category: classifyArticle(a.title)
      });
    }

    return articles;
  } catch {
    return [];
  }
}

export type AdverseSearchResult = {
  status: 'not_searched' | 'searched' | 'failed';
  articles: AdverseArticle[];
  generalNews?: AdverseArticle[];
  retrievedAt?: string;
};

const ADVERSE_CACHE = new Map<string, { result: AdverseSearchResult; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_MAX = 500; // bound cache size (oldest entry evicted on overflow)

export async function adverseMediaSearch(
  q: string,
  options?: { country?: string }
): Promise<AdverseSearchResult> {
  const name = q.trim();
  if (name.length < 2 || name.length > 160) {
    return { status: 'not_searched', articles: [], generalNews: [] };
  }

  const cacheKey = normalizeLat(normalizeAr(name));
  const cached = ADVERSE_CACHE.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result;
  }

  const isArabic = /[\u0600-\u06FF]/.test(name);
  const matcher = buildNameMatcher(name);
  const { variants } = extractNameVariants(name);

  try {
    const executeSearch = async (): Promise<AdverseSearchResult> => {
      let rawItems: RawFeedItem[] = [];

      // Search targets: full official name + top journalistic short name variants
      const targetNames = [name, ...variants.slice(0, 2)];

      if (isArabic) {
        // 1. Arabic Search: Target Middle East & Gulf publications across name variants
        const promises: Promise<RawFeedItem[]>[] = [];
        for (const tName of targetNames) {
          const adverseQuery = `"${tName}" (${ARABIC_ADVERSE_TERMS.slice(0, 8).join(' OR ')})`;
          const generalQuery = `"${tName}"`;
          promises.push(
            fetchGoogleRss(adverseQuery, 'ar', 'EG', 'EG:ar'),
            fetchGoogleRss(adverseQuery, 'ar', 'AE', 'AE:ar'),
            fetchGoogleRss(generalQuery, 'ar', 'EG', 'EG:ar')
          );
        }

        const resultsArrays = await Promise.all(promises);
        rawItems = resultsArrays.flat();
      } else {
        // 2. Latin / International Search: US & UK/Global editions
        const promises: Promise<RawFeedItem[]>[] = [];
        for (const tName of targetNames) {
          const adverseQuery = `"${tName}" (${ENGLISH_ADVERSE_TERMS.slice(0, 8).join(' OR ')})`;
          const generalQuery = `"${tName}"`;
          promises.push(
            fetchGoogleRss(adverseQuery, 'en-US', 'US', 'US:en'),
            fetchGoogleRss(adverseQuery, 'en-GB', 'GB', 'GB:en'),
            fetchGoogleRss(generalQuery, 'en-US', 'US', 'US:en')
          );
        }

        const resultsArrays = await Promise.all(promises);
        rawItems = resultsArrays.flat();
      }

      // Process & Filter with Strict Name Verification
      const seen = new Set<string>();
      const verifiedArticles: AdverseArticle[] = [];

      for (const item of rawItems) {
        if (!item.title || !item.link) continue;

        // CRITICAL COMPLIANCE RULE:
        // Only keep the article if the searched name is verified in the title or snippet!
        const contentToMatch = `${item.title} ${item.snippet}`;
        if (!matcher(contentToMatch)) {
          continue; // Drop completely irrelevant articles
        }

        let domain = item.source;
        try {
          if (!domain) domain = new URL(item.link).hostname.replace(/^www\./, '');
        } catch {
          domain = 'Google News';
        }

        const dedupeKey = `${domain.toLowerCase()}|${item.title.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '')}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        let formattedDate = '';
        try {
          const d = new Date(item.pubDate);
          if (!isNaN(d.getTime())) {
            formattedDate = d.toISOString().split('T')[0];
          }
        } catch {
          formattedDate = item.pubDate;
        }

        const category = classifyArticle(`${item.title} ${item.snippet}`);

        verifiedArticles.push({
          title: item.title,
          url: item.link,
          domain,
          date: formattedDate,
          source: item.source || domain,
          snippet: item.snippet,
          category
        });
      }

      // If Google returned very few hits, run GDELT with the same strict matcher
      if (verifiedArticles.length < 3) {
        const gdeltHits = await fetchGdelt(name, matcher);
        for (const gh of gdeltHits) {
          const dedupeKey = `${gh.domain.toLowerCase()}|${gh.title.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '')}`;
          if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            verifiedArticles.push(gh);
          }
        }
      }

      // Separate genuine adverse media from neutral public presence
      const adverseList = verifiedArticles.filter(a => a.category !== 'other');
      const generalList = verifiedArticles.filter(a => a.category === 'other');

      const outcome: AdverseSearchResult = {
        status: 'searched',
        articles: adverseList.slice(0, 15),
        generalNews: generalList.slice(0, 20),
        retrievedAt: new Date().toISOString()
      };

      // Bound the cache so it can't grow unbounded over a long-running process.
      if (ADVERSE_CACHE.size >= CACHE_MAX) {
        const oldest = ADVERSE_CACHE.keys().next().value;
        if (oldest !== undefined) ADVERSE_CACHE.delete(oldest);
      }
      ADVERSE_CACHE.set(cacheKey, { result: outcome, expiresAt: Date.now() + CACHE_TTL_MS });
      return outcome;
    };

    // Cap total adverse search time at 2500ms so the caller is never blocked. On timeout we
    // return 'failed' (NOT an empty 'searched') so an incomplete search is never recorded as a
    // clean result — the real search keeps running and populates the cache for the next call.
    const fallbackTimeout: Promise<AdverseSearchResult> = new Promise(resolve =>
      setTimeout(() => resolve({ status: 'failed', articles: [], generalNews: [] }), 2500)
    );

    return await Promise.race([executeSearch(), fallbackTimeout]);
  } catch {
    return { status: 'failed', articles: [], generalNews: [] };
  }
}
