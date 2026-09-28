// Compare with the last successful import, so failed downloads are retried next run.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {Pool} from 'pg';
import {existsSync} from 'node:fs';
let envFile = '.env.local';
for(const p of ['.env.production.local', '.env.local', '.env']){
  if(existsSync(p)){
    envFile = p;
    try{process.loadEnvFile(p);if(process.env.DATABASE_ADMIN_URL)break;}catch{}
  }
}
if(process.env.APP_ENV!=='local')throw Error('Local sync only');
const run=(cmd,args)=>new Promise((res,rej)=>{
 const p=spawn(cmd,args,{stdio:'inherit'});p.on('error',rej);
 p.on('close',code=>code===0?res():rej(new Error(`${cmd} exited ${code}`)));
});
await run('python3',['scripts/connectors/opensanctions.py','catalog']);
const {datasets}=JSON.parse(await readFile('scripts/watchlist.json','utf8'));
const catalog=JSON.parse(await readFile('.local/sources/_catalog.json','utf8'));
const db=new Pool({connectionString:process.env.DATABASE_ADMIN_URL});
let successful=[];
try{successful=(await db.query(`SELECT v.code,v.parser_version,i.upstream_version FROM source_versions v LEFT JOIN LATERAL (SELECT upstream_version FROM source_imports WHERE version_id=v.id ORDER BY imported_at DESC LIMIT 1) i ON true WHERE v.active`)).rows;}finally{await db.end();}
const targets=datasets.filter(code=>!process.argv.includes('--changed-only') || !successful.some(v=>v.code===code&&v.parser_version==='os-rich-1.0'&&v.upstream_version===catalog.sources.find(s=>s.code===code)?.version));
console.log(`sync: ${targets.length}/${datasets.length} lists require import`);
let status={};try{status=JSON.parse(await readFile('.local/sources/_sync-status.json','utf8'));}catch{}
let failed=0;
for(const code of targets){
 try{
  await run('python3',['scripts/connectors/opensanctions.py',code]);
  await run(process.execPath,[`--env-file=${envFile}`,'--import','tsx','scripts/import-sources.ts',code]);
  status[code]={status:'success',checkedAt:new Date().toISOString()};
 }catch{failed++;status[code]={status:'failed',checkedAt:new Date().toISOString()};console.error(`${code}: failed; previous searchable version preserved`);}
 await writeFile('.local/sources/_sync-status.tmp',JSON.stringify(status));
 await rename('.local/sources/_sync-status.tmp','.local/sources/_sync-status.json');
}
console.log(`sync complete: ${targets.length-failed} successful; ${failed} failed`);
process.exitCode=failed?1:0;
