import { z } from 'zod';

// Adverse-media and Global Public News Research Engine
// Uses Google News RSS + GDELT Doc 2.0 with fallback for high-reliability compliance screening.

const ADVERSE_KEYWORDS = [
  'fraud', 'corruption', 'bribery', '"money laundering"', 'laundering',
  'sanctions', 'sanctioned', 'terrorism', 'terrorist', 'embezzlement',
  '"financial crime"', 'arrested', 'convicted', 'indicted', 'investigation',
  'smuggling', 'trafficking', 'scam', 'court', 'penalty', 'fine', 'seizure',
  'احتيال', 'غسيل أموال', 'فساد', 'رشوة', 'إرهاب', 'عقوبات', 'اختلاس', 'محكمة', 'مصادرة'
];

export type AdverseCategory = 'sanctions' | 'laundering' | 'fraud' | 'corruption' | 'terrorism' | 'crime' | 'regulatory' | 'other';

export type AdverseArticle = {
  title: string;
  url: string;
  domain: string;
  date: string;
  category: AdverseCategory;
  source?: string;
  snippet?: string;
};

const CATS: [RegExp, AdverseCategory][] = [
  [/sanction/i, 'sanctions'],
  [/launder|money\s*laundering|غسيل\s*أموال/i, 'laundering'],
  [/fraud|scam|embezzl|ponzi|احتيال|نصب|اختلاس/i, 'fraud'],
  [/bribe|corrupt|رشوة|فساد/i, 'corruption'],
  [/terror|إرهاب/i, 'terrorism'],
  [/regulatory|fine|penalty|sec\b|fca\b|dfsa\b|غرامة|مخالفة/i, 'regulatory'],
  [/traffick|smuggl|narcotic|\bdrug|arrest|convict|indict|charged|court|criminal|تهريب|مخدرات|محاكمة|جنائي/i, 'crime'],
];

export const classifyArticle = (text: string): AdverseCategory => {
  for (const [re, c] of CATS) {
    if (re.test(text)) return c;
  }
  return 'other';
};

// 1. Google News Fetcher (Fast, live, zero-cost, high relevance)
async function fetchGoogleNews(name: string, isAdverseOnly = false): Promise<AdverseArticle[]> {
  try {
    const query = isAdverseOnly
      ? `"${name}" (${ADVERSE_KEYWORDS.slice(0, 10).join(' OR ')})`
      : `"${name}"`;

    const encoded = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(4500),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
      },
      cache: 'no-store'
    });

    if (!res.ok) return [];
    const xml = await res.text();

    const items = [...xml.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>(?:[\s\S]*?<source[^>]*>(.*?)<\/source>)?[\s\S]*?<\/item>/g)];
    const articles: AdverseArticle[] = [];
    const seen = new Set<string>();

    for (const match of items) {
      const rawTitle = (match[1] || '').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
      const link = (match[2] || '').trim();
      const pubDate = match[3] || '';
      const source = (match[4] || '').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();

      if (!rawTitle || !link) continue;

      let domain = source;
      try {
        if (!domain) domain = new URL(link).hostname.replace(/^www\./, '');
      } catch {
        domain = 'Google News';
      }

      const dedupeKey = `${domain}|${rawTitle.toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      let formattedDate = '';
      try {
        const d = new Date(pubDate);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toISOString().split('T')[0];
        }
      } catch {
        formattedDate = pubDate;
      }

      articles.push({
        title: rawTitle,
        url: link,
        domain,
        date: formattedDate,
        source: source || domain,
        category: classifyArticle(rawTitle)
      });

      if (articles.length >= 20) break;
    }

    return articles;
  } catch {
    return [];
  }
}

// 2. GDELT DOC 2.0 Fetcher
async function fetchGdelt(name: string): Promise<AdverseArticle[]> {
  try {
    const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
    url.searchParams.set('query', `"${name}" (${ADVERSE_KEYWORDS.slice(0, 12).join(' OR ')})`);
    url.searchParams.set('mode', 'artlist');
    url.searchParams.set('format', 'json');
    url.searchParams.set('maxrecords', '25');
    url.searchParams.set('sort', 'hybridrel');

    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
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
    const seen = new Set<string>();

    for (const a of data.articles) {
      let host = a.domain || '';
      try {
        host = host || new URL(a.url).hostname;
      } catch {
        host = 'GDELT';
      }

      const key = host + '|' + a.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

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

      if (articles.length >= 15) break;
    }

    return articles;
  } catch {
    return [];
  }
}

export async function adverseMediaSearch(
  q: string
): Promise<{
  status: 'not_searched' | 'searched' | 'failed';
  articles: AdverseArticle[];
  generalNews?: AdverseArticle[];
  retrievedAt?: string;
}> {
  const name = q.trim();
  if (name.length < 3 || name.length > 160) {
    return { status: 'not_searched', articles: [], generalNews: [] };
  }

  try {
    // Run parallel searches for targeted adverse media and general web presence
    const [googleAdverse, googleGeneral, gdeltArticles] = await Promise.all([
      fetchGoogleNews(name, true),
      fetchGoogleNews(name, false),
      fetchGdelt(name)
    ]);

    // Deduplicate adverse articles
    const adverseMap = new Map<string, AdverseArticle>();
    for (const a of [...googleAdverse, ...gdeltArticles]) {
      const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!adverseMap.has(key)) adverseMap.set(key, a);
    }

    // General media search (news mentions, career, public records)
    const generalList: AdverseArticle[] = [];
    const generalSeen = new Set<string>();
    for (const a of googleGeneral) {
      const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!adverseMap.has(key) && !generalSeen.has(key)) {
        generalSeen.add(key);
        generalList.push(a);
      }
    }

    const finalAdverse = Array.from(adverseMap.values()).slice(0, 15);
    const finalGeneral = generalList.slice(0, 20);

    return {
      status: 'searched',
      articles: finalAdverse,
      generalNews: finalGeneral,
      retrievedAt: new Date().toISOString()
    };
  } catch {
    return { status: 'failed', articles: [], generalNews: [] };
  }
}
