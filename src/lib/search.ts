import {pool} from './db';
import {normalizeName,phoneticKey} from './name-normalization';
export async function searchCoverage(){return (await pool.query('SELECT id,code,retrieved_at,record_count,sha256 FROM source_versions WHERE active ORDER BY code')).rows as {id:string;code:string;retrieved_at:Date;record_count:number;sha256:string}[];}
// Phonetic tokens that appear ≥1,000 times across the lists (Mohammed, Ahmed, Hassan, Ali,
// "company", "limited"…). A cross-script match made only of these is weak evidence, so it
// must not raise an alert on its own. Recomputed every 6h (≈0.15s, ~200 tokens).
const COMMON_TOKEN_MIN = 1000;
let commonTokens: {set:Set<string>; at:number} | null = null;
async function getCommonTokens(){
 if (commonTokens && Date.now() - commonTokens.at < 6 * 3600_000) return commonTokens.set;
 const rows = (await pool.query(`WITH t AS (SELECT unnest(string_to_array(phonetic,' ')) tok FROM source_names WHERE phonetic<>'')
   SELECT tok FROM t GROUP BY tok HAVING count(*) >= $1`, [COMMON_TOKEN_MIN])).rows as {tok:string}[];
 commonTokens = {set: new Set(rows.map(r => r.tok)), at: Date.now()};
 return commonTokens.set;
}
const ARABIC = /[\u0621-\u064A]/;

