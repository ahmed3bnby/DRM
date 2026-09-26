import { z } from 'zod';
// Adverse-media research via GDELT DOC 2.0 (free, no key). Inclusion is a lead for analyst review,
// never proof of wrongdoing. The query narrows public news to negative/financial-crime indicators.
const ADVERSE = ['fraud','corruption','bribery','"money laundering"','laundering','sanctions','sanctioned','terrorism','terrorist','embezzlement','"financial crime"','arrested','convicted','indicted','investigation','smuggling','trafficking','scam'];
export type AdverseCategory = 'sanctions'|'laundering'|'fraud'|'corruption'|'terrorism'|'crime'|'other';
export type AdverseArticle = { title:string; url:string; domain:string; date:string; category:AdverseCategory };
const CATS:[RegExp,AdverseCategory][] = [
  [/sanction/i,'sanctions'],
  [/launder/i,'laundering'],
  [/fraud|scam|embezzl|ponzi/i,'fraud'],
  [/bribe|corrupt/i,'corruption'],
  [/terror/i,'terrorism'],
  [/traffick|smuggl|narcotic|\bdrug|arrest|convict|indict|charged|court|criminal/i,'crime'],
];
const classify = (title:string):AdverseCategory => { for (const [re,c] of CATS) if (re.test(title)) return c; return 'other'; };
const article = z.object({ url:z.string(), title:z.string(), seendate:z.string().optional(), domain:z.string().optional(), language:z.string().optional() }).passthrough();

export async function adverseMediaSearch(q:string):Promise<{status:'not_searched'|'searched'|'failed';articles:AdverseArticle[];retrievedAt?:string}> {
  const name = q.trim();
  if (name.length < 3 || name.length > 160) return { status:'not_searched', articles:[] };
  const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  url.searchParams.set('query', `"${name}" (${ADVERSE.join(' OR ')})`);
  url.searchParams.set('mode', 'artlist');
  url.searchParams.set('format', 'json');
  url.searchParams.set('maxrecords', '25');
  url.searchParams.set('sort', 'hybridrel');
  try {
    const res = await fetch(url, { cache:'no-store', signal:AbortSignal.timeout(2000), headers:{ Accept:'application/json' } });
    if (!res.ok) throw Error('Unavailable');
    const raw = (await res.text()).trim();
    if (raw.length > 3000000) throw Error('Oversized');
    // GDELT returns a plain-text notice (not JSON) when rate-limited ("Please limit requests…") —
    // treat any non-JSON body as a failure, not as "no results", so we never imply a clean scan.
    if (!raw || raw[0] !== '{') throw Error('Non-JSON response');
    const data = z.object({ articles: z.array(article).default([]) }).parse(JSON.parse(raw));
    const seen = new Set<string>(); const articles:AdverseArticle[] = [];
    for (const a of data.articles) {
      let host = a.domain || '';
      try { host = host || new URL(a.url).hostname; } catch { /* keep '' */ }
      const key = host + '|' + a.title.toLowerCase();
      if (seen.has(key)) continue; seen.add(key);
      const s = a.seendate ?? '';
      const date = /^\d{8}/.test(s) ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : '';
      articles.push({ title:a.title, url:a.url, domain:host, date, category:classify(a.title) });
      if (articles.length >= 15) break;
    }
    return { status:'searched', articles, retrievedAt:new Date().toISOString() };
  } catch { return { status:'failed', articles:[] }; }
}
