import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {normalizeName,phoneticKey} from '../src/lib/name-normalization';
if(process.env.APP_ENV!=='local')throw Error('Local import only');
const _adminUrl=process.env.DATABASE_ADMIN_URL!;
const _adminSsl=!/@(localhost|127\.0\.0\.1)[:/]/.test(_adminUrl)&&!/sslmode=disable/.test(_adminUrl);
const db=new Pool({connectionString:_adminUrl,...(_adminSsl?{ssl:{rejectUnauthorized:false}}:{})});
try{
await db.query(await readFile('db/002_search.sql','utf8'));
await db.query(await readFile('db/003_source_changes.sql','utf8'));
await db.query(await readFile('db/015_phonetic.sql','utf8'));
for(const code of (process.argv.slice(2).length?process.argv.slice(2):['UN','UK','OFAC'])){
 const data=JSON.parse(await readFile(`.local/sources/${code}/parsed.json`,'utf8'));
 if(data.code!==code || !Array.isArray(data.records) || !/^[a-f0-9]{64}$/.test(data.sha256))throw Error('Invalid source snapshot');
 const c=await db.connect();
 try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[code]);
 const prior=await c.query('SELECT id,sha256,record_count,parser_version FROM source_versions WHERE code=$1 AND active',[code]);
 const priorId=prior.rowCount?prior.rows[0].id:null;const priorSha=prior.rowCount?prior.rows[0].sha256:null;
 if(!data.records.length||(prior.rowCount&&data.records.length<prior.rows[0].record_count*.75))throw Error('Suspicious record count; previous source preserved');
 // Unchanged content already stored under this parser: record the check, keep the active version.
 if(priorSha===data.sha256 && prior.rows[0].parser_version===data.parserVersion){await c.query(`INSERT INTO source_imports(code,version_id,outcome,record_count,sha256,prev_sha256,upstream_version,upstream_last_change) VALUES($1,$2,'unchanged',$3,$4,$4,$5,$6)`,[code,priorId,data.records.length,data.sha256,data.upstreamVersion??null,data.upstreamLastChange??null]);await c.query('COMMIT');console.log(code,'unchanged');continue;}
 let v=await c.query('SELECT id FROM source_versions WHERE code=$1 AND sha256=$2 AND parser_version=$3',[code,data.sha256,data.parserVersion]);
 const reused=(v.rowCount??0)>0;
 if(!reused){v=await c.query('INSERT INTO source_versions(code,sha256,retrieved_at,parser_version,source_url,record_count) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[code,data.sha256,data.retrievedAt,data.parserVersion,data.url,data.records.length]);
 for(let start=0;start<data.records.length;start+=500){const batch=data.records.slice(start,start+500);
 await c.query(`INSERT INTO source_records(version_id,source_record_id,name,kind,aliases,details) SELECT $1,x.id,x.name,x.kind,x.aliases,x.details FROM jsonb_to_recordset($2::jsonb) AS x(id text,name text,kind text,aliases jsonb,details jsonb)`,[v.rows[0].id,JSON.stringify(batch)]);}
 const records=await c.query('SELECT id,name,aliases FROM source_records WHERE version_id=$1',[v.rows[0].id]);
 const names=records.rows.flatMap(r=>[...new Set<string>([r.name,...r.aliases])].filter(n=>normalizeName(n)).map(name=>({record_id:r.id,name,normalized:normalizeName(name),phonetic:phoneticKey(name)})));
 for(let start=0;start<names.length;start+=1000)await c.query(`INSERT INTO source_names SELECT x.record_id,x.name,x.normalized,x.phonetic FROM jsonb_to_recordset($1::jsonb) AS x(record_id uuid,name text,normalized text,phonetic text) ON CONFLICT DO NOTHING`,[JSON.stringify(names.slice(start,start+1000))]);
 }
 const newId=v.rows[0].id;
 // Additions/removals versus the previously active version, by source record id.
 let added=data.records.length,removed=0;
 if(priorId){const d=await c.query(`SELECT
   (SELECT count(*) FROM source_records n WHERE n.version_id=$2 AND NOT EXISTS(SELECT 1 FROM source_records p WHERE p.version_id=$1 AND p.source_record_id=n.source_record_id)) AS added,
   (SELECT count(*) FROM source_records p WHERE p.version_id=$1 AND NOT EXISTS(SELECT 1 FROM source_records n WHERE n.version_id=$2 AND n.source_record_id=p.source_record_id)) AS removed`,[priorId,newId]);
 added=Number(d.rows[0].added);removed=Number(d.rows[0].removed);}
 await c.query('UPDATE source_versions SET active=false WHERE code=$1',[code]);await c.query('UPDATE source_versions SET active=true WHERE id=$1',[newId]);
 await c.query(`INSERT INTO source_imports(code,version_id,outcome,record_count,added,removed,sha256,prev_sha256,upstream_version,upstream_last_change) VALUES($1,$2,'imported',$3,$4,$5,$6,$7,$8,$9)`,[code,newId,data.records.length,added,removed,data.sha256,priorSha,data.upstreamVersion??null,data.upstreamLastChange??null]);
 await c.query(`DELETE FROM source_names WHERE record_id IN (SELECT r.id FROM source_records r JOIN source_versions sv ON sv.id=r.version_id WHERE sv.code=$1 AND sv.id<>$2 AND NOT sv.active)`,[code,newId]);
 await c.query(`DELETE FROM source_records WHERE version_id IN (SELECT sv.id FROM source_versions sv WHERE sv.code=$1 AND sv.id<>$2 AND NOT sv.active)`,[code,newId]);
 await c.query('COMMIT');console.log(code,data.records.length,'searchable',`(+${added} / -${removed}${reused?' · reactivated':''})`);
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
}finally{await db.end();}
