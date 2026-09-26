import {pool} from './db';
import {normalizeName,phoneticKey} from './name-normalization';
export async function searchCoverage(){return (await pool.query('SELECT id,code,retrieved_at,record_count,sha256 FROM source_versions WHERE active ORDER BY code')).rows as {id:string;code:string;retrieved_at:Date;record_count:number;sha256:string}[];}
// `limit` separates how many candidates we evaluate from how many the UI shows. The screening
// engine passes a high limit so a genuine hit is never cut off by the display cap.
export async function searchPublicSources(query:string, limit=51){
 const normalized=normalizeName(query);if(normalized.length<3||query.length>160)return [];
 const phonetic=phoneticKey(query);const usePhon=phonetic.length>=3;
 const cap=Math.min(500,Math.max(1,Math.floor(limit)));
 // Match on the normalized (same-script) key OR the cross-script phonetic key.
 // name_similarity is the stronger of the two, so an Arabic source entry and a
 // Latin customer name (or vice versa) surface via their shared phonetic key.
 return (await pool.query(`WITH candidates AS (
 SELECT DISTINCT ON(n.record_id) n.record_id,n.name AS matched_name,
 GREATEST(
   CASE WHEN n.normalized=$1 THEN 1.0 ELSE similarity(n.normalized,$1) END,
   -- Phonetic (cross-script) is a weaker, ambiguous signal: cap it so it can
   -- surface a match for review (medium) but never rate it high on its own.
   -- A genuine high still requires a same-script (normalized) match.
   CASE WHEN $3 THEN LEAST(similarity(coalesce(n.phonetic,''),$2), 0.72) ELSE 0 END
 ) AS name_similarity,
 CASE WHEN n.normalized=$1 THEN 'exact' ELSE 'similar' END AS match_kind
 FROM source_names n JOIN source_records r ON r.id=n.record_id JOIN source_versions v ON v.id=r.version_id AND v.active
 WHERE n.normalized % $1 OR n.normalized=$1 OR ($3 AND n.phonetic % $2)
 ORDER BY n.record_id,name_similarity DESC
 ) SELECT r.*,v.code,v.source_url,v.retrieved_at,v.sha256,c.matched_name,c.match_kind,c.name_similarity
 FROM candidates c JOIN source_records r ON r.id=c.record_id JOIN source_versions v ON v.id=r.version_id
 ORDER BY c.name_similarity DESC,r.name,r.id LIMIT $4`,[normalized,phonetic,usePhon,cap])).rows as SearchResult[];
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