// `limit` separates how many candidates we evaluate from how many the UI shows. The screening
// engine passes a high limit so a genuine hit is never cut off by the display cap.
export async function searchPublicSources(query:string, limit=51){
 const normalized=normalizeName(query);if(normalized.length<3||query.length>160)return [];
 const phonetic=phoneticKey(query);const usePhon=phonetic.length>=3;
 const cap=Math.min(500,Math.max(1,Math.floor(limit)));
 const ns=tokenSubsetPatterns(normalized);            // same-script spelling
 // Cross-script boost (signal 2): only when the query and the listed name are in different
 // scripts, and the query carries at least one distinctive name.
 const common=usePhon?await getCommonTokens():new Set<string>();
 const distinctive=phonetic.split(' ').some(t=>t.length>=3&&!common.has(t));
 const queryArabic=ARABIC.test(normalized);
 // Phonetic skeletons collide for short names (Mohammed/Mahmoud → "mhmd"), so the looser
 // subset/prefix rules on the phonetic key only apply to 3+ name queries; two-name queries
 // still match cross-script through signal 2 (identical skeleton).
 const ps=usePhon&&phonetic.split(' ').length>=3?tokenSubsetPatterns(phonetic):null; // spelling variants & Arabic↔Latin
 // name_similarity is the strongest of four signals:
 //  1. same-script trigram similarity (exact = 1.0) — the only signal that can reach "high" alone;
 //  2. cross-script phonetic similarity — an identical skeleton across scripts ("حسن نصر الله" ↔
 //     "Hasan NASRALLAH") with a distinctive name is a reviewable candidate (0.80 → medium);
 //     anything weaker, same-script, or made only of common names stays ≤ 0.72 (low);
 //  3. token subset — the query's names anchor the listed name with extra middle names between
 //     ("Viktor Bout" → "Viktor Anatolijevitch Bout"). One extra name → 0.80, more → 0.70.
 //     Surname-first ("Bout Viktor") scores 0.80 only with no extra names: "Ali Mohammed Rage"
 //     is a different person from "Mohammed Ali" in Arabic naming, so it stays low (0.70);
 //  4. prefix (≥3 names) — the query is the start of a longer listed nasab ("Mohammed bin Salman"
 //     → "Muhammad bin Salman bin Abd al-Aziz Al Saud") → 0.80.
 // Signals 2–4 cap at 0.80, so a DOB/ID match is still required for "high" on them.
 return (await pool.query(`WITH candidates AS (
 SELECT DISTINCT ON(n.record_id) n.record_id,n.name AS matched_name,
 GREATEST(
   CASE WHEN n.normalized=$1 THEN 1.0 ELSE similarity(n.normalized,$1) END,
   CASE WHEN $3 THEN (CASE WHEN $13 AND (n.normalized ~ '[ء-ي]') <> $14
                             AND similarity(coalesce(n.phonetic,''),$2) >= 0.9 THEN 0.80
                           ELSE LEAST(similarity(coalesce(n.phonetic,''),$2), 0.72) END) ELSE 0 END,
   CASE WHEN $5::text IS NOT NULL AND n.normalized ~ $5
     THEN CASE WHEN array_length(string_to_array(n.normalized,' '),1) - $7 <= 1 THEN 0.80 ELSE 0.70 END
     WHEN $5::text IS NOT NULL AND n.normalized ~ $6
     THEN CASE WHEN array_length(string_to_array(n.normalized,' '),1) = $7 THEN 0.80 ELSE 0.70 END
     WHEN $8::text IS NOT NULL AND n.normalized ~ $8 THEN 0.80
     ELSE 0 END,
   CASE WHEN $9::text IS NOT NULL AND n.phonetic ~ $9
     THEN CASE WHEN array_length(string_to_array(n.phonetic,' '),1) - $11 <= 1 THEN 0.80 ELSE 0.70 END
     WHEN $9::text IS NOT NULL AND n.phonetic ~ $10
     THEN CASE WHEN array_length(string_to_array(n.phonetic,' '),1) = $11 THEN 0.80 ELSE 0.70 END
     WHEN $12::text IS NOT NULL AND n.phonetic ~ $12 THEN 0.80
     ELSE 0 END
 ) AS name_similarity,
 CASE WHEN n.normalized=$1 THEN 'exact' ELSE 'similar' END AS match_kind
 FROM source_names n JOIN source_records r ON r.id=n.record_id JOIN source_versions v ON v.id=r.version_id AND v.active
 WHERE n.normalized % $1 OR n.normalized=$1 OR ($3 AND n.phonetic % $2)
   OR ($5::text IS NOT NULL AND (n.normalized ~ $5 OR n.normalized ~ $6))
   OR ($8::text IS NOT NULL AND n.normalized ~ $8)
   OR ($9::text IS NOT NULL AND (n.phonetic ~ $9 OR n.phonetic ~ $10))
   OR ($12::text IS NOT NULL AND n.phonetic ~ $12)
 ORDER BY n.record_id,name_similarity DESC
 ) SELECT r.*,v.code,v.source_url,v.retrieved_at,v.sha256,c.matched_name,c.match_kind,c.name_similarity
 FROM candidates c JOIN source_records r ON r.id=c.record_id JOIN source_versions v ON v.id=r.version_id
 WHERE c.name_similarity >= 0.50 OR c.match_kind = 'exact'
 ORDER BY c.name_similarity DESC,r.name,r.id LIMIT $4`,[normalized,phonetic,usePhon,cap,
   ns?.forward??null,ns?.reversed??null,ns?.count??0,ns?.prefix??null,
   ps?.forward??null,ps?.reversed??null,ps?.count??0,ps?.prefix??null,distinctive,queryArabic])).rows as SearchResult[];
}
// Regexes for the token-subset / prefix match on a normalized or phonetic key. Both keys hold
// only letters, digits and single spaces, so tokens need no escaping. Needs 2–6 tokens of ≥2
// chars; the prefix form needs ≥3 tokens (two common names as a prefix would be too noisy).
export function tokenSubsetPatterns(key:string){
 const t=key.split(' ').filter(Boolean);
 if(t.length<2||t.length>6||t.some(x=>x.length<2))return null;
 const gap='( [^ ]+)*';
 const first=t[0],last=t[t.length-1],mid=t.slice(1,-1);
 const forward='^'+first+mid.map(x=>gap+' '+x).join('')+gap+' '+last+'$';
 const reversed='^'+last+' '+first+mid.map(x=>gap+' '+x).join('')+gap+'$';
 const prefix=t.length>=3?'^'+t.join(' ')+' [^ ]+'+gap+'$':null;
 return {forward,reversed,prefix,count:t.length};
}
export type SearchResult={id:string;name:string;kind:string;aliases:string[];details:Record<string,unknown>;source_record_id:string;code:string;source_url:string;retrieved_at:Date;sha256:string;matched_name:string;match_kind:string;name_similarity:number};
export async function getSourceRecord(id:string){return (await pool.query(`SELECT r.*,v.code,v.source_url,v.retrieved_at,v.sha256,v.active,v.parser_version FROM source_records r JOIN source_versions v ON v.id=r.version_id WHERE r.id=$1`,[id])).rows[0] as (SearchResult&{active:boolean;parser_version:string})|undefined;}
export async function getSourceRecordsMap(ids: string[]): Promise<Map<string, SearchResult & {active: boolean; parser_version: string}>> {
  const validIds = ids.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
  if (!validIds.length) return new Map();
  const rows = (await pool.query(
    `SELECT r.*,v.code,v.source_url,v.retrieved_at,v.sha256,v.active,v.parser_version
     FROM source_records r
     JOIN source_versions v ON v.id=r.version_id
     WHERE r.id = ANY($1::uuid[])`,
    [validIds]
  )).rows as (SearchResult & {active: boolean; parser_version: string})[];
  const map = new Map<string, SearchResult & {active: boolean; parser_version: string}>();
  for (const row of rows) {
    map.set(row.id, row);
  }
  return map;
}

